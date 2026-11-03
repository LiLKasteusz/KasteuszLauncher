const { BrowserWindow } = require('electron');
const { exec } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const config = require('./config');

const isFlatpak = fs.existsSync('/.flatpak-info');
const hostPrefix = isFlatpak ? 'flatpak-spawn --host ' : '';

const DEFAULT_SPOTIFY_CLIENT_ID = '65b708073fc0480ea92a077233ca87bd';
const REDIRECT_PORT = 8989;
const REDIRECT_URI = `http://127.0.0.1:${REDIRECT_PORT}/login`;
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read'
].join(' ');

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

async function exchangeCodeForToken(code, codeVerifier, clientId) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: codeVerifier
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || `Błąd tokenu Spotify (${res.status})`);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 3600
  };
}

async function refreshAccessToken() {
  const cfg = config.getConfig();
  const refreshToken = cfg?.spotifyAuth?.refreshToken;
  const clientId = cfg?.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID;
  if (!refreshToken) return null;

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    });

    if (res.ok) {
      const data = await res.json();
      const updated = {
        ...cfg.spotifyAuth,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000
      };
      config.saveConfig({ spotifyAuth: updated });
      return data.access_token;
    }
  } catch (err) {
    console.warn('[Spotify] Błąd odświeżania tokenu:', err);
  }
  return null;
}

async function getValidToken() {
  const cfg = config.getConfig();
  const auth = cfg?.spotifyAuth;
  if (!auth || !auth.accessToken) return null;

  if (auth.expiresAt && Date.now() > auth.expiresAt - 60000 && auth.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return refreshed;
  }
  return auth.accessToken;
}

