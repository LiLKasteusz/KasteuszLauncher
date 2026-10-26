const DiscordRPC = require('discord-rpc');
const config = require('./config');

const DEFAULT_CLIENT_ID = '1557751696900489296';
let rpc = null;
let isConnected = false;
const launcherStartTime = new Date();
let gameStartTime = null;

let currentActivityParams = {
  username: '',
  isPlaying: false,
  serverIp: null,
  statusDetails: 'W menu launchera',
  gameVersion: '1.21.11'
};
let reconnectTimer = null;

function getClientId() {
  try {
    const userConfig = config.getConfig();
    return userConfig?.discordClientId || DEFAULT_CLIENT_ID;
  } catch (_) {
    return DEFAULT_CLIENT_ID;
  }
}

function initDiscordRPC() {
  if (rpc || isConnected) return;

  const clientId = getClientId();

  try {
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      isConnected = true;
      console.log('[Discord RPC] Zalogowano pomyślnie do Discord jako:', rpc.user?.username);

      const activeAccount = config.getActiveAccount();
      setLauncherActivity({
        username: activeAccount?.name || 'Gracz',
        isPlaying: false,
        serverIp: null,
        statusDetails: 'W menu launchera'
      });
    });

    rpc.on('disconnected', () => {
      isConnected = false;
      rpc = null;
      scheduleReconnect();
    });

    rpc.login({ clientId }).catch((_err) => {
      isConnected = false;
      rpc = null;
      scheduleReconnect();
    });
  } catch (err) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    initDiscordRPC();
  }, 15000);
}

function setLauncherActivity({ username, isPlaying = false, serverIp = null, statusDetails = null, gameVersion = '1.21.11' } = {}) {
  const activeAccount = config.getActiveAccount();
  const playerNick = username || activeAccount?.name || currentActivityParams.username || 'Gracz';
  const targetVer = gameVersion || currentActivityParams.gameVersion || '1.21.11';

  if (isPlaying && !currentActivityParams.isPlaying) {
    gameStartTime = new Date();
  } else if (!isPlaying) {
    gameStartTime = null;
  }

  currentActivityParams = {
    username: playerNick,
    isPlaying,
    serverIp: serverIp !== undefined ? serverIp : currentActivityParams.serverIp,
    statusDetails: statusDetails !== undefined ? statusDetails : (isPlaying ? currentActivityParams.statusDetails : 'W menu launchera'),
    gameVersion: targetVer
  };

  if (!rpc || !isConnected) return;

  let details = '';
  let state = `Gracz: ${playerNick}`;

  if (!isPlaying) {
    // Stan 1: Launcher otwarty, gra niewłączona - absolutnie brak IP serwera!
    details = currentActivityParams.statusDetails || 'W menu launchera';
    state = `Gracz: ${playerNick}`;
  } else {
    // Stan 2: Gra uruchomiona
    if (currentActivityParams.serverIp) {
      details = `Serwer: ${currentActivityParams.serverIp}`;
      state = `Gracz: ${playerNick}`;
    } else if (currentActivityParams.statusDetails) {
      details = currentActivityParams.statusDetails;
      state = `Gracz: ${playerNick}`;
    } else {
      details = `Minecraft ${targetVer}`;
      state = `Gracz: ${playerNick}`;
    }
  }

  const activity = {
    details,
    state,
    startTimestamp: isPlaying && gameStartTime ? gameStartTime : launcherStartTime,
    largeImageKey: 'icon',
    largeImageText: `Kasteusz Launcher ${targetVer}`,
    smallImageKey: 'logo',
    smallImageText: isPlaying ? (currentActivityParams.serverIp ? `Gra na ${currentActivityParams.serverIp}` : `Minecraft ${targetVer}`) : `Kasteusz Launcher`,
    instance: false
  };

  if (currentActivityParams.serverIp === 'szkolnesmp.com.pl') {
    activity.buttons = [
      { label: 'Szkolne SMP', url: 'https://szkolnesmp.com.pl' }
    ];
  } else {
    activity.buttons = [
      { label: 'Szkolne SMP', url: 'https://szkolnesmp.com.pl' }
    ];
  }

  rpc.setActivity(activity).catch(() => {});
}

function updateUsername(newNick) {
  setLauncherActivity({
    username: newNick,
    isPlaying: currentActivityParams.isPlaying,
    serverIp: currentActivityParams.serverIp,
    statusDetails: currentActivityParams.statusDetails
  });
}

function destroyDiscordRPC() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (rpc) {
    try {
      rpc.destroy();
    } catch (_) {}
    rpc = null;
    isConnected = false;
  }
}

module.exports = {
  initDiscordRPC,
  setLauncherActivity,
  updateUsername,
  destroyDiscordRPC
};
