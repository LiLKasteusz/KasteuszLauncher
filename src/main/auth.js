const { BrowserWindow, session } = require('electron');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

let AdmZip = null;
try {
  AdmZip = require('adm-zip');
} catch (_) {
  AdmZip = null;
}

const SKINS_CACHE_DIR = path.join(config.APP_DIR, 'skins');

const MS_CLIENT_ID = '00000000402b5328';
const MS_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const MS_AUTH_URL = `https://login.live.com/oauth20_authorize.srf?client_id=${MS_CLIENT_ID}&response_type=code&scope=service::user.auth.xboxlive.com::MBI_SSL&redirect_uri=${encodeURIComponent(MS_REDIRECT_URI)}&prompt=select_account`;

async function loginWithMicrosoft() {
  const authSession = session.fromPartition('persist:ms_auth');
  try {
    await authSession.clearStorageData();
  } catch (e) {
    console.warn('Nie udało się wyczyścić pamięci sesji auth:', e);
  }

  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 550,
      height: 700,
      center: true,
      show: true,
      title: 'Logowanie do konta Microsoft - Minecraft',
      autoHideMenuBar: true,
      backgroundColor: '#111217',
      webPreferences: {
        partition: 'persist:ms_auth',
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const chromeUserAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
    authWin.webContents.setUserAgent(chromeUserAgent);
    authWin.focus();

    let handled = false;

    const handleCallback = async (targetUrl) => {
      if (handled) return;
      if (targetUrl.startsWith(MS_REDIRECT_URI)) {
        handled = true;
        try {
          const urlObj = new URL(targetUrl);
          let code = urlObj.searchParams.get('code');
          if (!code && urlObj.hash) {
            const hashParams = new URLSearchParams(urlObj.hash.substring(1));
            code = hashParams.get('code');
          }

          const error = urlObj.searchParams.get('error_description') || urlObj.searchParams.get('error');

          if (error) {
            if (!authWin.isDestroyed()) authWin.close();
            return reject(new Error(`Błąd logowania Microsoft: ${error}`));
          }

          if (!code) {
            if (!authWin.isDestroyed()) authWin.close();
            return reject(new Error('Nie otrzymano kodu autoryzacyjnego z Microsoftu.'));
          }

          if (!authWin.isDestroyed()) authWin.close();
          const account = await completeMicrosoftAuth(code);
          resolve(account);
        } catch (err) {
          if (!authWin.isDestroyed()) authWin.close();
          reject(err);
        }
      }
    };

    authWin.webContents.on('will-navigate', (e, url) => {
      if (url.startsWith(MS_REDIRECT_URI)) e.preventDefault();
      handleCallback(url);
    });
    authWin.webContents.on('will-redirect', (e, url) => {
      if (url.startsWith(MS_REDIRECT_URI)) e.preventDefault();
      handleCallback(url);
    });
    authWin.webContents.on('did-navigate', (e, url) => handleCallback(url));

    authWin.on('closed', () => {
      if (!handled) {
        reject(new Error('Anulowano logowanie do konta Microsoft.'));
      }
    });

    authWin.loadURL(MS_AUTH_URL);
  });
}

async function completeMicrosoftAuth(authCode) {
  const tokenRes = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      code: authCode,
      grant_type: 'authorization_code',
      redirect_uri: MS_REDIRECT_URI,
      scope: 'service::user.auth.xboxlive.com::MBI_SSL'
    })
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Błąd wymiany tokenu Microsoft (${tokenRes.status}): ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  const msAccessToken = tokenData.access_token;
  const msRefreshToken = tokenData.refresh_token;

  return await authenticateWithXboxAndMinecraft(msAccessToken, msRefreshToken);
}

