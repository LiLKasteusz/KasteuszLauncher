const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const auth = require('./auth');
const launcher = require('./launcher');
const mojang = require('./mojang');
const mods = require('./mods');
const friends = require('./friends');
const serverHost = require('./server');
const discord = require('./discord');
const stats = require('./stats');
const spotify = require('./spotify');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 630,
    minWidth: 920,
    minHeight: 580,
    frame: false,
    resizable: true,
    show: false,
    icon: path.join(__dirname, '../renderer/assets/icon-256.png'),
    backgroundColor: '#090a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.webContents.on('console-message', (event) => {
    console.log('[RENDERER CONSOLE]', event.message, 'at line', event.lineNumber);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[MAIN] did-finish-load');
  });

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.log('[MAIN] did-fail-load', code, desc);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  discord.initDiscordRPC();

  // Rejestracja globalnych skrótów klawiszowych do muzyki (działających w tle i w grze Minecraft)
  const registerShortcut = (key, action) => {
    try {
      globalShortcut.register(key, () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('music:action', action);
        }
        spotify.controlSpotifyWeb(action).catch(() => {});
      });
    } catch (err) {
      console.warn(`[Shortcut] Nie udało się zarejestrować skrótu ${key}:`, err.message);
    }
  };

  registerShortcut('MediaPlayPause', 'toggle');
  registerShortcut('CommandOrControl+Alt+Space', 'toggle');
  registerShortcut('MediaNextTrack', 'next');
  registerShortcut('CommandOrControl+Alt+Right', 'next');
  registerShortcut('MediaPreviousTrack', 'prev');
  registerShortcut('CommandOrControl+Alt+Left', 'prev');

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  try {
    fs.writeFileSync(CURRENT_TRACK_PATH, JSON.stringify({ active: false, isPlaying: false, timestamp: Date.now() }), 'utf8');
  } catch (e) {}
});