async function loginWithSpotify(customClientId) {
  const trimmedCustom = typeof customClientId === 'string' ? customClientId.trim() : '';
  if (trimmedCustom) {
    config.saveConfig({ spotifyClientId: trimmedCustom });
  }
  const cfg = config.getConfig();
  const clientId = trimmedCustom || cfg?.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&code_challenge_method=S256&code_challenge=${codeChallenge}&show_dialog=true`;

  return new Promise((resolve, reject) => {
    let handled = false;
    let localServer = null;

    const authWin = new BrowserWindow({
      width: 540,
      height: 720,
      center: true,
      title: 'Logowanie do konta Spotify - KasteuszLauncher',
      autoHideMenuBar: true,
      backgroundColor: '#121212',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const cleanup = () => {
      if (localServer) {
        try { localServer.close(); } catch (_) {}
        localServer = null;
      }
      if (authWin && !authWin.isDestroyed()) {
        try { authWin.destroy(); } catch (_) {}
      }
    };

    async function handleCode(code) {
      if (handled) return;
      handled = true;
      try {
        const tokenData = await exchangeCodeForToken(code, codeVerifier, clientId);
        const profile = await fetchUserProfile(tokenData.accessToken).catch(() => ({ displayName: 'Użytkownik Spotify' }));
        const spotifyData = {
          accessToken: tokenData.accessToken,
          refreshToken: tokenData.refreshToken,
          expiresAt: Date.now() + (tokenData.expiresIn || 3600) * 1000,
          user: profile
        };
        config.saveConfig({ spotifyAuth: spotifyData });
        getUserPlaylists(tokenData.accessToken).catch(() => {});
        cleanup();
        resolve(spotifyData);
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    function checkRedirectUrl(rawUrl) {
      if (!rawUrl || handled) return false;
      if (rawUrl.includes(':8989') || rawUrl.includes('/login') || (rawUrl.includes('code=') && rawUrl.includes('127.0.0.1')) || rawUrl.includes('/auth/spotify/callback')) {
        try {
          const parsed = new URL(rawUrl.startsWith('spotube://') ? rawUrl.replace('spotube://', 'http://localhost/') : rawUrl);
          const error = parsed.searchParams.get('error');
          const code = parsed.searchParams.get('code');

          if (error) {
            handled = true;
            cleanup();
            reject(new Error(`Odrzucono logowanie Spotify: ${error}`));
            return true;
          }

          if (code) {
            handleCode(code);
            return true;
          }
        } catch (_) {}
      }
      return false;
    }

    try {
      localServer = http.createServer((req, res) => {
        const fullUrl = `http://127.0.0.1:${REDIRECT_PORT}${req.url}`;
        const didHandle = checkRedirectUrl(fullUrl);

        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><meta charset="utf-8"><title>KasteuszLauncher - Spotify</title></head>
          <body style="background:#090a0f;color:#ffffff;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;">
            <div style="text-align:center;padding:20px;">
              <h2 style="color:#1db954;margin-bottom:8px;">✓ Połączono pomyślnie z kontem Spotify!</h2>
              <p style="color:#94a3b8;font-size:14px;">Możesz teraz wrócić do KasteuszLauncher. To okno zamknie się automatycznie.</p>
            </div>
          </body>
          </html>
        `);
      });

      localServer.listen(REDIRECT_PORT, '127.0.0.1', () => {
        console.log(`[Spotify] Serwer nasłuchuje na porcie ${REDIRECT_PORT} dla callbacku OAuth...`);
      });

      localServer.on('error', (err) => {
        console.warn(`[Spotify] Błąd nasłuchu na porcie ${REDIRECT_PORT} (użyto fallbacku webContents):`, err.message);
      });
    } catch (e) {
      console.warn('[Spotify] Nie udało się uruchomić serwera callback:', e);
    }

    authWin.webContents.on('will-navigate', (_e, url) => {
      if (checkRedirectUrl(url)) _e.preventDefault();
    });

    authWin.webContents.on('will-redirect', (_e, url) => {
      if (checkRedirectUrl(url)) _e.preventDefault();
    });

    authWin.webContents.on('did-fail-load', (_e, _code, _desc, validatedURL) => {
      checkRedirectUrl(validatedURL);
    });

    authWin.on('closed', () => {
      if (!handled) {
        cleanup();
        reject(new Error('Zamknięto okno logowania Spotify.'));
      }
    });

    authWin.loadURL(authUrl);
  });
}

async function fetchUserProfile(token) {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Spotify API ${res.status}`);
  const data = await res.json();
  return {
    id: data.id,
    displayName: data.display_name || data.id,
    email: data.email || '',
    avatar: data.images?.[0]?.url || null,
    product: data.product || 'free',
    followers: data.followers?.total || 0,
    uri: data.uri
  };
}

let pendingPlaylistRetryTimer = null;

function mergePlaylists(accountPlaylists = [], savedPlaylists = []) {
  const seen = new Set();
  const out = [];
  for (const pl of accountPlaylists) {
    if (!pl || !pl.id || seen.has(pl.id)) continue;
    seen.add(pl.id);
    out.push(pl);
  }
  for (const pl of savedPlaylists) {
    if (!pl || !pl.id || seen.has(pl.id)) continue;
    seen.add(pl.id);
    out.push({ ...pl, isManual: true });
  }
  return out;
}