async function refreshAccountToken(account) {
  if (!account || !account.msRefreshToken) {
    throw new Error('Brak tokenu odświeżania dla tego konta.');
  }

  const refreshRes = await fetch('https://login.live.com/oauth20_token.srf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      refresh_token: account.msRefreshToken,
      grant_type: 'refresh_token',
      redirect_uri: MS_REDIRECT_URI,
      scope: 'service::user.auth.xboxlive.com::MBI_SSL'
    })
  });

  if (!refreshRes.ok) {
    throw new Error('Sesja wygasła. Zaloguj się ponownie do konta Microsoft.');
  }

  const tokenData = await refreshRes.json();
  return await authenticateWithXboxAndMinecraft(tokenData.access_token, tokenData.refresh_token || account.msRefreshToken);
}

async function authenticateWithXboxAndMinecraft(msAccessToken, msRefreshToken) {
  async function requestXBL(ticket) {
    return await fetch('https://user.auth.xboxlive.com/user/authenticate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-xbl-contract-version': '1'
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: 'RPS',
          SiteName: 'user.auth.xboxlive.com',
          RpsTicket: ticket
        },
        RelyingParty: 'http://auth.xboxlive.com',
        TokenType: 'JWT'
      })
    });
  }

  const rawTicket = (msAccessToken || '').replace(/^[dt]=/, '');

  let xblRes = await requestXBL(rawTicket);

  if (!xblRes.ok && xblRes.status === 401) {
    console.log('XBL zwrócił 401 na surowy ticket, ponawiam z prefiksem d=...');
    const retryD = await requestXBL(`d=${rawTicket}`);
    if (retryD.ok) {
      xblRes = retryD;
    }
  }

  if (!xblRes.ok && xblRes.status === 401) {
    console.log('XBL zwrócił 401, ponawiam z prefiksem t=...');
    const retryT = await requestXBL(`t=${rawTicket}`);
    if (retryT.ok) {
      xblRes = retryT;
    }
  }

  if (!xblRes.ok) {
    const errorBody = await xblRes.text().catch(() => '');
    console.error('Błąd XBL:', xblRes.status, errorBody);
    let parsedErr = null;
    try { parsedErr = JSON.parse(errorBody); } catch (e) {}

    const xerr = parsedErr?.XErr || parsedErr?.error;
    if (xerr === 2148916238) {
      throw new Error('Konto należy do dziecka (poniżej 18 lat). Musi zostać dodane do grupy rodzinnej Microsoft.');
    } else if (xerr === 2148916233) {
      throw new Error('Konto Microsoft nie posiada jeszcze profilu Xbox. Zaloguj się na xbox.com, aby utworzyć darmowy profil.');
    } else if (xerr === 2148916235) {
      throw new Error('Usługa Xbox Live nie jest dostępna w Twoim regionie.');
    } else if (xerr === 2148916236 || xerr === 2148916237) {
      throw new Error('Wymagana weryfikacja konta osoby dorosłej w ustawieniach konta Microsoft.');
    }

    throw new Error(`Błąd uwierzytelniania Xbox Live (${xblRes.status})${parsedErr?.Message ? ': ' + parsedErr.Message : ''}`);
  }

  const xblData = await xblRes.json();
  const xblToken = xblData.Token;
  const uhs = xblData.DisplayClaims?.xui?.[0]?.uhs;

  if (!uhs || !xblToken) {
    throw new Error('Nieprawidłowa odpowiedź z usługi Xbox Live.');
  }

  const xstsRes = await fetch('https://xsts.auth.xboxlive.com/xsts/authorize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-xbl-contract-version': '1'
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: 'RETAIL',
        UserTokens: [xblToken]
      },
      RelyingParty: 'rp://api.minecraftservices.com/',
      TokenType: 'JWT'
    })
  });

  if (!xstsRes.ok) {
    const xstsErrBody = await xstsRes.text().catch(() => '');
    console.error('Błąd XSTS:', xstsRes.status, xstsErrBody);
    let parsedErr = null;
    try { parsedErr = JSON.parse(xstsErrBody); } catch (e) {}

    const xerr = parsedErr?.XErr || parsedErr?.error;
    if (xerr === 2148916238) {
      throw new Error('Konto należy do dziecka (poniżej 18 lat). Musi zostać dodane do grupy rodzinnej Microsoft.');
    } else if (xerr === 2148916233) {
      throw new Error('Konto Microsoft nie posiada jeszcze powiązanego profilu Xbox. Zaloguj się na xbox.com, aby utworzyć profil.');
    } else if (xerr === 2148916235) {
      throw new Error('Usługa Xbox Live nie jest dostępna w Twoim regionie.');
    } else if (xerr === 2148916236 || xerr === 2148916237) {
      throw new Error('Wymagana weryfikacja konta osoby dorosłej w ustawieniach konta Microsoft.');
    }

    throw new Error(`Błąd usługi XSTS (${xstsRes.status})${parsedErr?.Message ? ': ' + parsedErr.Message : ''}`);
  }

  const xstsData = await xstsRes.json();
  const xstsToken = xstsData.Token;

  const mcLoginRes = await fetch('https://api.minecraftservices.com/authentication/login_with_xbox', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`
    })
  });

  if (!mcLoginRes.ok) {
    const mcErrBody = await mcLoginRes.text().catch(() => '');
    console.error('Błąd Minecraft Services:', mcLoginRes.status, mcErrBody);
    let parsedErr = null;
    try { parsedErr = JSON.parse(mcErrBody); } catch (e) {}
    throw new Error(`Błąd logowania Minecraft Services (${mcLoginRes.status})${parsedErr?.errorMessage ? ': ' + parsedErr.errorMessage : ''}`);
  }

  const mcLoginData = await mcLoginRes.json();
  const mcAccessToken = mcLoginData.access_token;
  const expiresIn = mcLoginData.expires_in || 86400;

  let ownsGame = false;
  try {
    const entRes = await fetch('https://api.minecraftservices.com/entitlements/mcstore', {
      headers: { 'Authorization': `Bearer ${mcAccessToken}` }
    });
    if (entRes.ok) {
      const entData = await entRes.json();
      ownsGame = Array.isArray(entData.items) && entData.items.length > 0;
    }
  } catch (e) {
    console.warn('Nie udało się sprawdzić uprawnień mcstore:', e);
  }

  let profile = null;
  try {
    const profileRes = await fetch('https://api.minecraftservices.com/minecraft/profile', {
      headers: { 'Authorization': `Bearer ${mcAccessToken}` }
    });
    if (profileRes.ok) {
      profile = await profileRes.json();
    }
  } catch (err) {
    console.warn('Błąd odczytu profilu Minecraft:', err);
  }

  const username = profile?.name || xblData.DisplayClaims?.xui?.[0]?.gtg || 'Gracz';
  const uuid = profile?.id || '00000000-0000-0000-0000-000000000000';
  let activeSkin = profile?.skins?.find(s => s.state === 'ACTIVE')?.url || profile?.skins?.[0]?.url || null;

  if (!activeSkin) {
    activeSkin = await getSkinUrlForUsername(username);
  }

  const xuid = xblData.DisplayClaims?.xui?.[0]?.xid || '';

  const account = {
    uuid: uuid,
    username: username,
    name: username,
    skinUrl: activeSkin,
    skinVariant: profile?.skins?.[0]?.variant || 'CLASSIC',
    capes: profile?.capes || [],
    mcAccessToken,
    msRefreshToken,
    expiresAt: Date.now() + expiresIn * 1000,
    ownsGame: !!profile,
    isPremium: !!profile,
    uhs,
    xuid
  };

  config.addOrUpdateAccount(account);
  return account;
}

async function getSkinUrlForUsername(username) {
  if (!username) return 'assets/default-skin.png';
  const clean = username.trim();

  // Skórka Zygzaka McQueena zarezerwowana wyłącznie dla konta Mcqueen420_ / Kasteusz
  if (/^mcqueen420_?$/i.test(clean) || /^kasteusz$/i.test(clean)) {
    return 'assets/mcqueen-skin.png';
  }

  try {
    const mojangRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(clean)}`, {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0' }
    });
    if (mojangRes.ok) {
      const mojangData = await mojangRes.json();
      if (mojangData && mojangData.id) {
        const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${mojangData.id}`);
        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          const texturesProp = sessionData.properties?.find(p => p.name === 'textures');
          if (texturesProp) {
            const decoded = JSON.parse(Buffer.from(texturesProp.value, 'base64').toString('utf8'));
            if (decoded.textures?.SKIN?.url) {
              return decoded.textures.SKIN.url;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Mojang API niedostępne lub brak gracza:', err.message);
  }

  // Domyślny fallback dla zwykłych graczy / znajomych: próba z mc-heads lub standardowy Steve
  try {
    const headCheck = await fetch(`https://mc-heads.net/skin/${encodeURIComponent(clean)}`, { method: 'HEAD' });
    if (headCheck.ok) {
      return `https://mc-heads.net/skin/${encodeURIComponent(clean)}`;
    }
  } catch (_) {}

  return 'assets/default-skin.png';
}