app.on('window-all-closed', () => {
  discord.destroyDiscordRPC();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC: Kontrolki okna
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

// IPC: Logowanie i autoryzacja
ipcMain.handle('auth:get-active', async () => {
  return config.getActiveAccount();
});

ipcMain.handle('auth:login-microsoft', async () => {
  const acc = await auth.loginWithMicrosoft();
  if (acc && acc.name) discord.setLauncherActivity({ username: acc.name, isPlaying: false, serverIp: null, statusDetails: 'W menu launchera' });
  return acc;
});

ipcMain.handle('auth:login-offline', async (_e, username) => {
  const acc = await auth.createOfflineAccount(username);
  if (acc && acc.name) discord.setLauncherActivity({ username: acc.name, isPlaying: false, serverIp: null, statusDetails: 'W menu launchera' });
  return acc;
});

ipcMain.handle('auth:set-username', async (_e, newUsername) => {
  const acc = await auth.setAccountUsernameAndSkin(newUsername);
  if (acc && acc.name) discord.updateUsername(acc.name);
  return acc;
});

ipcMain.handle('auth:set-custom-skin', async (_e, skinUrl) => {
  return await auth.setAccountCustomSkin(skinUrl);
});

ipcMain.handle('auth:get-skin-url', async (_e, username) => {
  return await auth.getSkinUrlForUsername(username);
});

ipcMain.handle('auth:select-skin-file', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz plik skórki Minecraft (.png)',
    filters: [
      { name: 'Skórka Minecraft', extensions: ['png'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const fileBuf = require('fs').readFileSync(filePath);
    const dataUrl = `data:image/png;base64,${fileBuf.toString('base64')}`;
    return await auth.setAccountCustomSkin(dataUrl);
  }
  return null;
});

ipcMain.handle('auth:logout', async () => {
  const active = config.getActiveAccount();
  if (active) {
    config.removeAccount(active.uuid);
  }
  return config.getActiveAccount();
});

ipcMain.handle('auth:list-accounts', async () => {
  const authData = config.getAuth();
  return authData.accounts || [];
});

ipcMain.handle('auth:switch-account', async (_e, uuid) => {
  return config.setActiveAccount(uuid);
});

// IPC: Ustawienia
ipcMain.handle('config:get', async () => {
  return config.getConfig();
});

ipcMain.handle('config:save', async (_e, data) => {
  const updated = config.saveConfig(data);
  if (data && (data.discordClientId !== undefined || data.discordRpcEnabled !== undefined)) {
    discord.reconfigureRPC();
  }
  return updated;
});

ipcMain.handle('config:select-directory', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Wybierz katalog gry Minecraft'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('config:select-java', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Wskaż plik wykonywalny Java (np. /usr/bin/java)'
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// IPC: Statystyki i Czas Gry
ipcMain.handle('stats:get', async () => {
  const s = stats.getStats();
  return {
    ...s,
    rankTitle: stats.getRankTitle(s.totalPlaytimeMinutes)
  };
});

// IPC: Wybór pliku pelerynki z dysku
ipcMain.handle('wardrobe:select-cape', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Wybierz plik pelerynki Minecraft (PNG 64x32 lub 128x64)',
    properties: ['openFile'],
    filters: [
      { name: 'Tekstura pelerynki (.png)', extensions: ['png'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const base64 = fs.readFileSync(filePath).toString('base64');
    return `data:image/png;base64,${base64}`;
  }
  return null;
});

// IPC: Minecraft i wersje
ipcMain.handle('game:get-versions', async () => {
  return await mojang.getAvailableVersions();
});

ipcMain.handle('game:launch', async (_e, version) => {
  return await launcher.launchMinecraft(mainWindow, version);
});

ipcMain.handle('game:is-launching', async () => {
  return launcher.getIsLaunching();
});

// IPC: Menedżer Modów
ipcMain.handle('mods:get-list', async () => {
  return mods.getInstalledMods();
});

ipcMain.handle('mods:add-files', async () => {
  return await mods.selectAndAddMods(mainWindow);
});

ipcMain.handle('mods:copy-files', async (_e, paths) => {
  return mods.copyModPaths(paths);
});

ipcMain.handle('mods:toggle', async (_e, filename) => {
  return mods.toggleMod(filename);
});

ipcMain.handle('mods:delete', async (_e, filename) => {
  return mods.deleteMod(filename);
});

ipcMain.handle('mods:open-folder', async () => {
  return mods.openModsFolder();
});

ipcMain.handle('mods:install-fabric', async (_e, version) => {
  return await mods.installFabric(version);
});

ipcMain.handle('mods:install-sodium', async (_e, version) => {
  return await mods.installSodium(version);
});

ipcMain.handle('mods:search-modrinth', async (_e, params) => {
  return await mods.searchModrinth(params);
});

ipcMain.handle('mods:install-modrinth', async (_e, params) => {
  return await mods.installModrinthMod(params);
});

// IPC: Znajomi
ipcMain.handle('friends:get', async () => {
  return friends.getFriends();
});

ipcMain.handle('friends:add', async (_e, username) => {
  return friends.addFriend(username);
});

ipcMain.handle('friends:remove', async (_e, username) => {
  return friends.removeFriend(username);
});

// IPC: Hostowanie Serwera z PC
ipcMain.handle('server:get-config', async () => {
  return serverHost.getServerConfig();
});

ipcMain.handle('server:save-config', async (_e, cfg) => {
  return serverHost.saveServerConfig(cfg);
});

ipcMain.handle('server:start', async () => {
  return await serverHost.startServer(mainWindow);
});

ipcMain.handle('server:stop', async () => {
  return serverHost.stopServer();
});

ipcMain.handle('server:send-cmd', async (_e, cmd) => {
  return serverHost.sendServerCommand(cmd);
});

ipcMain.handle('server:get-status', async () => {
  return serverHost.getServerStatus();
});

// IPC: Zewnętrzne linki
ipcMain.on('system:open-external', (_e, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// IPC: Spotify & Muzyka w tle
ipcMain.handle('spotify:login', async (_e, clientId) => {
  return await spotify.loginWithSpotify(clientId);
});

ipcMain.handle('spotify:logout', async () => {
  return spotify.logoutSpotify();
});

ipcMain.handle('spotify:get-status', async () => {
  const cfg = config.getConfig();
  const authData = cfg?.spotifyAuth || null;
  return {
    isLoggedIn: !!(authData && authData.accessToken),
    user: authData?.user || null
  };
});

ipcMain.handle('spotify:get-mpris-status', async () => {
  return await spotify.getMprisStatus();
});

ipcMain.handle('spotify:get-playlists', async () => {
  return await spotify.getUserPlaylists();
});

ipcMain.handle('spotify:get-tracks', async (_e, playlistId) => {
  return await spotify.getPlaylistTracks(playlistId);
});

ipcMain.handle('spotify:get-playlist-info', async (_e, urlOrId) => {
  return await spotify.getPublicSpotifyPlaylist(urlOrId);
});

ipcMain.handle('spotify:resolve-audio', async (_e, title, artist) => {
  return await spotify.resolveTrackAudio(title, artist);
});

ipcMain.handle('spotify:control', async (_e, arg1, arg2) => {
  const action = typeof arg1 === 'object' && arg1 !== null ? arg1.action : arg1;
  const uri = typeof arg1 === 'object' && arg1 !== null ? arg1.uri : arg2;
  return await spotify.controlSpotifyWeb(action, uri);
});

const CURRENT_TRACK_PATH = path.join(config.APP_DIR, 'current_track.json');

ipcMain.handle('music:update-state', async (_e, state) => {
  try {
    const data = JSON.stringify({
      active: !!state?.active,
      isPlaying: !!state?.isPlaying,
      title: state?.title || '',
      artist: state?.artist || '',
      positionMs: Number(state?.positionMs) || 0,
      durationMs: Number(state?.durationMs) || 0,
      timestamp: Date.now()
    });
    fs.writeFileSync(CURRENT_TRACK_PATH, data, 'utf8');
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
