const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_DIR = path.join(os.homedir(), '.kasteuszlauncher');
const CONFIG_FILE = path.join(APP_DIR, 'config.json');
const AUTH_FILE = path.join(APP_DIR, 'auth.json');
const DEFAULT_GAME_DIR = path.join(APP_DIR, 'minecraft');

function ensureDirectories() {
  if (!fs.existsSync(APP_DIR)) {
    fs.mkdirSync(APP_DIR, { recursive: true });
  }
  if (!fs.existsSync(DEFAULT_GAME_DIR)) {
    fs.mkdirSync(DEFAULT_GAME_DIR, { recursive: true });
  }
}

function detectDefaultJava() {
  const commonPaths = [
    '/usr/bin/java',
    '/usr/lib/jvm/default/bin/java',
    '/usr/lib/jvm/java-21-openjdk/bin/java',
    '/usr/lib/jvm/java-17-openjdk/bin/java',
    'java'
  ];
  for (const p of commonPaths) {
    if (fs.existsSync(p)) return p;
  }
  return 'java';
}

const DEFAULT_CONFIG = {
  selectedVersion: '1.21.4',
  javaPath: detectDefaultJava(),
  memoryMin: 2,
  memoryMax: 4,
  gameDirectory: DEFAULT_GAME_DIR,
  closeOnLaunch: false,
  resolutionWidth: 1280,
  resolutionHeight: 720,
  fullscreen: false,
  customJvmArgs: '',
  fpsBoostMode: true,
  fpsPreset: 'ultra',
  optimizeGameOptions: true,
  themeAccent: 'purple',
  selectedCape: 'none',
  ambientGlow: true,
  animationSpeed: 0.6,
  discordRpcEnabled: true,
  discordClientId: '1564399095999897740',
  liveWallpaper: 'matrix',
  wallpaperOpacity: 0.6,
  uiSoundsEnabled: true,
  uiSoundsVolume: 0.4,
  musicPlayerEnabled: false,
  musicPlayerVolume: 0.4,
  musicPlayerStation: 'lofi',
  cosmetics: {
    backEquipment: 'cape',
    ears: false,
    halo: false
  },
  favoriteServers: [
    { name: 'Szkolne SMP', ip: 'szkolnesmp.com.pl', description: 'Oficjalny serwer Kasteusza (1.21.11)', isOfficial: true },
    { name: 'Hypixel', ip: 'mc.hypixel.net', description: 'Serwer minigier' }
  ]
};

function getConfig() {
  ensureDirectories();
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...DEFAULT_CONFIG, ...data };
    }
  } catch (err) {
    console.error('Błąd odczytu konfiguracji:', err);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(updates) {
  ensureDirectories();
  try {
    const current = getConfig();
    const updated = { ...current, ...updates };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Błąd zapisu konfiguracji:', err);
    throw err;
  }
}

function getAuth() {
  ensureDirectories();
  try {
    if (fs.existsSync(AUTH_FILE)) {
      return JSON.parse(fs.readFileSync(AUTH_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('Błąd odczytu autoryzacji:', err);
  }
  return { activeAccount: null, accounts: [] };
}

function saveAuth(authData) {
  ensureDirectories();
  try {
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), 'utf8');
    return authData;
  } catch (err) {
    console.error('Błąd zapisu autoryzacji:', err);
    throw err;
  }
}

function getActiveAccount() {
  const auth = getAuth();
  if (!auth.activeAccount) return null;
  const acc = auth.accounts.find(a => a.uuid === auth.activeAccount) || null;
  if (acc) {
    if (!acc.name && acc.username) acc.name = acc.username;
    if (!acc.username && acc.name) acc.username = acc.name;
  }
  return acc;
}

function setActiveAccount(uuid) {
  const auth = getAuth();
  auth.activeAccount = uuid;
  saveAuth(auth);
  return getActiveAccount();
}

function addOrUpdateAccount(account) {
  const auth = getAuth();
  const existingIdx = auth.accounts.findIndex(a => a.uuid === account.uuid);
  if (existingIdx >= 0) {
    auth.accounts[existingIdx] = { ...auth.accounts[existingIdx], ...account };
  } else {
    auth.accounts.push(account);
  }
  auth.activeAccount = account.uuid;
  saveAuth(auth);
  return account;
}

function removeAccount(uuid) {
  const auth = getAuth();
  auth.accounts = auth.accounts.filter(a => a.uuid !== uuid);
  if (auth.activeAccount === uuid) {
    auth.activeAccount = auth.accounts.length > 0 ? auth.accounts[0].uuid : null;
  }
  saveAuth(auth);
  return getActiveAccount();
}

module.exports = {
  APP_DIR,
  DEFAULT_GAME_DIR,
  getConfig,
  saveConfig,
  getAuth,
  saveAuth,
  getActiveAccount,
  setActiveAccount,
  addOrUpdateAccount,
  removeAccount
};