function computeOfflineUuid(username) {
  const clean = String(username || 'Player').trim();
  const md5 = crypto.createHash('md5').update(`OfflinePlayer:${clean}`, 'utf8').digest();
  md5[6] = (md5[6] & 0x0f) | 0x30;
  md5[8] = (md5[8] & 0x3f) | 0x80;
  const hex = md5.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

async function resolveSkinPngBuffer(skinSource) {
  if (!skinSource || typeof skinSource !== 'string') return null;

  if (skinSource.startsWith('data:image/')) {
    const commaIdx = skinSource.indexOf(',');
    if (commaIdx !== -1) {
      return Buffer.from(skinSource.slice(commaIdx + 1), 'base64');
    }
  }

  if (skinSource.startsWith('http://') || skinSource.startsWith('https://')) {
    const res = await fetch(skinSource, {
      headers: { 'User-Agent': 'KasteuszLauncher/2.4.0' }
    });
    if (!res.ok) {
      throw new Error(`Nie udało się pobrać pliku skórki (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  const cleanRel = skinSource.replace(/^file:\/\//, '');
  const candidatePaths = [
    cleanRel,
    path.join(__dirname, '../renderer', cleanRel),
    path.join(__dirname, '..', cleanRel)
  ];
  for (const p of candidatePaths) {
    if (p && fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  return null;
}

function saveLocalSkinCache(username, pngBuffer) {
  if (!username || !pngBuffer || pngBuffer.length === 0) return null;
  try {
    if (!fs.existsSync(SKINS_CACHE_DIR)) {
      fs.mkdirSync(SKINS_CACHE_DIR, { recursive: true });
    }
    const safeName = String(username).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const outPath = path.join(SKINS_CACHE_DIR, `${safeName}.png`);
    fs.writeFileSync(outPath, pngBuffer);
    return outPath;
  } catch (_) {
    return null;
  }
}

async function ensureValidPremiumToken(account) {
  if (!account || !account.isPremium) return account;
  const needsRefresh = !account.mcAccessToken || (account.expiresAt && Date.now() > account.expiresAt - 120000);
  if (needsRefresh && account.msRefreshToken) {
    return await refreshAccountToken(account);
  }
  return account;
}

async function uploadSkinToMicrosoft(account, pngBuffer, variant = 'CLASSIC') {
  const freshAcc = await ensureValidPremiumToken(account);
  if (!freshAcc?.mcAccessToken) {
    throw new Error('Brak aktywnego tokenu Microsoft. Zaloguj się ponownie.');
  }

  const normalizedVariant = String(variant || freshAcc.skinVariant || 'CLASSIC').toLowerCase() === 'slim'
    ? 'slim'
    : 'classic';

  const form = new FormData();
  form.append('variant', normalizedVariant);
  form.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'skin.png');

  const res = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${freshAcc.mcAccessToken}`
    },
    body: form
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Mojang API odrzuciło skórkę (${res.status}): ${errText.slice(0, 140) || res.statusText}`);
  }

  let profile = null;
  try {
    profile = await res.json();
  } catch (_) {}

  const activeMojangSkin = profile?.skins?.find(s => s.state === 'ACTIVE')?.url || profile?.skins?.[0]?.url || null;
  freshAcc.skinVariant = normalizedVariant.toUpperCase();
  freshAcc.mojangSkinUrl = activeMojangSkin || freshAcc.mojangSkinUrl || null;
  if (Array.isArray(profile?.capes)) {
    freshAcc.capes = profile.capes;
  }
  return freshAcc;
}

async function setOfficialMojangCape(capeIdOrUrl) {
  let active = config.getActiveAccount();
  if (!active || !active.isPremium) {
    return { synced: false, reason: 'offline' };
  }

  active = await ensureValidPremiumToken(active);
  if (!capeIdOrUrl || capeIdOrUrl === 'none') {
    const res = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${active.mcAccessToken}` }
    });
    return { synced: res.ok };
  }

  const capes = Array.isArray(active.capes) ? active.capes : [];
  const matched = capes.find(c =>
    c.id === capeIdOrUrl ||
    (c.url && c.url.replace('http://', 'https://') === String(capeIdOrUrl).replace('http://', 'https://'))
  );

  if (!matched || !matched.id) {
    return { synced: false, reason: 'custom_local_cape' };
  }

  const res = await fetch('https://api.minecraftservices.com/minecraft/profile/capes/active', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${active.mcAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ capeId: matched.id })
  });

  return { synced: res.ok, capeAlias: matched.alias };
}

