// KasteuszLauncher Spotify Integration Module (OAuth 2.0 PKCE Flow)
const { BrowserWindow } = require('electron');
const { exec } = require('child_process');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const config = require('./config');

const isFlatpak = fs.existsSync('/.flatpak-info');
const hostPrefix = isFlatpak ? 'flatpak-spawn --host ' : '';

const DEFAULT_SPOTIFY_CLIENT_ID = '65b708073fc0480ea92a077233ca87bd'; // Registered Spotify PKCE Client ID (Spotube/Desktop standard)
const REDIRECT_PORT = 4304;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/auth/spotify/callback`;
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

/**
 * Wymienia kod autoryzacji PKCE na token dostępu (access_token i refresh_token)
 */
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

/**
 * Odświeża access_token za pomocą refresh_token
 */
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

/**
 * Zwraca aktywny token, odświeżając go automatycznie jeśli wygasł
 */
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

/**
 * Rozpoczyna logowanie do konta Spotify (obsługuje Google login, Apple, login e-mail przez PKCE)
 */
async function loginWithSpotify(customClientId) {
  const cfg = config.getConfig();
  const clientId = customClientId || cfg?.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID;

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
        cleanup();
        resolve(spotifyData);
      } catch (err) {
        cleanup();
        reject(err);
      }
    }

    function checkRedirectUrl(rawUrl) {
      if (!rawUrl || handled) return false;
      if (rawUrl.includes('/auth/spotify/callback') || rawUrl.startsWith('spotube://callback')) {
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

    // Uruchomienie lokalnego mikroserwera HTTP do przechwycenia przekierowania
    try {
      localServer = http.createServer((req, res) => {
        const fullUrl = `http://localhost:${REDIRECT_PORT}${req.url}`;
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
        console.warn('[Spotify] Błąd nasłuchu na porcie 4304 (użyto fallbacku webContents):', err.message);
      });
    } catch (e) {
      console.warn('[Spotify] Nie udało się uruchomić serwera callback:', e);
    }

    // Przechwytywanie przekierowań w oknie Electron (will-navigate, will-redirect, did-fail-load)
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

/**
 * Pobiera profil użytkownika Spotify
 */
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

/**
 * Pobiera listę playlist użytkownika
 */
async function getUserPlaylists(tokenOverride) {
  const token = tokenOverride || await getValidToken();
  if (!token) throw new Error('Brak połączonego konta Spotify. Kliknij „Połącz ze Spotify”.');

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Token sesji Spotify wygasł. Kliknij „Połącz ze Spotify”, aby odświeżyć.');
    }
    throw new Error(`Błąd pobierania playlist (${res.status})`);
  }

  const data = await res.json();
  return (data.items || []).map(p => ({
    id: p.id,
    name: p.name,
    description: p.description || '',
    image: p.images?.[0]?.url || null,
    tracksCount: p.tracks?.total || 0,
    uri: p.uri,
    externalUrl: p.external_urls?.spotify || `https://open.spotify.com/playlist/${p.id}`,
    owner: p.owner?.display_name || ''
  }));
}

/**
 * Pobiera utwory z wybranej playlisty
 */
async function getPlaylistTracks(playlistId, tokenOverride) {
  const token = tokenOverride || await getValidToken();
  if (!token) throw new Error('Brak połączonego konta Spotify.');

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
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

/**
 * Uruchamia aplikację Spotify na pulpicie Linuxa jeśli nie jest uruchomiona
 */
function launchSpotifyApp() {
  return new Promise((resolve) => {
    exec(`${hostPrefix}flatpak run com.spotify.Client &`, (err) => {
      if (err) {
        exec(`${hostPrefix}spotify &`, () => resolve(true));
      } else {
        resolve(true);
      }
    });
  });
}

/**
 * Sprawdza status odtwarzania Spotify przez MPRIS (Desktop Linux)
 */
function getMprisStatus() {
  return new Promise((resolve) => {
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

/**
 * Konwertuje linki HTTP Spotify na URI spotify:type:id
 */
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

/**
 * Sterowanie aplikacją Spotify na Linuxie (MPRIS DBus)
 */
function sendLinuxMprisCommand(cmd, arg = '') {
  return new Promise((resolve) => {
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
    } else if (cmd === 'OpenUri' && arg) {
      bashCmd = `${hostPrefix}dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.OpenUri string:"${arg}"`;
    }

    if (!bashCmd) return resolve(false);

    exec(bashCmd, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Sterowanie odtwarzaczem Spotify Web API / Linux MPRIS
 */
async function controlSpotifyWeb(action, uri = null) {
  const formattedUri = uri ? formatSpotifyUri(uri) : null;

  // 1. Sprawdzamy stan Spotify na Linuxie (MPRIS)
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

  // 2. Fallback: Spotify Web API Connect jeśli token istnieje
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

/**
 * Odłączenie konta Spotify
 */
function logoutSpotify() {
  config.saveConfig({ spotifyAuth: null });
  return { success: true };
}

module.exports = {
  loginWithSpotify,
  logoutSpotify,
  getUserPlaylists,
  getPlaylistTracks,
  controlSpotifyWeb,
  fetchUserProfile,
  refreshAccessToken,
  getMprisStatus,
  launchSpotifyApp,
  formatSpotifyUri
};
