// KasteuszLauncher Spotify Integration Module
const { BrowserWindow } = require('electron');
const { exec } = require('child_process');
const config = require('./config');

const DEFAULT_SPOTIFY_CLIENT_ID = 'b27f4d436a5a40b99144421a71e84323'; // Standard Client ID for desktop integrations
const REDIRECT_URI = 'http://localhost:8888/callback';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read'
].join(' ');

/**
 * Rozpoczyna logowanie do konta Spotify w oknie Electron
 */
async function loginWithSpotify(customClientId) {
  const cfg = config.getConfig();
  const clientId = customClientId || cfg?.spotifyClientId || DEFAULT_SPOTIFY_CLIENT_ID;

  const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}&show_dialog=true`;

  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 520,
      height: 700,
      center: true,
      title: 'Logowanie do konta Spotify - KasteuszLauncher',
      autoHideMenuBar: true,
      backgroundColor: '#121212',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    let handled = false;

    function handleCallbackUrl(rawUrl) {
      if (!rawUrl || handled) return;
      if (rawUrl.startsWith(REDIRECT_URI) || rawUrl.includes('localhost:8888/callback')) {
        handled = true;
        try {
          const hashIdx = rawUrl.indexOf('#');
          const hash = hashIdx >= 0 ? rawUrl.substring(hashIdx + 1) : '';
          const params = new URLSearchParams(hash);
          const accessToken = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600', 10);
          const error = params.get('error');

          if (error) {
            authWin.destroy();
            reject(new Error(`Odrzucono logowanie Spotify: ${error}`));
            return;
          }

          if (accessToken) {
            const expiresAt = Date.now() + expiresIn * 1000;
            // Pobieramy dane profilu gracza ze Spotify
            fetchUserProfile(accessToken).then((profile) => {
              const spotifyData = {
                accessToken,
                expiresAt,
                user: profile
              };
              config.saveConfig({ spotifyAuth: spotifyData });
              authWin.destroy();
              resolve(spotifyData);
            }).catch(err => {
              console.warn('[Spotify] Błąd profilu po logowaniu:', err);
              const spotifyData = { accessToken, expiresAt, user: { displayName: 'Użytkownik Spotify' } };
              config.saveConfig({ spotifyAuth: spotifyData });
              authWin.destroy();
              resolve(spotifyData);
            });
            return;
          }
        } catch (e) {
          authWin.destroy();
          reject(e);
        }
      }
    }

    authWin.webContents.on('will-navigate', (_e, url) => handleCallbackUrl(url));
    authWin.webContents.on('will-redirect', (_e, url) => handleCallbackUrl(url));

    authWin.on('closed', () => {
      if (!handled) {
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
  const cfg = config.getConfig();
  const token = tokenOverride || cfg?.spotifyAuth?.accessToken;
  if (!token) throw new Error('Brak połączonego konta Spotify.');

  const res = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Token sesji Spotify wygasł. Zaloguj się ponownie.');
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
  const cfg = config.getConfig();
  const token = tokenOverride || cfg?.spotifyAuth?.accessToken;
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
 * Sterowanie aplikacją Spotify na Linuxie (MPRIS DBus)
 */
function sendLinuxMprisCommand(cmd, arg = '') {
  return new Promise((resolve) => {
    let bashCmd = '';
    if (cmd === 'PlayPause') {
      bashCmd = 'dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.PlayPause';
    } else if (cmd === 'Next') {
      bashCmd = 'dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Next';
    } else if (cmd === 'Previous') {
      bashCmd = 'dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.Previous';
    } else if (cmd === 'OpenUri' && arg) {
      bashCmd = `dbus-send --print-reply --dest=org.mpris.MediaPlayer2.spotify /org/mpris/MediaPlayer2 org.mpris.MediaPlayer2.Player.OpenUri string:"${arg}"`;
    }

    if (!bashCmd) return resolve(false);

    exec(bashCmd, (err) => {
      resolve(!err);
    });
  });
}

/**
 * Sterowanie odtwarzaczem Spotify Web API
 */
async function controlSpotifyWeb(action, uri = null) {
  const cfg = config.getConfig();
  const token = cfg?.spotifyAuth?.accessToken;

  // Najpierw próbujemy sterować natywnym Spotify na Linuxie jeśli jest uruchomione
  if (action === 'play' && uri) {
    const mprisSuccess = await sendLinuxMprisCommand('OpenUri', uri);
    if (mprisSuccess) return { success: true, method: 'mpris' };
  } else if (action === 'toggle') {
    const mprisSuccess = await sendLinuxMprisCommand('PlayPause');
    if (mprisSuccess) return { success: true, method: 'mpris' };
  } else if (action === 'next') {
    const mprisSuccess = await sendLinuxMprisCommand('Next');
    if (mprisSuccess) return { success: true, method: 'mpris' };
  } else if (action === 'prev') {
    const mprisSuccess = await sendLinuxMprisCommand('Previous');
    if (mprisSuccess) return { success: true, method: 'mpris' };
  }

  // Jeśli brak MPRIS, próbujemy przez oficjalne Spotify Web API Connect
  if (!token) return { success: false, reason: 'no_token' };

  try {
    let url = 'https://api.spotify.com/v1/me/player/play';
    let method = 'PUT';
    let body = undefined;

    if (action === 'play' && uri) {
      body = JSON.stringify(uri.includes(':playlist:') ? { context_uri: uri } : { uris: [uri] });
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

    return { success: res.ok || res.status === 204 };
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
  fetchUserProfile
};