function updateOptionsResourcePackEntry(instanceDir, packFileName, shouldEnable) {
  try {
    const optionsPath = path.join(instanceDir, 'options.txt');
    const entryName = `file/${packFileName}`;
    let lines = fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf8').split('\n') : [];
    const rpIdx = lines.findIndex(l => l.startsWith('resourcePacks:'));

    if (rpIdx >= 0) {
      const raw = lines[rpIdx].replace(/^resourcePacks:/, '').trim();
      let list = [];
      try { list = JSON.parse(raw); } catch (_) { list = ['vanilla']; }
      if (!Array.isArray(list)) list = ['vanilla'];

      list = list.filter(item => item !== entryName);
      if (shouldEnable) {
        list.push(entryName);
      }
      lines[rpIdx] = `resourcePacks:${JSON.stringify(list)}`;
    } else if (shouldEnable) {
      lines.push(`resourcePacks:["vanilla",${JSON.stringify(entryName)}]`);
    } else {
      return;
    }

    fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
  } catch (_) {}
}

async function syncSkinToInstance(instanceDir, account = null) {
  try {
    const acc = account || config.getActiveAccount();
    if (!instanceDir || !acc) return;

    const rpName = 'KasteuszOfflineSkin.zip';
    const rpPath = path.join(instanceDir, 'resourcepacks', rpName);

    if (acc.isPremium) {
      if (fs.existsSync(rpPath)) {
        try { fs.unlinkSync(rpPath); } catch (_) {}
      }
      updateOptionsResourcePackEntry(instanceDir, rpName, false);
      return;
    }

    const username = acc.username || acc.name || 'Gracz';
    const safeName = String(username).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const cachedSkinPath = path.join(SKINS_CACHE_DIR, `${safeName}.png`);

    let pngBuf = null;
    if (fs.existsSync(cachedSkinPath)) {
      pngBuf = fs.readFileSync(cachedSkinPath);
    } else if (acc.skinUrl) {
      pngBuf = await resolveSkinPngBuffer(acc.skinUrl).catch(() => null);
      if (pngBuf) saveLocalSkinCache(username, pngBuf);
    }

    if (!pngBuf || pngBuf.length === 0) return;

    // 1. CustomSkinLoader LocalSkin support (per-username skin on Fabric/Forge/Quilt)
    const cslDir = path.join(instanceDir, 'CustomSkinLoader');
    const localSkinsDir = path.join(cslDir, 'LocalSkin', 'skins');
    fs.mkdirSync(localSkinsDir, { recursive: true });
    fs.writeFileSync(path.join(localSkinsDir, `${username}.png`), pngBuf);

    const cslCfgPath = path.join(cslDir, 'CustomSkinLoader.json');
    if (!fs.existsSync(cslCfgPath)) {
      const cslConfig = {
        enable: true,
        loadlist: [
          {
            name: 'LocalSkin',
            type: 'Legacy',
            checkPNG: false,
            skin: 'LocalSkin/skins/{USERNAME}.png',
            model: (acc.skinVariant || 'CLASSIC').toLowerCase() === 'slim' ? 'slim' : 'default',
            cape: 'LocalSkin/capes/{USERNAME}.png'
          },
          {
            name: 'Mojang',
            type: 'MojangAPI'
          }
        ]
      };
      fs.writeFileSync(cslCfgPath, JSON.stringify(cslConfig, null, 2), 'utf8');
    } else {
      try {
        const parsed = JSON.parse(fs.readFileSync(cslCfgPath, 'utf8'));
        if (Array.isArray(parsed.loadlist)) {
          const localEntry = parsed.loadlist.find(e => e.name === 'LocalSkin');
          const modelType = (acc.skinVariant || 'CLASSIC').toLowerCase() === 'slim' ? 'slim' : 'default';
          if (localEntry) {
            localEntry.model = modelType;
          } else {
            parsed.loadlist.unshift({
              name: 'LocalSkin',
              type: 'Legacy',
              checkPNG: false,
              skin: 'LocalSkin/skins/{USERNAME}.png',
              model: modelType,
              cape: 'LocalSkin/capes/{USERNAME}.png'
            });
          }
          fs.writeFileSync(cslCfgPath, JSON.stringify(parsed, null, 2), 'utf8');
        }
      } catch (_) {}
    }

    // Check if CustomSkinLoader mod is already active in mods/
    const modsDir = path.join(instanceDir, 'mods');
    let hasCustomSkinLoaderMod = false;
    if (fs.existsSync(modsDir)) {
      try {
        hasCustomSkinLoaderMod = fs.readdirSync(modsDir).some(f =>
          f.toLowerCase().includes('customskinloader') && f.toLowerCase().endsWith('.jar')
        );
      } catch (_) {}
    }

    // 2. Vanilla fallback resourcepack (used when CustomSkinLoader mod is not installed)
    if (hasCustomSkinLoaderMod) {
      if (fs.existsSync(rpPath)) {
        try { fs.unlinkSync(rpPath); } catch (_) {}
      }
      updateOptionsResourcePackEntry(instanceDir, rpName, false);
    } else if (AdmZip) {
      const rpDir = path.join(instanceDir, 'resourcepacks');
      fs.mkdirSync(rpDir, { recursive: true });
      const zip = new AdmZip();
      const mcmeta = {
        pack: {
          pack_format: 34,
          supported_formats: { min_inclusive: 1, max_inclusive: 99 },
          description: `Skorka gracza ${username} (Kasteusz Launcher)`
        }
      };
      zip.addFile('pack.mcmeta', Buffer.from(JSON.stringify(mcmeta, null, 2), 'utf8'));
      zip.addFile('pack.png', pngBuf);

      // Legacy 1.8 - 1.19.2 paths
      zip.addFile('assets/minecraft/textures/entity/steve.png', pngBuf);
      zip.addFile('assets/minecraft/textures/entity/alex.png', pngBuf);

      // Modern 1.19.3+ default player skin paths
      const defaults = ['alex', 'ari', 'efe', 'kai', 'makena', 'noor', 'steve', 'sunny', 'zuri'];
      for (const name of defaults) {
        zip.addFile(`assets/minecraft/textures/entity/player/wide/${name}.png`, pngBuf);
        zip.addFile(`assets/minecraft/textures/entity/player/slim/${name}.png`, pngBuf);
      }

      zip.writeZip(rpPath);
      updateOptionsResourcePackEntry(instanceDir, rpName, true);
    }
  } catch (err) {
    console.warn('[SkinSync] Ostrzeżenie synchronizacji skórki Offline:', err.message);
  }
}

