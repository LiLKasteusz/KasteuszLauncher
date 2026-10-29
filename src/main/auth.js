const { BrowserWindow, session } = require('electron');
const config = require('./config');

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
  if (!username) return null;
  const clean = username.trim();

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

  return `https://mc-heads.net/skin/${encodeURIComponent(clean)}`;
}

async function createOfflineAccount(username) {
  const cleanName = (username || 'Gracz').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16) || 'Gracz';
  const skinUrl = await getSkinUrlForUsername(cleanName);

  const offlineAccount = {
    uuid: '00000000-0000-0000-0000-000000000000',
    username: cleanName,
    skinUrl: skinUrl,
    skinVariant: 'CLASSIC',
    capes: [],
    mcAccessToken: 'offline_token',
    msRefreshToken: null,
    expiresAt: Date.now() + 365 * 24 * 3600 * 1000,
    ownsGame: true,
    isPremium: false
  };
  config.addOrUpdateAccount(offlineAccount);
  return offlineAccount;
}

async function setAccountUsernameAndSkin(newUsername) {
  const active = config.getActiveAccount();
  if (!active) throw new Error('Brak aktywnego konta.');

  const cleanName = (newUsername || 'Gracz').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16) || 'Gracz';
  const skinUrl = await getSkinUrlForUsername(cleanName);

  active.username = cleanName;
  active.skinUrl = skinUrl;
  config.addOrUpdateAccount(active);
  return active;
}

async function setAccountCustomSkin(skinUrl) {
  const active = config.getActiveAccount();
  if (!active) throw new Error('Brak aktywnego konta.');

  active.skinUrl = skinUrl;
  config.addOrUpdateAccount(active);
  return active;
}

module.exports = {
  loginWithMicrosoft,
  completeMicrosoftAuth,
  refreshAccountToken,
  createOfflineAccount,
  getSkinUrlForUsername,
  setAccountUsernameAndSkin,
  setAccountCustomSkin
};
