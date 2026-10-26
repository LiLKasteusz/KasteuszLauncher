const DiscordRPC = require('discord-rpc');
const config = require('./config');

const CLIENT_ID = '1557751696900489296';
let rpc = null;
let isConnected = false;
const launcherStartTime = new Date();
let currentActivityParams = {
  username: '',
  isPlaying: false,
  serverIp: 'szkolnesmp.com.pl',
  gameVersion: '1.21.11'
};
let reconnectTimer = null;

function initDiscordRPC() {
  if (rpc || isConnected) return;

  try {
    rpc = new DiscordRPC.Client({ transport: 'ipc' });

    rpc.on('ready', () => {
      isConnected = true;
      console.log('[Discord RPC] Zalogowano pomyślnie do Discord jako:', rpc.user?.username);
      
      const activeAccount = config.getActiveAccount();
      setLauncherActivity({
        username: activeAccount?.name || 'Gracz',
        isPlaying: false,
        serverIp: 'szkolnesmp.com.pl'
      });
    });

    rpc.on('disconnected', () => {
      isConnected = false;
      rpc = null;
      scheduleReconnect();
    });

    rpc.login({ clientId: CLIENT_ID }).catch((_err) => {
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

function setLauncherActivity({ username, isPlaying = false, serverIp = 'szkolnesmp.com.pl', gameVersion = '1.21.11' } = {}) {
  const activeAccount = config.getActiveAccount();
  const playerNick = username || activeAccount?.name || currentActivityParams.username || 'Gracz';
  const targetIp = serverIp || currentActivityParams.serverIp || 'szkolnesmp.com.pl';
  const targetVer = gameVersion || currentActivityParams.gameVersion || '1.21.11';

  currentActivityParams = {
    username: playerNick,
    isPlaying,
    serverIp: targetIp,
    gameVersion: targetVer
  };

  if (!rpc || !isConnected) return;

  const activity = {
    details: `Serwer: ${targetIp}`,
    state: `Gracz: ${playerNick}`,
    startTimestamp: isPlaying ? new Date() : launcherStartTime,
    largeImageKey: 'icon',
    largeImageText: `KasteuszLauncher ${targetVer}`,
    smallImageKey: 'logo',
    smallImageText: isPlaying ? `Gra w Minecraft` : `Kasteusz Launcher`,
    instance: false,
    buttons: [
      { label: 'Szkolne SMP', url: 'https://szkolnesmp.com.pl' }
    ]
  };

  rpc.setActivity(activity).catch(() => {});
}

function updateUsername(newNick) {
  setLauncherActivity({
    username: newNick,
    isPlaying: currentActivityParams.isPlaying,
    serverIp: currentActivityParams.serverIp
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