async function createOfflineAccount(username) {
  const cleanName = (username || 'Gracz').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16) || 'Gracz';
  const skinUrl = await getSkinUrlForUsername(cleanName);
  const pngBuf = await resolveSkinPngBuffer(skinUrl).catch(() => null);
  if (pngBuf) saveLocalSkinCache(cleanName, pngBuf);

  const offlineAccount = {
    uuid: computeOfflineUuid(cleanName),
    username: cleanName,
    name: cleanName,
    skinUrl: pngBuf ? `data:image/png;base64,${pngBuf.toString('base64')}` : skinUrl,
    skinVariant: 'CLASSIC',
    capes: [],
    mcAccessToken: 'offline_token',
    msRefreshToken: null,
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
    ownsGame: true,
    isPremium: false
  };
  config.addOrUpdateAccount(offlineAccount);

  try {
    const profiles = require('./profiles');
    await syncSkinToInstance(profiles.getActiveInstanceDirectory(), offlineAccount);
  } catch (_) {}

  return offlineAccount;
}

async function setAccountUsernameAndSkin(newUsername) {
  const active = config.getActiveAccount();
  if (!active) throw new Error('Brak aktywnego konta.');

  const cleanName = (newUsername || 'Gracz').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16) || 'Gracz';
  const skinUrl = await getSkinUrlForUsername(cleanName);

  if (active.isPremium) {
    // On Microsoft Premium, do not corrupt authenticated username — upload the fetched skin to Mojang!
    return await setAccountCustomSkin(skinUrl, active.skinVariant || 'CLASSIC');
  }

  const oldUuid = active.uuid;
  const pngBuf = await resolveSkinPngBuffer(skinUrl).catch(() => null);
  if (pngBuf) saveLocalSkinCache(cleanName, pngBuf);

  if (oldUuid && oldUuid !== computeOfflineUuid(cleanName)) {
    config.removeAccount(oldUuid);
  }

  active.uuid = computeOfflineUuid(cleanName);
  active.username = cleanName;
  active.name = cleanName;
  active.skinUrl = pngBuf ? `data:image/png;base64,${pngBuf.toString('base64')}` : skinUrl;
  delete active.customSkinUrl;
  config.addOrUpdateAccount(active);

  try {
    const profiles = require('./profiles');
    await syncSkinToInstance(profiles.getActiveInstanceDirectory(), active);
  } catch (_) {}

  return active;
}