async function getUserPlaylists(tokenOverride) {
  const token = tokenOverride || await getValidToken();
  if (!token) throw new Error('Brak połączonego konta Spotify. Kliknij „Połącz konto Spotify”.');

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    if (res.status === 401) {
      const err = new Error('Token sesji Spotify wygasł. Kliknij „Połącz konto Spotify”, aby odświeżyć.');
      err.status = 401;
      throw err;
    }
    if (res.status === 429) {
      const retryAfter = Math.max(1, parseInt(res.headers.get('retry-after') || '30', 10));
      const err = new Error(`Limit zapytań Spotify API (429). Ponowna próba za ${retryAfter}s.`);
      err.status = 429;
      err.retryAfter = retryAfter;
      throw err;
    }
    const err = new Error(`Błąd pobierania playlist (${res.status})`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  let rawItems = Array.isArray(data.items) ? [...data.items] : [];

  if (data.next) {
    try {
      const res2 = await fetch('https://api.spotify.com/v1/me/playlists?limit=50&offset=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res2.ok) {
        const data2 = await res2.json();
        if (Array.isArray(data2.items)) rawItems = rawItems.concat(data2.items);
      }
    } catch (_) {}
  }

  const playlists = rawItems.filter(Boolean).map(p => ({
    id: p.id,
    name: p.name || 'Playlista Spotify',
    description: p.description || '',
    image: p.images?.[0]?.url || null,
    tracksCount: p.tracks?.total ?? 0,
    uri: p.uri,
    externalUrl: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
    owner: p.owner?.display_name || ''
  }));

  try {
    const likedRes = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (likedRes.ok) {
      const likedData = await likedRes.json();
      const likedTotal = Number(likedData?.total) || 0;
      if (likedTotal > 0) {
        playlists.unshift({
          id: 'liked-songs',
          name: 'Polubione utwory',
          description: 'Twoja biblioteka polubionych utworów na Spotify',
          image: null,
          isLikedSongs: true,
          tracksCount: likedTotal,
          uri: 'spotify:collection:tracks',
          externalUrl: 'https://open.spotify.com/collection/tracks',
          owner: 'Twoje konto'
        });
      }
    }
  } catch (_) {}

  const cfg = config.getConfig();
  if (!cfg?.spotifyAuth?.user?.id) {
    fetchUserProfile(token).then(profile => {
      const latestCfg = config.getConfig();
      if (latestCfg?.spotifyAuth) {
        config.saveConfig({ spotifyAuth: { ...latestCfg.spotifyAuth, user: profile } });
      }
    }).catch(() => {});
  }

  config.saveConfig({ spotifyCachedPlaylists: playlists });
  return playlists;
}

async function getAccountPlaylistsBundle(onRetrySuccess) {
  const cfg = config.getConfig();
  const isLoggedIn = !!(cfg?.spotifyAuth && cfg.spotifyAuth.accessToken);
  const usingCustomClientId = !!(cfg?.spotifyClientId && cfg.spotifyClientId.trim());
  const cached = Array.isArray(cfg?.spotifyCachedPlaylists) ? cfg.spotifyCachedPlaylists : [];
  const saved = Array.isArray(cfg?.savedSpotifyPlaylists) ? cfg.savedSpotifyPlaylists : [];

  if (!isLoggedIn) {
    return {
      playlists: saved.map(p => ({ ...p, isManual: true })),
      isLoggedIn: false,
      fromCache: false,
      rateLimited: false,
      retryAfter: 0,
      usingCustomClientId,
      clientId: cfg?.spotifyClientId || ''
    };
  }

  try {
    const fresh = await getUserPlaylists();
    return {
      playlists: mergePlaylists(fresh, saved),
      isLoggedIn: true,
      fromCache: false,
      rateLimited: false,
      retryAfter: 0,
      usingCustomClientId,
      clientId: cfg?.spotifyClientId || ''
    };
  } catch (err) {
    if (err.status === 429) {
      const retrySec = err.retryAfter || 30;
      if (!pendingPlaylistRetryTimer) {
        pendingPlaylistRetryTimer = setTimeout(async () => {
          pendingPlaylistRetryTimer = null;
          try {
            await getUserPlaylists();
            if (typeof onRetrySuccess === 'function') onRetrySuccess();
          } catch (_) {}
        }, retrySec * 1000 + 60);
        if (pendingPlaylistRetryTimer.unref) pendingPlaylistRetryTimer.unref();
      }
      return {
        playlists: mergePlaylists(cached, saved),
        isLoggedIn: true,
        fromCache: cached.length > 0,
        rateLimited: true,
        retryAfter: retrySec,
        usingCustomClientId,
        clientId: cfg?.spotifyClientId || '',
        error: err.message
      };
    }

    return {
      playlists: mergePlaylists(cached, saved),
      isLoggedIn: true,
      fromCache: cached.length > 0,
      rateLimited: false,
      retryAfter: 0,
      usingCustomClientId,
      clientId: cfg?.spotifyClientId || '',
      error: err.message
    };
  }
}

function saveImportedPlaylist(playlistInfo) {
  if (!playlistInfo || !playlistInfo.id) return [];
  const cfg = config.getConfig();
  const saved = Array.isArray(cfg?.savedSpotifyPlaylists) ? [...cfg.savedSpotifyPlaylists] : [];
  const entry = {
    id: playlistInfo.id,
    name: playlistInfo.name || 'Playlista Spotify',
    image: playlistInfo.coverUrl || playlistInfo.image || null,
    tracksCount: Array.isArray(playlistInfo.tracks) ? playlistInfo.tracks.length : (playlistInfo.tracksCount || 0),
    uri: `spotify:${playlistInfo.type || 'playlist'}:${playlistInfo.id}`,
    externalUrl: `https://open.spotify.com/${playlistInfo.type || 'playlist'}/${playlistInfo.id}`,
    isManual: true
  };
  const filtered = saved.filter(p => p.id !== entry.id);
  filtered.unshift(entry);
  config.saveConfig({ savedSpotifyPlaylists: filtered });
  return filtered;
}

function removeImportedPlaylist(playlistId) {
  const cfg = config.getConfig();
  const saved = Array.isArray(cfg?.savedSpotifyPlaylists) ? cfg.savedSpotifyPlaylists : [];
  const filtered = saved.filter(p => p.id !== playlistId);
  config.saveConfig({ savedSpotifyPlaylists: filtered });
  return filtered;
}

function setSpotifyClientId(clientId) {
  const cleaned = typeof clientId === 'string' ? clientId.trim() : '';
  config.saveConfig({ spotifyClientId: cleaned });
  return { success: true, clientId: cleaned };
}

async function getPlaylistTracks(playlistId, tokenOverride) {
  const token = tokenOverride || await getValidToken();
  if (!token) throw new Error('Brak połączonego konta Spotify.');

  const endpoint = playlistId === 'liked-songs'
    ? 'https://api.spotify.com/v1/me/tracks?limit=50'
    : `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  const res = await fetch(endpoint, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) throw new Error(`Błąd pobierania utworów playlisty (${res.status})`);

  const data = await res.json();
  return (data.items || []).map(item => {
    const t = item.track;
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      artists: (t.artists || []).map(a => a.name).join(', '),
      album: t.album?.name || '',
      albumArt: t.album?.images?.[0]?.url || null,
      durationMs: t.duration_ms || 0,
      previewUrl: t.preview_url || null,
      uri: t.uri,
      externalUrl: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`
    };
  }).filter(Boolean);
}

