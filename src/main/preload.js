const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  focusWindow: () => ipcRenderer.send('window:focus'),

  getActiveAccount: () => ipcRenderer.invoke('auth:get-active'),
  loginMicrosoft: () => ipcRenderer.invoke('auth:login-microsoft'),
  loginOffline: (username) => ipcRenderer.invoke('auth:login-offline', username),
  logout: () => ipcRenderer.invoke('auth:logout'),
  listAccounts: () => ipcRenderer.invoke('auth:list-accounts'),
  switchAccount: (uuid) => ipcRenderer.invoke('auth:switch-account', uuid),
  setUsername: (username) => ipcRenderer.invoke('auth:set-username', username),
  setCustomSkin: (skinUrl) => ipcRenderer.invoke('auth:set-custom-skin', skinUrl),
  getSkinUrl: (username) => ipcRenderer.invoke('auth:get-skin-url', username),
  selectSkinFile: () => ipcRenderer.invoke('auth:select-skin-file'),

  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  selectDirectory: () => ipcRenderer.invoke('config:select-directory'),
  selectJava: () => ipcRenderer.invoke('config:select-java'),

  getVersions: () => ipcRenderer.invoke('game:get-versions'),
  launchGame: (version) => ipcRenderer.invoke('game:launch', version),
  isLaunching: () => ipcRenderer.invoke('game:is-launching'),
  getJvmPresets: () => ipcRenderer.invoke('game:get-jvm-presets'),
  getSystemSpecs: () => ipcRenderer.invoke('system:get-specs'),
  getProfilesState: () => ipcRenderer.invoke('profiles:get-state'),
  selectProfile: (id) => ipcRenderer.invoke('profiles:select', id),
  createProfile: (payload) => ipcRenderer.invoke('profiles:create', payload),
  updateProfile: (id, updates) => ipcRenderer.invoke('profiles:update', id, updates),
  duplicateProfile: (id) => ipcRenderer.invoke('profiles:duplicate', id),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  openProfileFolder: (id) => ipcRenderer.invoke('profiles:open-folder', id),

  getModsList: () => ipcRenderer.invoke('mods:get-list'),
  addModFiles: () => ipcRenderer.invoke('mods:add-files'),
  copyModFiles: (paths) => ipcRenderer.invoke('mods:copy-files', paths),
  toggleMod: (filename) => ipcRenderer.invoke('mods:toggle', filename),
  deleteMod: (filename) => ipcRenderer.invoke('mods:delete', filename),
  openModsFolder: () => ipcRenderer.invoke('mods:open-folder'),
  installFabric: (version) => ipcRenderer.invoke('mods:install-fabric', version),
  installQuilt: (version) => ipcRenderer.invoke('mods:install-quilt', version),
  installSodium: (version) => ipcRenderer.invoke('mods:install-sodium', version),
  searchModrinth: (params) => ipcRenderer.invoke('mods:search-modrinth', params),
  getModrinthProjectVersions: (idOrSlug) => ipcRenderer.invoke('mods:get-modrinth-versions', idOrSlug),
  installModrinthMod: (params) => ipcRenderer.invoke('mods:install-modrinth', params),
  installModrinthModpack: (params) => ipcRenderer.invoke('mods:install-modpack', params),
  onModpackProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('mods:modpack-progress', handler);
    return () => ipcRenderer.removeListener('mods:modpack-progress', handler);
  },

  getPacksList: (type) => ipcRenderer.invoke('packs:get-list', type),
  addPackFiles: (type) => ipcRenderer.invoke('packs:add-files', type),
  copyPackFiles: (type, paths) => ipcRenderer.invoke('packs:copy-files', type, paths),
  togglePack: (type, filename) => ipcRenderer.invoke('packs:toggle', type, filename),
  deletePack: (type, filename) => ipcRenderer.invoke('packs:delete', type, filename),
  openPacksFolder: (type) => ipcRenderer.invoke('packs:open-folder', type),
  getLyrics: (title, artist) => ipcRenderer.invoke('music:get-lyrics', title, artist),

  openExternal: (url) => ipcRenderer.send('system:open-external', url),

  selectCapeFile: () => ipcRenderer.invoke('wardrobe:select-cape'),

  getStats: () => ipcRenderer.invoke('stats:get'),
  onStatsUpdated: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('stats:updated', sub);
    return () => ipcRenderer.removeListener('stats:updated', sub);
  },

  getFriends: () => ipcRenderer.invoke('friends:get'),
  addFriend: (username) => ipcRenderer.invoke('friends:add', username),
  removeFriend: (username) => ipcRenderer.invoke('friends:remove', username),

  getServerConfig: () => ipcRenderer.invoke('server:get-config'),
  saveServerConfig: (cfg) => ipcRenderer.invoke('server:save-config', cfg),
  startServer: () => ipcRenderer.invoke('server:start'),
  stopServer: () => ipcRenderer.invoke('server:stop'),
  sendServerCommand: (cmd) => ipcRenderer.invoke('server:send-cmd', cmd),
  getServerStatus: () => ipcRenderer.invoke('server:get-status'),
  onServerStatus: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('server:status', sub);
    return () => ipcRenderer.removeListener('server:status', sub);
  },
  onServerLog: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('server:log', sub);
    return () => ipcRenderer.removeListener('server:log', sub);
  },
  onServerDownloadProgress: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('server:download-progress', sub);
    return () => ipcRenderer.removeListener('server:download-progress', sub);
  },

  onLauncherStatus: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:status', sub);
    return () => ipcRenderer.removeListener('launcher:status', sub);
  },
  onLauncherProgress: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:progress', sub);
    return () => ipcRenderer.removeListener('launcher:progress', sub);
  },
  onLauncherLog: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:log', sub);
    return () => ipcRenderer.removeListener('launcher:log', sub);
  },
  onLauncherStarted: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:started', sub);
    return () => ipcRenderer.removeListener('launcher:started', sub);
  },
  onLauncherClosed: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:closed', sub);
    return () => ipcRenderer.removeListener('launcher:closed', sub);
  },
  onLauncherError: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('launcher:error', sub);
    return () => ipcRenderer.removeListener('launcher:error', sub);
  },

  spotifyLogin: (clientId) => ipcRenderer.invoke('spotify:login', clientId),
  spotifyLogout: () => ipcRenderer.invoke('spotify:logout'),
  spotifyGetStatus: () => ipcRenderer.invoke('spotify:get-status'),
  spotifySetClientId: (clientId) => ipcRenderer.invoke('spotify:set-client-id', clientId),
  spotifyRemovePlaylist: (id) => ipcRenderer.invoke('spotify:remove-playlist', id),
  spotifyGetMprisStatus: () => ipcRenderer.invoke('spotify:get-mpris-status'),
  spotifyGetPlaylists: () => ipcRenderer.invoke('spotify:get-playlists'),
  onSpotifyPlaylistsUpdated: (callback) => {
    const sub = () => callback();
    ipcRenderer.on('spotify:playlists-updated', sub);
    return () => ipcRenderer.removeListener('spotify:playlists-updated', sub);
  },
  spotifyGetTracks: (playlistId) => ipcRenderer.invoke('spotify:get-tracks', playlistId),
  spotifyGetPlaylistInfo: (urlOrId) => ipcRenderer.invoke('spotify:get-playlist-info', urlOrId),
  spotifySearchTracks: (query) => ipcRenderer.invoke('spotify:search-tracks', query),
  spotifyResolveAudio: (title, artist) => ipcRenderer.invoke('spotify:resolve-audio', title, artist),
  spotifyControl: (action, uri) => ipcRenderer.invoke('spotify:control', action, uri),
  updateMusicState: (state) => ipcRenderer.invoke('music:update-state', state),
  onMusicAction: (callback) => {
    const sub = (_event, action, value) => callback(action, value);
    ipcRenderer.on('music:action', sub);
    return () => ipcRenderer.removeListener('music:action', sub);
  },

  getScreenshots: (profileId) => ipcRenderer.invoke('screenshots:get-list', profileId),
  getScreenshotThumbnail: (filePath) => ipcRenderer.invoke('screenshots:get-thumbnail', filePath),
  getScreenshotFull: (filePath) => ipcRenderer.invoke('screenshots:get-full', filePath),
  copyScreenshot: (filePath) => ipcRenderer.invoke('screenshots:copy', filePath),
  deleteScreenshot: (filePath) => ipcRenderer.invoke('screenshots:delete', filePath),
  openScreenshotsFolder: (profileId) => ipcRenderer.invoke('screenshots:open-folder', profileId),
  openScreenshotFile: (filePath) => ipcRenderer.invoke('screenshots:open-file', filePath),

  diagnoseCrash: (profileId) => ipcRenderer.invoke('crash:diagnose', profileId),
  executeCrashFix: (actionId, payload) => ipcRenderer.invoke('crash:execute-fix', actionId, payload),
  openCrashFolder: (profileId) => ipcRenderer.invoke('crash:open-folder', profileId),
  onCrashDetected: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('crash:detected', sub);
    return () => ipcRenderer.removeListener('crash:detected', sub);
  },

  getDetailedSpecs: () => ipcRenderer.invoke('benchmark:get-specs'),
  runBenchmark: () => ipcRenderer.invoke('benchmark:run'),
  getOptimalConfig: (profileId) => ipcRenderer.invoke('benchmark:get-optimal', profileId),
  applyOptimalConfig: (payload, profileId) => ipcRenderer.invoke('benchmark:apply', payload, profileId)
});
