const { Client } = require('minecraft-launcher-core');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const auth = require('./auth');
const mods = require('./mods');
const profiles = require('./profiles');
const discord = require('./discord');
const stats = require('./stats');

const JVM_PRESETS = {
  ultra: {
    id: 'ultra',
    name: 'Ultra FPS (Generational ZGC)',
    desc: 'Java 21 Generational ZGC – pauzy GC < 1ms, ultra wysokie klatki, brak mikro-zacięć (Rekomendowany)',
    recommendedRam: 8,
    flags: [
      '-XX:+UseZGC',
      '-XX:+ZGenerational',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+AlwaysPreTouch',
      '-XX:+DisableExplicitGC',
      '-XX:AllocatePrefetchStyle=1',
      '-XX:-UsePerfData',
      '-XX:+UseNUMA',
      '-XX:+UseStringDeduplication',
      '-Dsun.rmi.dgc.server.gcInterval=2147483646',
      '-Dsun.rmi.dgc.client.gcInterval=2147483646'
    ]
  },
  g1gc: {
    id: 'g1gc',
    name: 'Stabilny (G1GC Aikar Tuned)',
    desc: 'Sprawdzony profil G1GC – zero lag-spikes, zoptymalizowany pod paczki modów i serwery SMP',
    recommendedRam: 6,
    flags: [
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
    ]
  },
  lowend: {
    id: 'lowend',
    name: 'Low-End PC (Oszczędny)',
    desc: 'Zminimalizowany narzut procesora i pamięci – stabilne klatki na laptopach i komputerach z 4–6 GB RAM',
    recommendedRam: 4,
    flags: [
      '-XX:+UseParallelGC',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:+AlwaysPreTouch',
      '-XX:+PerfDisableSharedMem',
      '-XX:-UsePerfData',
      '-XX:ParallelGCThreads=2',
      '-Dsun.rmi.dgc.client.gcInterval=3600000'
    ]
  },
  custom: {
    id: 'custom',
    name: 'Własny (Custom Flags)',
    desc: 'Własne parametry wirtualnej maszyny Java wpisane ręcznie',
    recommendedRam: 4,
    flags: []
  }
};

const FPS_BOOST_JVM_FLAGS = JVM_PRESETS.ultra.flags;