function launchSpotifyApp() {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec('cmd /c start "" spotify:', () => resolve(true));
      return;
    }
    exec(`${hostPrefix}flatpak run com.spotify.Client &`, (err) => {
      if (err) {
        exec(`${hostPrefix}spotify &`, () => resolve(true));
      } else {
        resolve(true);
      }
    });
  });
}

function getMprisStatus() {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      return resolve({ running: false, status: 'Stopped', title: '', artist: '', album: '', artUrl: '' });
    }
    exec(`${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:org.mpris.MediaPlayer2.Player string:PlaybackStatus`, (err, stdout) => {
      if (err) {
        return resolve({ running: false, status: 'Stopped', title: '', artist: '', album: '', artUrl: '' });
      }

      const statusMatch = stdout.match(/variant\s+string "([^"]+)"/);
      const status = statusMatch ? statusMatch[1] : 'Unknown';

      exec(`${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.freedesktop.DBus.Properties.Get string:org.mpris.MediaPlayer2.Player string:Metadata`, (metaErr, metaOut) => {
        if (metaErr) {
          return resolve({ running: true, status, title: '', artist: '', album: '', artUrl: '' });
        }

        const title = (metaOut.match(/string "xesam:title"\s+variant\s+string "([^"]+)"/) || [])[1] || '';
        const artist = (metaOut.match(/string "xesam:artist"\s+variant\s+array \[\s+string "([^"]+)"/) || [])[1] || '';
        const album = (metaOut.match(/string "xesam:album"\s+variant\s+string "([^"]+)"/) || [])[1] || '';
        const artUrl = (metaOut.match(/string "mpris:artUrl"\s+variant\s+string "([^"]+)"/) || [])[1] || '';

        resolve({
          running: true,
          status,
          title,
          artist,
          album,
          artUrl
        });
      });
    });
  });
}

