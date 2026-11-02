const { app, BrowserWindow, ipcMain, dialog, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const auth = require('./auth');
const launcher = require('./launcher');
const mojang = require('./mojang');
const mods = require('./mods');
const profiles = require('./profiles');
const friends = require('./friends');
const serverHost = require('./server');
const serverPlugins = require('./serverPlugins');
const discord = require('./discord');
const stats = require('./stats');
const spotify = require('./spotify');
const screenshots = require('./screenshots');
const updater = require('./updater');
const presence = require('./presence');

let mainWindow = null;
let isRestartingApp = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 740,
    minWidth: 980,
    minHeight: 620,
    frame: false,
    resizable: true,
    show: false,
    icon: path.join(__dirname, '../renderer/assets/icon-256.png'),
    backgroundColor: '#08090c',
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
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  updater.initUpdater(mainWindow);
  presence.initPresence(mainWindow);
  discord.initDiscordRPC();

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
  try { serverHost.stopServer(); } catch (_) {}
  try {
    fs.writeFileSync(CURRENT_TRACK_PATH, JSON.stringify({ active: false, isPlaying: false, timestamp: Date.now() }), 'utf8');
  } catch (e) {}
});

app.on('window-all-closed', () => {
  if (isRestartingApp) return;
  discord.destroyDiscordRPC();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('app:restart', async () => {
  isRestartingApp = true;
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    mainWindow = null;
  } catch (err) {
    console.error('[MAIN] Błąd zamykania okna przy restarcie:', err);
  }
  setTimeout(() => {
    try {
      createWindow();
    } finally {
      isRestartingApp = false;
    }
  }, 550);
  return { success: true };
});

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('window:focus', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (!mainWindow.isFocused()) {
      mainWindow.focus();
    }
  }
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

ipcMain.handle('auth:set-custom-skin', async (_e, skinUrl, variant) => {
  return await auth.setAccountCustomSkin(skinUrl, variant);
});

ipcMain.handle('auth:set-mojang-cape', async (_e, capeIdOrUrl) => {
  return await auth.setOfficialMojangCape(capeIdOrUrl);
});

ipcMain.handle('auth:get-skin-url', async (_e, username) => {
  return await auth.getSkinUrlForUsername(username);
});

ipcMain.handle('auth:select-skin-file', async (_e, variant) => {
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
    return await auth.setAccountCustomSkin(dataUrl, variant);
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
  const isWin = process.platform === 'win32';
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: isWin ? 'Wskaż plik wykonywalny Java (javaw.exe / java.exe)' : 'Wskaż plik wykonywalny Java (np. /usr/bin/java)',
    filters: isWin
      ? [
          { name: 'Pliki wykonywalne Java (*.exe)', extensions: ['exe'] },
          { name: 'Wszystkie pliki', extensions: ['*'] }
        ]
      : []
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('stats:get', async () => {
  const s = stats.getStats();
  const acc = config.getActiveAccount();
  return {
    ...s,
    rankTitle: stats.getRankTitle(s.totalPlaytimeMinutes, acc?.username || acc?.name, acc?.uuid || acc?.id)
  };
});

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

ipcMain.handle('game:get-versions', async () => {
  return await mojang.getAvailableVersions();
});

ipcMain.handle('profiles:get-state', async () => {
  return profiles.getProfilesState();
});

ipcMain.handle('profiles:select', async (_e, profileId) => {
  return profiles.setActiveProfile(profileId);
});

ipcMain.handle('profiles:create', async (_e, payload) => {
  return profiles.createProfile(payload);
});

ipcMain.handle('profiles:update', async (_e, profileId, updates) => {
  return profiles.updateProfile(profileId, updates);
});

ipcMain.handle('profiles:duplicate', async (_e, profileId) => {
  return profiles.duplicateProfile(profileId);
});

ipcMain.handle('profiles:delete', async (_e, profileId) => {
  return profiles.deleteProfile(profileId);
});

ipcMain.handle('profiles:open-folder', async (_e, profileId) => {
  return profiles.openProfileFolder(profileId);
});

ipcMain.handle('mods:install-quilt', async (_e, version) => {
  return await mods.installQuilt(version);
});

ipcMain.handle('game:launch', async (_e, version) => {
  return await launcher.launchMinecraft(mainWindow, version);
});

ipcMain.handle('game:is-launching', async () => {
  return launcher.getIsLaunching();
});

ipcMain.handle('game:get-jvm-presets', () => {
  return launcher.JVM_PRESETS;
});

ipcMain.handle('system:get-specs', () => {
  const os = require('os');
  const totalRamGb = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeRamGb = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const cpus = os.cpus() ? os.cpus().length : 4;
  return {
    totalRamGb,
    freeRamGb,
    cpus
  };
});

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

ipcMain.handle('mods:get-modrinth-versions', async (_e, idOrSlug) => {
  return await mods.getModrinthProjectVersions(idOrSlug);
});

ipcMain.handle('mods:install-modrinth', async (_e, params) => {
  return await mods.installModrinthMod(params);
});

ipcMain.handle('mods:update-all', async (_e, params) => {
  return await mods.updateInstalledMods(params);
});

ipcMain.handle('mods:install-modpack', async (event, params) => {
  return await mods.installModrinthModpack({
    ...params,
    onProgress: (prog) => {
      try {
        event.sender.send('mods:modpack-progress', prog);
      } catch (_) {}
    }
  });
});

ipcMain.handle('profiles:export-mrpack', async (_e, profileId) => {
  return await mods.exportProfileToMrpack(mainWindow, profileId);
});

ipcMain.handle('profiles:import-mrpack', async (event, explicitPath) => {
  return await mods.importMrpackFromFile(mainWindow, explicitPath, (prog) => {
    try {
      event.sender.send('mods:modpack-progress', prog);
    } catch (_) {}
  });
});

ipcMain.handle('packs:get-list', async (_e, type) => {
  return mods.getPacksList(type);
});

ipcMain.handle('packs:install-modrinth', async (_e, params) => {
  return await mods.installModrinthPack(params);
});

ipcMain.handle('packs:add-files', async (_e, type) => {
  return await mods.selectAndAddPacks(mainWindow, type);
});

ipcMain.handle('packs:copy-files', async (_e, type, paths) => {
  return mods.copyPackPaths(type, paths);
});

ipcMain.handle('packs:toggle', async (_e, type, filename) => {
  return mods.togglePack(type, filename);
});

ipcMain.handle('packs:delete', async (_e, type, filename) => {
  return mods.deletePack(type, filename);
});

ipcMain.handle('packs:open-folder', async (_e, type) => {
  return mods.openPacksFolder(type);
});

ipcMain.handle('music:get-lyrics', async (_e, title, artist) => {
  if (!title) return null;
  const cleanTitle = String(title).replace(/\s*\((feat|ft|official|video|audio|lyrics).*?\)/gi, '').trim();
  const cleanArtist = String(artist || '').split(',')[0].replace(/^🟢\s*Spotify\s*•\s*/i, '').trim();
  const headers = { 'User-Agent': 'KasteuszLauncher/2.4.0 (https://szkolnesmp.com.pl)' };

  try {
    if (cleanArtist && !/radio|stream|lofi|synthwave|ambient/i.test(cleanArtist)) {
      const getUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
      const res = await fetch(getUrl, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && (data.syncedLyrics || data.plainLyrics)) {
          return {
            syncedLyrics: data.syncedLyrics || null,
            plainLyrics: data.plainLyrics || null,
            trackName: data.trackName || cleanTitle,
            artistName: data.artistName || cleanArtist
          };
        }
      }
    }

    const q = `${cleanTitle} ${cleanArtist}`.trim();
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`;
    const sRes = await fetch(searchUrl, { headers });
    if (sRes.ok) {
      const arr = await sRes.json();
      if (Array.isArray(arr) && arr.length > 0) {
        const best = arr.find(item => item.syncedLyrics) || arr.find(item => item.plainLyrics);
        if (best) {
          return {
            syncedLyrics: best.syncedLyrics || null,
            plainLyrics: best.plainLyrics || null,
            trackName: best.trackName || cleanTitle,
            artistName: best.artistName || cleanArtist
          };
        }
      }
    }
  } catch (_) {}
  return null;
});

ipcMain.handle('friends:get', async () => {
  return friends.getFriends();
});

ipcMain.handle('friends:add', async (_e, username) => {
  return friends.addFriend(username);
});

ipcMain.handle('friends:remove', async (_e, username) => {
  return friends.removeFriend(username);
});

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
  return serverHost.stopServer(mainWindow);
});

ipcMain.handle('server:open-folder', async () => {
  return serverHost.openServerFolder();
});

ipcMain.handle('server:start-tunnel', async (_e, customPort) => {
  return await serverHost.startPublicTunnel(mainWindow, customPort);
});

ipcMain.handle('server:stop-tunnel', async () => {
  return serverHost.stopPublicTunnel(mainWindow);
});

ipcMain.handle('server:send-cmd', async (_e, cmd) => {
  return serverHost.sendServerCommand(cmd);
});

ipcMain.handle('server:get-status', async () => {
  return serverHost.getServerStatus();
});

ipcMain.handle('server:get-metrics', async () => {
  return await serverHost.getServerMetrics();
});

ipcMain.handle('server:get-plugins', async () => {
  return await serverPlugins.getServerPlugins();
});

ipcMain.handle('server:search-plugins', async (_e, opts) => {
  return await serverPlugins.searchServerPlugins(opts);
});

ipcMain.handle('server:install-plugin', async (_e, opts) => {
  return await serverPlugins.installServerPlugin({ ...opts, window: mainWindow });
});

ipcMain.handle('server:toggle-plugin', async (_e, filename) => {
  return await serverPlugins.toggleServerPlugin(filename);
});

ipcMain.handle('server:delete-plugin', async (_e, filename) => {
  return await serverPlugins.deleteServerPlugin(filename);
});

ipcMain.handle('server:open-plugins-folder', async () => {
  return serverPlugins.openServerPluginsFolder();
});

ipcMain.on('system:open-external', (_e, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

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
    user: authData?.user || null,
    clientId: cfg?.spotifyClientId || '',
    usingCustomClientId: !!(cfg?.spotifyClientId && cfg.spotifyClientId.trim())
  };
});

ipcMain.handle('spotify:set-client-id', async (_e, clientId) => {
  return spotify.setSpotifyClientId(clientId);
});

ipcMain.handle('spotify:remove-playlist', async (_e, playlistId) => {
  return spotify.removeImportedPlaylist(playlistId);
});

ipcMain.handle('spotify:get-mpris-status', async () => {
  return await spotify.getMprisStatus();
});

ipcMain.handle('spotify:get-playlists', async () => {
  return await spotify.getAccountPlaylistsBundle(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('spotify:playlists-updated');
    }
  });
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

ipcMain.handle('spotify:search-tracks', async (_e, query) => {
  return await spotify.searchTracks(query);
});

ipcMain.handle('spotify:control', async (_e, arg1, arg2) => {
  const action = typeof arg1 === 'object' && arg1 !== null ? arg1.action : arg1;
  const uri = typeof arg1 === 'object' && arg1 !== null ? arg1.uri : arg2;
  return await spotify.controlSpotifyWeb(action, uri);
});

const CURRENT_TRACK_PATH = path.join(config.APP_DIR, 'current_track.json');
const MUSIC_COMMAND_PATH = path.join(config.APP_DIR, 'music_command.json');
let lastProcessedCommandTime = Date.now();

setInterval(() => {
  try {
    if (fs.existsSync(MUSIC_COMMAND_PATH)) {
      const content = fs.readFileSync(MUSIC_COMMAND_PATH, 'utf8');
      if (content && content.trim()) {
        const cmd = JSON.parse(content);
        if (cmd && cmd.timestamp && cmd.timestamp > lastProcessedCommandTime) {
          lastProcessedCommandTime = cmd.timestamp;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('music:action', cmd.action, cmd.value);
          }
          if (cmd.action) {
            spotify.controlSpotifyWeb(cmd.action).catch(() => {});
          }
        }
      }
    }
  } catch (_) {}
}, 100);

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

ipcMain.handle('screenshots:get-list', async (_e, profileId) => {
  return await screenshots.getScreenshots(profileId);
});

ipcMain.handle('screenshots:get-thumbnail', async (_e, filePath) => {
  return await screenshots.getScreenshotThumbnail(filePath);
});

ipcMain.handle('screenshots:get-full', async (_e, filePath) => {
  return await screenshots.getScreenshotFull(filePath);
});

ipcMain.handle('screenshots:copy', async (_e, filePath) => {
  return await screenshots.copyScreenshotToClipboard(filePath);
});

ipcMain.handle('screenshots:delete', async (_e, filePath) => {
  return await screenshots.deleteScreenshot(filePath);
});

ipcMain.handle('screenshots:open-folder', async (_e, profileId) => {
  return await screenshots.openScreenshotsFolder(profileId);
});

ipcMain.handle('screenshots:open-file', async (_e, filePath) => {
  return await screenshots.openScreenshotFile(filePath);
});

const crashDoctor = require('./crashDoctor');

ipcMain.handle('crash:diagnose', async (_e, profileId) => {
  return await crashDoctor.diagnose(profileId);
});

ipcMain.handle('crash:execute-fix', async (_e, actionId, payload) => {
  return await crashDoctor.executeFix(actionId, payload);
});

ipcMain.handle('crash:open-folder', async (_e, profileId) => {
  return await crashDoctor.executeFix('open_crash_folder', { profileId });
});

const benchmark = require('./benchmark');

ipcMain.handle('benchmark:get-specs', async () => {
  return benchmark.getDetailedSystemSpecs();
});

ipcMain.handle('benchmark:run', async () => {
  return await benchmark.runSyntheticBenchmark();
});

ipcMain.handle('benchmark:get-optimal', async (_e, profileId) => {
  return await benchmark.getOptimalConfig(profileId);
});

ipcMain.handle('benchmark:apply', async (_e, payload, profileId) => {
  return await benchmark.applyOptimalSettings(payload, profileId);
});

updater.setupUpdaterIpc();
presence.setupPresenceIpc();
