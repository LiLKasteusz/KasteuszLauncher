const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),

  // Authentication
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

  // Configuration
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (data) => ipcRenderer.invoke('config:save', data),
  selectDirectory: () => ipcRenderer.invoke('config:select-directory'),
  selectJava: () => ipcRenderer.invoke('config:select-java'),

  // Game & Versions
  getVersions: () => ipcRenderer.invoke('game:get-versions'),
  launchGame: (version) => ipcRenderer.invoke('game:launch', version),
  isLaunching: () => ipcRenderer.invoke('game:is-launching'),

  // Mods Manager
  getModsList: () => ipcRenderer.invoke('mods:get-list'),
  addModFiles: () => ipcRenderer.invoke('mods:add-files'),
  copyModFiles: (paths) => ipcRenderer.invoke('mods:copy-files', paths),
  toggleMod: (filename) => ipcRenderer.invoke('mods:toggle', filename),
  deleteMod: (filename) => ipcRenderer.invoke('mods:delete', filename),
  openModsFolder: () => ipcRenderer.invoke('mods:open-folder'),
  installFabric: (version) => ipcRenderer.invoke('mods:install-fabric', version),
  installSodium: (version) => ipcRenderer.invoke('mods:install-sodium', version),
  searchModrinth: (params) => ipcRenderer.invoke('mods:search-modrinth', params),
  installModrinthMod: (params) => ipcRenderer.invoke('mods:install-modrinth', params),

  // External Links
  openExternal: (url) => ipcRenderer.send('system:open-external', url),

  // Wardrobe & Capes
  selectCapeFile: () => ipcRenderer.invoke('wardrobe:select-cape'),

  // Player Stats & Playtime
  getStats: () => ipcRenderer.invoke('stats:get'),
  onStatsUpdated: (callback) => {
    const sub = (_event, val) => callback(val);
    ipcRenderer.on('stats:updated', sub);
    return () => ipcRenderer.removeListener('stats:updated', sub);
  },

  // Friends System
  getFriends: () => ipcRenderer.invoke('friends:get'),
  addFriend: (username) => ipcRenderer.invoke('friends:add', username),
  removeFriend: (username) => ipcRenderer.invoke('friends:remove', username),

  // Local Server Hosting
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

  // Events from Main Process
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

  // Spotify & In-Game Music Control
  spotifyLogin: (clientId) => ipcRenderer.invoke('spotify:login', clientId),
  spotifyLogout: () => ipcRenderer.invoke('spotify:logout'),
  spotifyGetStatus: () => ipcRenderer.invoke('spotify:get-status'),
  spotifyGetMprisStatus: () => ipcRenderer.invoke('spotify:get-mpris-status'),
  spotifyGetPlaylists: () => ipcRenderer.invoke('spotify:get-playlists'),
  spotifyGetTracks: (playlistId) => ipcRenderer.invoke('spotify:get-tracks', playlistId),
  spotifyGetPlaylistInfo: (urlOrId) => ipcRenderer.invoke('spotify:get-playlist-info', urlOrId),
  spotifyResolveAudio: (title, artist) => ipcRenderer.invoke('spotify:resolve-audio', title, artist),
  spotifyControl: (action, uri) => ipcRenderer.invoke('spotify:control', action, uri),
  updateMusicState: (state) => ipcRenderer.invoke('music:update-state', state),
  onMusicAction: (callback) => {
    const sub = (_event, action) => callback(action);
    ipcRenderer.on('music:action', sub);
    return () => ipcRenderer.removeListener('music:action', sub);
  }
});