async function setAccountCustomSkin(skinUrl, variant = null) {
  let active = config.getActiveAccount();
  if (!active) throw new Error('Brak aktywnego konta.');

  const chosenVariant = (variant || active.skinVariant || 'CLASSIC').toUpperCase() === 'SLIM' ? 'SLIM' : 'CLASSIC';
  const pngBuf = await resolveSkinPngBuffer(skinUrl);
  if (!pngBuf || pngBuf.length === 0) {
    throw new Error('Nie udało się odczytać pliku PNG skórki.');
  }

  saveLocalSkinCache(active.username || active.name || 'Gracz', pngBuf);
  const dataUrl = `data:image/png;base64,${pngBuf.toString('base64')}`;

  if (active.isPremium) {
    active = await uploadSkinToMicrosoft(active, pngBuf, chosenVariant);
    active.skinUrl = dataUrl;
    delete active.customSkinUrl;
    active.skinSyncedInGame = 'microsoft';
    config.addOrUpdateAccount(active);
    return active;
  }

  if (!active.uuid || active.uuid === '00000000-0000-0000-0000-000000000000') {
    const oldUuid = active.uuid;
    active.uuid = computeOfflineUuid(active.username || 'Gracz');
    if (oldUuid) config.removeAccount(oldUuid);
  }

  active.skinUrl = dataUrl;
  delete active.customSkinUrl;
  active.skinVariant = chosenVariant;
  active.skinSyncedInGame = 'offline';
  config.addOrUpdateAccount(active);

  try {
    const profiles = require('./profiles');
    await syncSkinToInstance(profiles.getActiveInstanceDirectory(), active);
  } catch (_) {}

  return active;
}

module.exports = {
  loginWithMicrosoft,
  completeMicrosoftAuth,
  refreshAccountToken,
  createOfflineAccount,
  computeOfflineUuid,
  getSkinUrlForUsername,
  setAccountUsernameAndSkin,
  setAccountCustomSkin,
  setOfficialMojangCape,
  syncSkinToInstance
};
