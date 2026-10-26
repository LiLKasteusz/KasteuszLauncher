const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const auth = require('./auth');
const mods = require('./mods');
const discord = require('./discord');
const stats = require('./stats');

const FPS_BOOST_JVM_FLAGS = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1',
  '-XX:+UseStringDeduplication',
  '-Dsun.rmi.dgc.server.gcInterval=2147483646',
  '-Dsun.rmi.dgc.client.gcInterval=2147483646'
];

function applyFpsBoostOptions(rootDir) {
  try {
    const optionsPath = path.join(rootDir, 'options.txt');
    let content = '';
    if (fs.existsSync(optionsPath)) {
      content = fs.readFileSync(optionsPath, 'utf8');
    }
    
    const settings = {
      'renderClouds': '"false"',
      'entityShadows': 'false',
      'particles': '2',
      'enableVsync': 'false',
      'maxFps': '260',
      'graphicsMode': '1',
      'ao': '0'
    };

    let lines = content ? content.split('\n') : [];
    for (const [key, val] of Object.entries(settings)) {
      const idx = lines.findIndex(l => l.startsWith(key + ':'));
      if (idx >= 0) {
        lines[idx] = `${key}:${val}`;
      } else {
        lines.push(`${key}:${val}`);
      }
    }
    fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
  } catch (err) {
    console.warn('Nie udało się zoptymalizować options.txt:', err.message);
  }
}

function ensureVersionJsonArguments(rootDir, versionId) {
  try {
    const versionJsonPath = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) return;

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

    if (!versionJson.arguments || !Array.isArray(versionJson.arguments.game) || versionJson.arguments.game.length === 0) {
      let baseVer = versionJson.inheritsFrom;
      if (!baseVer && versionId.startsWith('fabric-')) {
        baseVer = versionId.replace(/^fabric-/, '');
      }
      if (!baseVer) {
        const match = versionId.match(/(\d+\.\d+(\.\d+)?)/);
        if (match) baseVer = match[1];
      }

      if (baseVer) {
        const baseJsonPath = path.join(rootDir, 'versions', baseVer, `${baseVer}.json`);
        if (fs.existsSync(baseJsonPath)) {
          const baseJson = JSON.parse(fs.readFileSync(baseJsonPath, 'utf8'));
          if (baseJson.arguments && Array.isArray(baseJson.arguments.game) && baseJson.arguments.game.length > 0) {
            versionJson.arguments = versionJson.arguments || {};
            versionJson.arguments.game = baseJson.arguments.game;
            if (baseJson.arguments.jvm && Array.isArray(baseJson.arguments.jvm)) {
              const existingJvm = Array.isArray(versionJson.arguments.jvm) ? versionJson.arguments.jvm : [];
              versionJson.arguments.jvm = [...baseJson.arguments.jvm, ...existingJvm];
            }
            if (!versionJson.assetIndex && baseJson.assetIndex) {
              versionJson.assetIndex = baseJson.assetIndex;
            }
            if (!versionJson.assets && baseJson.assets) {
              versionJson.assets = baseJson.assets;
            }
            fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2), 'utf8');
            console.log(`[KasteuszLauncher] Naprawiono argumenty gry w pliku JSON dla wersji ${versionId}`);
          }
        }
      }
    }
  } catch (err) {
    console.warn(`[KasteuszLauncher] Błąd weryfikacji JSON wersji ${versionId}:`, err);
  }
}

let activeLauncherClient = null;
let isLaunching = false;