function resolveJavaExecutable(configuredPath) {
  if (configuredPath && fs.existsSync(configuredPath)) {
    return configuredPath;
  }
  const candidates = [
    '/home/lilkasteusz/.jdks/jdk-21.0.6+7/bin/java',
    path.join(process.env.HOME || '', '.jdks/jdk-21.0.6+7/bin/java'),
    '/usr/lib/jvm/java-21-openjdk/bin/java',
    '/usr/lib/jvm/java-21/bin/java',
    '/usr/bin/java'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  return configuredPath || 'java';
}

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
      'maxFps': '0',
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

function ensureKasteuszClientTheme(targetDir) {
  try {
    const srcPack = path.join(__dirname, 'assets', 'resourcepacks', 'KasteuszClient-Menu.zip');
    if (!fs.existsSync(srcPack)) return;

    const rpDir = path.join(targetDir, 'resourcepacks');
    if (!fs.existsSync(rpDir)) {
      fs.mkdirSync(rpDir, { recursive: true });
    }

    const dstPack = path.join(rpDir, 'KasteuszClient-Menu.zip');
    let shouldCopy = false;
    if (!fs.existsSync(dstPack)) {
      shouldCopy = true;
    } else {
      const srcStat = fs.statSync(srcPack);
      const dstStat = fs.statSync(dstPack);
      if (srcStat.size !== dstStat.size || srcStat.mtimeMs > dstStat.mtimeMs) {
        shouldCopy = true;
      }
    }

    if (shouldCopy) {
      fs.copyFileSync(srcPack, dstPack);
      console.log(`[KasteuszLauncher] Zsynchronizowano motyw KasteuszClient-Menu.zip w ${rpDir}`);
    }

    const optionsPath = path.join(targetDir, 'options.txt');
    let content = '';
    if (fs.existsSync(optionsPath)) {
      content = fs.readFileSync(optionsPath, 'utf8');
    }

    const packEntry = 'file/KasteuszClient-Menu.zip';
    let lines = content ? content.split('\n') : [];
    const rpIdx = lines.findIndex(l => l.startsWith('resourcePacks:'));

    if (rpIdx >= 0) {
      const raw = lines[rpIdx].replace(/^resourcePacks:/, '').trim();
      try {
        let list = JSON.parse(raw);
        if (Array.isArray(list)) {
          if (!list.includes(packEntry)) {
            list.push(packEntry);
            lines[rpIdx] = `resourcePacks:${JSON.stringify(list)}`;
            fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
          }
        }
      } catch (_) {}
    } else {
      lines.push(`resourcePacks:["vanilla",${JSON.stringify(packEntry)}]`);
      fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
    }
  } catch (err) {
    console.warn('[KasteuszLauncher] Błąd instalacji KasteuszClient-Menu:', err.message);
  }
}

function ensureKasteuszClientHudMod(targetDir) {
  try {
    const srcMod = path.join(__dirname, 'assets', 'mods', 'KasteuszClient-HUD-1.21.11.jar');
    const srcCfg = path.join(__dirname, 'assets', 'configs', 'hudplus.json');
    if (!fs.existsSync(srcMod)) return;

    const modsDir = path.join(targetDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const dstMod = path.join(modsDir, 'KasteuszClient-HUD-1.21.11.jar');
    let shouldCopy = false;
    if (!fs.existsSync(dstMod)) {
      shouldCopy = true;
    } else {
      const srcStat = fs.statSync(srcMod);
      const dstStat = fs.statSync(dstMod);
      if (srcStat.size !== dstStat.size || srcStat.mtimeMs > dstStat.mtimeMs) {
        shouldCopy = true;
      }
    }

    if (shouldCopy) {
      fs.copyFileSync(srcMod, dstMod);
      console.log(`[KasteuszLauncher] Zsynchronizowano mod KasteuszClient-HUD w ${modsDir}`);
    }

    // Skopiuj domyślną konfigurację z fioletowym motywem jeśli jeszcze nie istnieje
    const cfgDir = path.join(targetDir, 'config');
    if (!fs.existsSync(cfgDir)) {
      fs.mkdirSync(cfgDir, { recursive: true });
    }
    const dstCfg = path.join(cfgDir, 'hudplus.json');
    if (!fs.existsSync(dstCfg) && fs.existsSync(srcCfg)) {
      fs.copyFileSync(srcCfg, dstCfg);
      console.log(`[KasteuszLauncher] Zastosowano domyślny fioletowy motyw HUD w ${dstCfg}`);
    }
  } catch (err) {
    console.warn('[KasteuszLauncher] Błąd synchronizacji moda KasteuszClient-HUD:', err.message);
  }
}

function ensureVersionJsonArguments(rootDir, versionId) {
  try {
    const versionJsonPath = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) return;

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));

    if (!versionJson.arguments || !Array.isArray(versionJson.arguments.game) || versionJson.arguments.game.length === 0) {
      let baseVer = versionJson.inheritsFrom;
      if (!baseVer && (versionId.startsWith('fabric-') || versionId.startsWith('quilt-'))) {
        baseVer = versionId.replace(/^(fabric|quilt)-/, '');
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
  const activeProfile = profiles.getActiveProfile();
  const instanceDir = profiles.getActiveInstanceDirectory();

  isLaunching = true;
  activeLauncherClient = new Client();

  const rootDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  if (!fs.existsSync(instanceDir)) {
    fs.mkdirSync(instanceDir, { recursive: true });
  }

  let versionToLaunch = versionOverride || activeProfile?.effectiveVersionId || appConfig.selectedVersion || '1.21.11';
  const baseMcVer = (activeProfile?.mcVersion || versionToLaunch.replace(/^(fabric|quilt)-/, '') || '1.21.11').trim();
  const profileLoader = activeProfile?.loader || 'fabric';

  try {
    if (profileLoader === 'fabric') {
      const fabricVerId = `fabric-${baseMcVer}`;
      const fabricJsonPath = path.join(rootDir, 'versions', fabricVerId, `${fabricVerId}.json`);
      if (!fs.existsSync(fabricJsonPath)) {
        window?.webContents.send('launcher:status', { message: `Instalowanie silnika Fabric dla ${baseMcVer}...` });
        await mods.installFabric(baseMcVer);
      }
      versionToLaunch = fabricVerId;
    } else if (profileLoader === 'quilt') {
      const quiltVerId = `quilt-${baseMcVer}`;
      const quiltJsonPath = path.join(rootDir, 'versions', quiltVerId, `${quiltVerId}.json`);
      if (!fs.existsSync(quiltJsonPath)) {
        window?.webContents.send('launcher:status', { message: `Instalowanie silnika Quilt dla ${baseMcVer}...` });
        await mods.installQuilt(baseMcVer);
      }
      versionToLaunch = quiltVerId;
    } else if (profileLoader === 'custom' && activeProfile?.customVersionId) {
      versionToLaunch = activeProfile.customVersionId;
    } else {
      // Profil Vanilla — czysta wersja bez wymuszania mod loadera
      versionToLaunch = baseMcVer;
    }
  } catch (loaderErr) {
    isLaunching = false;
    throw new Error(`Nie udało się przygotować silnika profilu (${profileLoader}): ${loaderErr.message}`);
  }

  // Upewniamy się, że wersja posiada kompletne argumenty uruchomieniowe gry
  ensureVersionJsonArguments(rootDir, versionToLaunch);

  const isPureReleaseId = /^\d+\.\d+(\.\d+)?$/.test(versionToLaunch) && profileLoader === 'vanilla';
  const isCustomVersion = !isPureReleaseId && (
    versionToLaunch.startsWith('fabric-') ||
    versionToLaunch.startsWith('quilt-') ||
    fs.existsSync(path.join(rootDir, 'versions', versionToLaunch, `${versionToLaunch}.json`))
  );

  const versionObj = {
    number: isCustomVersion ? baseMcVer : versionToLaunch,
    type: 'Kasteusz Client'
  };
  if (isCustomVersion) {
    versionObj.custom = versionToLaunch;
  }

  // Automatyczna optymalizacja ustawień graficznych Minecraft dla FPS
  if (appConfig.fpsBoostMode && appConfig.optimizeGameOptions) {
    applyFpsBoostOptions(instanceDir);
  }

  // Automatyczne wdrożenie oficjalnego motywu menu Kasteusz Client (bez modów!)
  ensureKasteuszClientTheme(instanceDir);
  if (instanceDir !== rootDir) {
    ensureKasteuszClientTheme(rootDir);
  }

  // Automatyczne wdrożenie oficjalnego modułu Kasteusz Client HUD (pod RShift)
  ensureKasteuszClientHudMod(instanceDir);

  const profileLabel = activeProfile?.name ? `${activeProfile.name} (${versionToLaunch})` : versionToLaunch;
  window?.webContents.send('launcher:status', { message: `Przygotowywanie profilu: ${profileLabel}...` });

  const customArgs = [];

  // Aplikowanie wybranego profilu flag optymalizacyjnych JVM
  const selectedPresetKey = activeProfile?.jvmPreset || appConfig.jvmPreset || 'ultra';
  const preset = JVM_PRESETS[selectedPresetKey] || JVM_PRESETS.ultra;

  if (appConfig.fpsBoostMode !== false && preset.flags && preset.flags.length > 0) {
    customArgs.push(...preset.flags);
    window?.webContents.send('launcher:log', {
      level: 'info',
      text: `[KasteuszLauncher Optymalizator] Zastosowano profil: ${preset.name} (${preset.flags.length} flag JVM).`
    });
  }

  if (appConfig.customJvmArgs && appConfig.customJvmArgs.trim()) {
    customArgs.push(...appConfig.customJvmArgs.trim().split(/\s+/));
  }
  if (activeProfile?.jvmArgs && activeProfile.jvmArgs.trim()) {
    customArgs.push(...activeProfile.jvmArgs.trim().split(/\s+/));
  }

  if (activeProfile?.id) {
    profiles.markProfilePlayed(activeProfile.id);
  }

  const effectiveMaxRam = activeProfile?.memoryMax || appConfig.memoryMax || 4;
  const effectiveMinRam = Math.min(effectiveMaxRam, appConfig.memoryMin || 2);

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
      max: `${effectiveMaxRam}G`,
      min: `${effectiveMinRam}G`
    },
    javaPath: resolveJavaExecutable(appConfig.javaPath),
    customArgs,
    window: {
      width: appConfig.resolutionWidth || 1280,
      height: appConfig.resolutionHeight || 720,
      fullscreen: !!appConfig.fullscreen
    },
    overrides: {
      gameDirectory: instanceDir,
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

      // Dynamiczne wykrywanie stanu gry i serwera dla Discord RPC (ignorujemy Simple Voice Chat)
      if (line.includes('[voicechat]') || line.toLowerCase().includes('voice chat')) {
        // Ignorujemy logi modu voicechat, żeby nie nadpisywały IP serwera
      } else if (line.includes('Connecting to ')) {
        const match = line.match(/Connecting to\s+([a-zA-Z0-9.\-_]+)(?:,\s*\d+)?/i);
        if (match && match[1]) {
          const rawHost = match[1].trim();
          if (rawHost.toLowerCase() !== 'voice' && rawHost.toLowerCase() !== 'chat') {
            const serverName = (rawHost === 'localhost' || rawHost === '127.0.0.1') ? 'Lokalny serwer' : rawHost;
            discord.setLauncherActivity({
              isPlaying: true,
              serverIp: serverName,
              statusDetails: `Gra na serwerze: ${serverName}`,
              gameVersion: versionToLaunch
            });
          }
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

    activeLauncherClient.on('close', async (code) => {
      isLaunching = false;
      const updatedStats = stats.recordClose();
      discord.setLauncherActivity({ isPlaying: false, serverIp: null, statusDetails: 'W menu launchera' });
      safeSend('launcher:closed', { code });
      safeSend('stats:updated', updatedStats);

      // Automatyczna diagnoza w przypadku nieoczekiwanego zamknięcia gry
      if (code !== 0 && code !== null) {
        try {
          const crashDoctor = require('./crashDoctor');
          const diagnosis = await crashDoctor.diagnose('active');
          diagnosis.exitCode = code;
          safeSend('crash:detected', diagnosis);
        } catch (doctorErr) {
          console.warn('[Launcher] Błąd automatycznej diagnozy błędu:', doctorErr.message);
        }
      }
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
  getIsLaunching,
  JVM_PRESETS,
  resolveJavaExecutable,
  ensureKasteuszClientTheme,
  ensureKasteuszClientHudMod
};