function formatSpotifyUri(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.startsWith('spotify:')) return trimmed;

  const match = trimmed.match(/(playlist|album|track|artist)[\/:]([a-zA-Z0-9]+)/);
  if (match) {
    return `spotify:${match[1]}:${match[2]}`;
  }
  return trimmed;
}

function sendLinuxMprisCommand(cmd, arg = '') {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') return resolve(false);
    let bashCmd = '';
    if (cmd === 'PlayPause') {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.PlayPause`;
    } else if (cmd === 'Play') {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Play`;
    } else if (cmd === 'Pause') {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Pause`;
    } else if (cmd === 'Next') {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Next`;
    } else if (cmd === 'Previous') {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Previous`;
    } else if (cmd === 'OpenUri' && arg && /^spotify:[a-z]+:[a-zA-Z0-9]+$/.test(String(arg))) {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.OpenUri string:"${arg}"`;
    }

    if (!bashCmd) return resolve(false);

    exec(bashCmd, (err) => {
      resolve(!err);
    });
  });
}

async function controlSpotifyWeb(action, uri = null) {
  const formattedUri = uri ? formatSpotifyUri(uri) : null;

  const currentMpris = await getMprisStatus();

  if (action === 'launch') {
    await launchSpotifyApp();
    return { success: true, method: 'launch' };
  }

  if (action === 'play' && formattedUri) {
    if (!currentMpris.running) {
      await launchSpotifyApp();
      await new Promise(r => setTimeout(r, 1500));
    }
    const openSuccess = await sendLinuxMprisCommand('OpenUri', formattedUri);
    if (openSuccess) {
      await sendLinuxMprisCommand('Play');
      const updated = await getMprisStatus();
      return { success: true, method: 'mpris', track: updated };
    }
  } else if (action === 'toggle' || action === 'play' || action === 'pause') {
    if (!currentMpris.running && action !== 'pause') {
      await launchSpotifyApp();
      await new Promise(r => setTimeout(r, 1500));
    }
    const cmd = action === 'toggle' ? 'PlayPause' : (action === 'play' ? 'Play' : 'Pause');
    const mprisSuccess = await sendLinuxMprisCommand(cmd);
    if (mprisSuccess) {
      const updated = await getMprisStatus();
      return { success: true, method: 'mpris', track: updated };
    }
  } else if (action === 'next' || action === 'prev') {
    const cmd = action === 'next' ? 'Next' : 'Previous';
    const mprisSuccess = await sendLinuxMprisCommand(cmd);
    if (mprisSuccess) {
      const updated = await getMprisStatus();
      return { success: true, method: 'mpris', track: updated };
    }
  }

  const token = await getValidToken();
  if (!token) return { success: false, reason: 'no_token' };

  try {
    let url = 'https://api.spotify.com/v1/me/player/play';
    let method = 'PUT';
    let body = undefined;

    if (action === 'play' && formattedUri) {
      body = JSON.stringify(formattedUri.includes(':playlist:') ? { context_uri: formattedUri } : { uris: [formattedUri] });
    } else if (action === 'pause') {
      url = 'https://api.spotify.com/v1/me/player/pause';
    } else if (action === 'next') {
      url = 'https://api.spotify.com/v1/me/player/next';
      method = 'POST';
    } else if (action === 'prev') {
      url = 'https://api.spotify.com/v1/me/player/previous';
      method = 'POST';
    }

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body
    });

    return { success: res.ok || res.status === 204, method: 'web_api' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function logoutSpotify() {
  config.saveConfig({ spotifyAuth: null, spotifyCachedPlaylists: [] });
  return { success: true };
}

let playDl = null;
let distubeYtdl = null;

function getAudioResolvers() {
  if (!playDl) {
    try { playDl = require('play-dl'); } catch (e) { console.warn('play-dl load error:', e); }
  }
  if (!distubeYtdl) {
    try {
      const { Ytdl } = require('@distube/ytdl-core');
      distubeYtdl = new Ytdl();
    } catch (e) {
      console.warn('@distube/ytdl-core load error:', e);
    }
  }
  return { playDl, distubeYtdl };
}

const audioCache = new Map();

function cleanSearchQuery(title, artist = '') {
  const cleanTitle = (title || '')
    .replace(/\s*[\(\[](feat\.|ft\.|with|remastered|version|deluxe|radio edit|live).*?[\)\]]/gi, '')
    .replace(/\s*-\s*(remastered|live|radio edit|deluxe|version|\d{4}\s*remaster).*$/gi, '')
    .replace(/["']/g, '')
    .trim();
  const cleanArtist = (artist || '').split(',')[0].trim();
  return (cleanArtist ? `${cleanArtist} - ` : '') + (cleanTitle || title);
}

async function searchYouTubeVideoIds(query) {
  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    });
    if (!res.ok) return [];
    const html = await res.text();
    const videoIdMatches = [...html.matchAll(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g)].map(m => m[1]);
    return [...new Set(videoIdMatches)].slice(0, 4);
  } catch (_) {
    return [];
  }
}