async function launchMinecraft(window, versionOverride) {
  if (isLaunching) {
    throw new Error('Minecraft jest już w trakcie uruchamiania.');
  }

  const account = config.getActiveAccount();
  if (!account) {
    throw new Error('Musisz się najpierw zalogować na konto!');
  }

  // Odświeżanie tokena jeśli wygasa
  let currentAccount = account;
  if (account.isPremium && account.msRefreshToken && account.expiresAt) {
    const timeRemaining = account.expiresAt - Date.now();
    if (timeRemaining < 10 * 60 * 1000) { // mniej niż 10 minut
      try {
        window?.webContents.send('launcher:status', { message: 'Odświeżanie sesji konta Microsoft...' });
        currentAccount = await auth.refreshAccountToken(account);
      } catch (err) {
        console.warn('Błąd podczas odświeżania tokena:', err);
        if (timeRemaining <= 0) {
          throw new Error('Sesja konta Microsoft wygasła. Kliknij swój profil w prawym górnym rogu i zaloguj się ponownie.');
        }
      }
    }
  }

  const appConfig = config.getConfig();
  let versionToLaunch = versionOverride || appConfig.selectedVersion || '1.20.4';

  isLaunching = true;
  activeLauncherClient = new Client();

  const rootDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  // Sprawdzamy czy w folderze mods są aktywne pliki .jar
  const modsDir = path.join(rootDir, 'mods');
  const hasActiveMods = fs.existsSync(modsDir) && fs.readdirSync(modsDir).some(f => f.endsWith('.jar'));

  if (hasActiveMods && !versionToLaunch.startsWith('fabric-')) {
    const baseVer = versionToLaunch.replace(/fabric-[^-]+-/, '');
    const fabricVerId = `fabric-${baseVer}`;
    const fabricJsonPath = path.join(rootDir, 'versions', fabricVerId, `${fabricVerId}.json`);

    window?.webContents.send('launcher:status', { message: `Wykryto mody! Włączanie silnika Fabric dla ${baseVer}...` });
    window?.webContents.send('launcher:log', {
      level: 'info',
      text: `[KasteuszLauncher Mody] Wykryto aktywne mody .jar. Uruchamianie z silnikiem Fabric ${baseVer}...`
    });

    if (!fs.existsSync(fabricJsonPath)) {
      try {
        await mods.installFabric(baseVer);
      } catch (err) {
        console.warn('Nie udało się zainstalować Fabric:', err);
      }
    }

    if (fs.existsSync(fabricJsonPath)) {
      versionToLaunch = fabricVerId;
    }
  }

  // Upewniamy się, że wersja posiada kompletne argumenty uruchomieniowe gry
  ensureVersionJsonArguments(rootDir, versionToLaunch);

  const isCustomVersion = versionToLaunch.startsWith('fabric-') || fs.existsSync(path.join(rootDir, 'versions', versionToLaunch, `${versionToLaunch}.json`));
  const versionObj = {
    number: versionToLaunch,
    type: 'release'
  };
  if (isCustomVersion) {
    versionObj.custom = versionToLaunch;
  }

  // Automatyczna optymalizacja ustawień graficznych Minecraft dla FPS
  if (appConfig.fpsBoostMode && appConfig.optimizeGameOptions) {
    applyFpsBoostOptions(rootDir);
  }

  window?.webContents.send('launcher:status', { message: `Przygotowywanie Minecraft ${versionToLaunch}...` });

  const customArgs = [];

  // Aplikowanie flag FPS Boost (G1GC + eliminacja lagów)
  if (appConfig.fpsBoostMode !== false) {
    customArgs.push(...FPS_BOOST_JVM_FLAGS);
    window?.webContents.send('launcher:log', {
      level: 'info',
      text: '[KasteuszLauncher FPS Boost] Aktywowano zoptymalizowany profil JVM (+50-150% FPS, zero lagów G1GC).'
    });
  }

  if (appConfig.customJvmArgs && appConfig.customJvmArgs.trim()) {
    customArgs.push(...appConfig.customJvmArgs.trim().split(/\s+/));
  }

  const playerName = currentAccount.username || currentAccount.name || 'Mcqueen420_';
  const playerUuid = currentAccount.uuid || '00000000000000000000000000000000';
  const playerToken = currentAccount.mcAccessToken || (currentAccount.isPremium ? '' : '0');
  const playerXuid = currentAccount.uhs || currentAccount.xuid || '';

  const launchOptions = {
    clientPackage: null,
    authorization: {
      access_token: playerToken,
      client_token: null,
      uuid: playerUuid,
      name: playerName,
      user_properties: '{}',
      meta: {
        type: currentAccount.isPremium ? 'msa' : 'mojang',
        xuid: playerXuid,
        demo: false
      }
    },
    root: rootDir,
    version: versionObj,
    memory: {
      max: `${appConfig.memoryMax || 4}G`,
      min: `${appConfig.memoryMin || 2}G`
    },
    javaPath: appConfig.javaPath || '/usr/bin/java',
    customArgs,
    window: {
      width: appConfig.resolutionWidth || 1280,
      height: appConfig.resolutionHeight || 720,
      fullscreen: !!appConfig.fullscreen
    },
    overrides: {
      gameDirectory: rootDir,
      maxSockets: 8
    }
  };

  return new Promise((resolve, reject) => {
    const safeSend = (channel, ...args) => {
      try {
        if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send(channel, ...args);
        }
      } catch (_) {}
    };

    activeLauncherClient.on('debug', (e) => {
      safeSend('launcher:log', { level: 'debug', text: e });
    });

    activeLauncherClient.on('data', (e) => {
      const line = e.toString().trim();
      safeSend('launcher:log', { level: 'info', text: line });

      // Dynamiczne wykrywanie stanu gry i serwera dla Discord RPC
      if (line.includes('Connecting to ')) {
        const match = line.match(/Connecting to\s+([a-zA-Z0-9.\-_]+)/i);
        if (match && match[1]) {
          const rawHost = match[1];
          const serverName = (rawHost === 'localhost' || rawHost === '127.0.0.1') ? 'Lokalny serwer' : rawHost;
          discord.setLauncherActivity({
            isPlaying: true,
            serverIp: serverName,
            statusDetails: `Gra na serwerze: ${serverName}`,
            gameVersion: versionToLaunch
          });
        }
      } else if (line.includes('Starting integrated minecraft server') || line.includes('Starting integrated server')) {
        discord.setLauncherActivity({
          isPlaying: true,
          serverIp: null,
          statusDetails: 'Tryb jednoosobowy (Singleplayer)',
          gameVersion: versionToLaunch
        });
      } else if (
        line.includes('Stopping singleplayer server') ||
        line.includes('Client disconnected with reason') ||
        line.includes('lost connection: Disconnected') ||
        line.includes('Disconnecting from previous connection') ||
        line.includes('Disconnected from server')
      ) {
        discord.setLauncherActivity({
          isPlaying: true,
          serverIp: null,
          statusDetails: 'W menu gry',
          gameVersion: versionToLaunch
        });
      }
    });

    activeLauncherClient.on('download-status', (e) => {
      safeSend('launcher:status', {
        message: `Pobieranie: ${e.type || 'plików'} (${e.name || ''})`
      });
    });

    activeLauncherClient.on('progress', (e) => {
      const percentage = e.total > 0 ? Math.round((e.task / e.total) * 100) : 0;
      safeSend('launcher:progress', {
        type: e.type,
        task: e.task,
        total: e.total,
        percentage
      });
    });

    activeLauncherClient.on('close', (code) => {
      isLaunching = false;
      const updatedStats = stats.recordClose();
      discord.setLauncherActivity({ isPlaying: false, serverIp: null, statusDetails: 'W menu launchera' });
      safeSend('launcher:closed', { code });
      safeSend('stats:updated', updatedStats);
    });

    activeLauncherClient.launch(launchOptions)
      .then(() => {
        isLaunching = false;
        const currentStats = stats.recordLaunch(versionToLaunch);
        discord.setLauncherActivity({
          isPlaying: true,
          serverIp: null,
          statusDetails: 'W menu gry',
          gameVersion: versionToLaunch
        });
        safeSend('launcher:started', { version: versionToLaunch });
        safeSend('stats:updated', currentStats);
        resolve({ success: true, version: versionToLaunch });
        if (appConfig.closeOnLaunch) {
          setTimeout(() => {
            if (window && !window.isDestroyed()) {
              window.close();
            }
          }, 3000);
        }
      })
      .catch((err) => {
        isLaunching = false;
        safeSend('launcher:error', { message: err.message });
        reject(err);
      });
  });
}

function getIsLaunching() {
  return isLaunching;
}

module.exports = {
  launchMinecraft,
  getIsLaunching
};