async function resolveTrackAudio(title, artist = '') {
  const cacheKey = `${artist}_${title}`.toLowerCase().trim();
  if (audioCache.has(cacheKey)) {
    const cached = audioCache.get(cacheKey);
    if (Date.now() - cached.timestamp < 2 * 60 * 60 * 1000) {
      return cached.data;
    }
  }

  const { playDl: p, distubeYtdl: y } = getAudioResolvers();
  const query = cleanSearchQuery(title, artist);

  let candidateUrls = [];
  const scrapedIds = await searchYouTubeVideoIds(query);
  if (scrapedIds.length > 0) {
    candidateUrls = scrapedIds.map(id => `https://www.youtube.com/watch?v=${id}`);
  }

  if (candidateUrls.length === 0 && p) {
    try {
      const pResults = await p.search(query, { limit: 3 });
      if (pResults && pResults.length > 0) {
        candidateUrls = pResults.map(v => v.url);
      }
    } catch (_) {}
  }

  if (candidateUrls.length === 0) {
    throw new Error(`Nie znaleziono utworu dla: ${query}`);
  }

  let lastError = null;
  for (const videoUrl of candidateUrls.slice(0, 3)) {
    try {
      if (y) {
        const info = await y.getInfo(videoUrl);
        const audioFormats = info.formats.filter(f => f.hasAudio && !f.hasVideo);
        const bestAudio = audioFormats.find(f => f.container === 'mp4') || audioFormats[0];

        if (bestAudio && bestAudio.url) {
          const result = {
            streamUrl: bestAudio.url,
            title: info.videoDetails?.title || title,
            duration: parseInt(info.videoDetails?.lengthSeconds, 10) || 0,
            videoUrl
          };
          audioCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
        }
      }

      if (p) {
        const streamData = await p.stream(videoUrl);
        if (streamData && streamData.url) {
          const result = {
            streamUrl: streamData.url,
            title: title,
            duration: 0,
            videoUrl
          };
          audioCache.set(cacheKey, { timestamp: Date.now(), data: result });
          return result;
        }
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(lastError ? lastError.message : `Brak dostępnego strumienia audio dla: ${title}`);
}

async function getPublicSpotifyPlaylist(urlOrId) {
  if (!urlOrId) throw new Error('Brak linku do playlisty');
  const match = urlOrId.match(/(playlist|album|track|artist)[\/:]([a-zA-Z0-9]+)/);
  const type = match ? match[1] : 'playlist';
  const id = match ? match[2] : urlOrId.trim();

  const res = await fetch(`https://open.spotify.com/embed/${type}/${id}`);
  if (!res.ok) throw new Error(`Nie udało się otworzyć playlisty Spotify (${res.status})`);

  const html = await res.text();
  const jsonMatch = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>(.*?)<\/script>/);
  if (!jsonMatch) throw new Error('Nie znaleziono metadanych playlisty Spotify.');

  const parsed = JSON.parse(jsonMatch[1]);
  const entity = parsed.props?.pageProps?.state?.data?.entity;
  if (!entity) throw new Error('Pusta playlista Spotify.');

  const rawTracks = entity.trackList || (entity.type === 'track' ? [entity] : []);
  const tracks = rawTracks.map(t => ({
    title: t.title || 'Nieznany utwór',
    artist: t.subtitle || (t.artists ? t.artists.map(a => a.name).join(', ') : ''),
    durationMs: t.duration || 0,
    uri: t.uri || ''
  }));

  const coverUrl = entity.visualIdentity?.image?.[0]?.url || entity.images?.[0]?.url || null;

  const result = {
    id: entity.id || id,
    name: entity.name || entity.title || 'Playlista Spotify',
    type: entity.type || type,
    coverUrl,
    tracks
  };

  if (typeof urlOrId === 'string' && (urlOrId.includes('spotify.com/') || urlOrId.startsWith('spotify:playlist:') || /^[a-zA-Z0-9]{20,25}$/.test(urlOrId.trim()))) {
    saveImportedPlaylist(result);
  }

  return result;
}

async function searchTracks(query) {
  if (!query || !query.trim()) return [];
  const { playDl: p } = getAudioResolvers();
  try {
    if (p) {
      const results = await p.search(query.trim(), { limit: 8 });
      if (results && results.length > 0) {
        return results.map(v => {
          const rawTitle = v.title || 'Utwór';
          const parts = rawTitle.includes(' - ') ? rawTitle.split(' - ') : [v.channel?.name || '', rawTitle];
          const artist = parts.length > 1 ? parts[0].trim() : (v.channel?.name || '');
          const title = parts.length > 1 ? parts.slice(1).join(' - ').trim() : rawTitle;
          return {
            id: v.id || rawTitle,
            title,
            artist,
            durationMs: (v.durationInSec || 0) * 1000,
            coverUrl: v.thumbnails?.[0]?.url || null
          };
        });
      }
    }
  } catch (_) {}

  try {
    const ids = await searchYouTubeVideoIds(query);
    return ids.map(id => ({
      id,
      title: query,
      artist: '',
      durationMs: 180000,
      coverUrl: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
    }));
  } catch (_) {
    return [];
  }
}

module.exports = {
  loginWithSpotify,
  logoutSpotify,
  getUserPlaylists,
  getAccountPlaylistsBundle,
  saveImportedPlaylist,
  removeImportedPlaylist,
  setSpotifyClientId,
  getPlaylistTracks,
  controlSpotifyWeb,
  fetchUserProfile,
  refreshAccessToken,
  getMprisStatus,
  launchSpotifyApp,
  formatSpotifyUri,
  resolveTrackAudio,
  getPublicSpotifyPlaylist,
  searchTracks
};
