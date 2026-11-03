const { Client } = require('minecraft-launcher-core');
const Handler = require('minecraft-launcher-core/components/handler');
const path = require('path');
const fs = require('fs');
const child = require('child_process');
const config = require('./config');
const auth = require('./auth');
const mods = require('./mods');
const profiles = require('./profiles');
const discord = require('./discord');
const stats = require('./stats');
const javaManager = require('./javaManager');
const presence = require('./presence');

// Optymalizacja weryfikacji MCLC – jeśli plik zasobów/biblioteki już istnieje na dysku
// i ma prawidłowy rozmiar, pomijamy powolne asynchroniczne hashowanie SHA1 4500+ plików
// przy każdym pojedynczym kliknięciu "Graj", co przyspiesza start gry o 1.5–2 sekundy.
if (Handler && Handler.prototype && !Handler.prototype._kasteuszOptimized) {
  Handler.prototype._kasteuszOptimized = true;
  const origCheckSum = Handler.prototype.checkSum;
  Handler.prototype.checkSum = function (hash, file) {
    if (!hash) return Promise.resolve(true);
    try {
      if (fs.existsSync(file)) {
        const st = fs.statSync(file);
        if (st.size > 0) return Promise.resolve(true);
      }
    } catch (_) {}
    return origCheckSum.call(this, hash, file);
  };

  // Poprawka dla sprawdzania Javy na Windowsie:
  // javaw.exe nie wypisuje tekstu na konsolę (brak stdout/stderr), przez co oryginalny kod MCLC
  // rzucał TypeError (stderr.match(...).pop()) i zamykał launcher z kodem 1 na każdym profilu.
  Handler.prototype.checkJava = function (java) {
    return new Promise(resolve => {
      let probeJava = java || 'java';
      if (typeof probeJava === 'string' && /javaw(\.exe)?$/i.test(probeJava)) {
        const sibling = probeJava.replace(/javaw(\.exe)?$/i, 'java$1');
        if (fs.existsSync(sibling)) {
          probeJava = sibling;
        }
      }

      child.exec(`"${probeJava}" -version`, (error, stdout, stderr) => {
        const out = ((stderr || '') + '\n' + (stdout || '')).trim();
        const verMatch = out.match(/"([^"]+)"/) || out.match(/version\s+([0-9._]+)/i);
        if (verMatch) {
          const is64 = out.includes('64-Bit') || out.includes('64-bit') || process.arch === 'x64';
          this.client.emit('debug', `[MCLC]: Using Java version ${verMatch[1]} ${is64 ? '64-bit' : '32-Bit'}`);
          return resolve({ run: true, version: verMatch[1] });
        }
        if (error && !out.toLowerCase().includes('version')) {
          this.client.emit('debug', `[MCLC]: Weryfikacja Java (${probeJava}) nie powiodła się: ${error.message}`);
          return resolve({ run: false, message: error });
        }
        resolve({ run: true });
      });
    });
  };
}

const JVM_PRESETS = {
  ultra: {
    id: 'ultra',
    name: 'Ultra FPS (Aikar G1GC Optymalny)',
    desc: 'Najlepszy profil dla modów i paczek Forge/Fabric – zero lag-spikes, niskie zużycie RAM i chłodny procesor (Rekomendowany)',
    recommendedRam: 5,
    flags: [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:G1NewSizePercent=20',
      '-XX:G1MaxNewSizePercent=30',
      '-XX:G1ReservePercent=15',
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
  g1gc: {
    id: 'g1gc',
    name: 'Stabilny (G1GC Standard)',
    desc: 'Czysty silnik G1GC – minimalne obciążenie pamięci systemowej i stabilne klatki',
    recommendedRam: 4,
    flags: [
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-XX:+DisableExplicitGC',
      '-XX:+PerfDisableSharedMem'
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
      '-XX:+PerfDisableSharedMem',
      '-XX:-UsePerfData',
      '-XX:ParallelGCThreads=2',
      '-Dsun.rmi.dgc.client.gcInterval=3600000'
    ]
  },
  zgc: {
    id: 'zgc',
    name: 'Eksperymentalny ZGC (dla komputerów z 32GB+ RAM)',
    desc: 'Generational ZGC – wymaga minimum 12 GB przydzielonego RAM-u; niezalecany przy 16 GB RAM',
    recommendedRam: 12,
    flags: [
      '-XX:+UseZGC',
      '-XX:+ZGenerational',
      '-XX:+UnlockExperimentalVMOptions',
      '-XX:+DisableExplicitGC',
      '-XX:-UsePerfData',
      '-XX:+UseStringDeduplication'
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

function resolveJavaExecutable(configuredPath, requiredMajor = 21) {
  return javaManager.resolveJavaSync(configuredPath, requiredMajor);
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

function cleanupKasteuszClientHudMod(targetDir) {
  try {
    if (!targetDir) return;
    const dstMod = path.join(targetDir, 'mods', 'KasteuszClient-HUD-1.21.11.jar');
    if (fs.existsSync(dstMod)) {
      try { fs.unlinkSync(dstMod); } catch (_) {}
    }
    const dstCfg = path.join(targetDir, 'config', 'hudplus.json');
    if (fs.existsSync(dstCfg)) {
      try { fs.unlinkSync(dstCfg); } catch (_) {}
    }
  } catch (_) {}
}

function ensureKasteuszClientHudMod(targetDir) {
  cleanupKasteuszClientHudMod(targetDir);
}

async function ensureFabricApiCompatibility(instanceDir, baseMcVer, window) {
  if (!instanceDir || !baseMcVer) return;
  const modsDir = path.join(instanceDir, 'mods');
  if (!fs.existsSync(modsDir)) return;

  const entries = fs.readdirSync(modsDir);
  const jarFiles = entries.filter(f => f.endsWith('.jar'));

  const fabricApiFiles = jarFiles.filter(f => {
    const low = f.toLowerCase();
    return low.startsWith('fabric-api') || low.includes('fabric_api') || low.includes('fabricapi');
  });

  const sodiumOrDependents = jarFiles.some(f => {
    const low = f.toLowerCase();
    return low.includes('sodium') || low.includes('iris') || low.includes('lithium') || low.includes('modmenu');
  });

  // 1. Jeśli brak Fabric API, ale zainstalowano mody wymagające Fabric API (np. Sodium / Iris)
  if (fabricApiFiles.length === 0 && sodiumOrDependents) {
    window?.webContents.send('launcher:status', { message: `Pobieranie wymaganej biblioteki Fabric API dla Minecraft ${baseMcVer}...` });
    try {
      await mods.installModrinthMod({ slug: 'fabric-api', gameVersion: baseMcVer, loader: 'fabric' });
      console.log(`[Launcher] Zainstalowano Fabric API dla ${baseMcVer}`);
    } catch (e) {
      console.warn('[Launcher] Nie udało się zainstalować Fabric API:', e.message);
    }
    return;
  }

  // 2. Jeśli Fabric API istnieje, sprawdź czy wersja w nazwie pliku nie jest sprzeczna z baseMcVer
  for (const f of fabricApiFiles) {
    let isMismatched = false;
    // Np. fabric-api-0.116.17+1.21.1.jar vs baseMcVer 1.21.11
    const plusMatch = f.match(/\+([0-9a-zA-Z._-]+)\.jar$/i);
    if (plusMatch && plusMatch[1]) {
      const fileMcVer = plusMatch[1].trim();
      if (fileMcVer !== baseMcVer) {
        isMismatched = true;
      }
    }

    if (isMismatched) {
      console.log(`[Launcher] Wykryto niekompatybilny Fabric API (${f}) dla Minecraft ${baseMcVer}. Automatyczna naprawa...`);
      window?.webContents.send('launcher:status', { message: `Aktualizowanie Fabric API dla Minecraft ${baseMcVer}...` });
      try {
        try { fs.unlinkSync(path.join(modsDir, f)); } catch (_) {}
        await mods.installModrinthMod({ slug: 'fabric-api', gameVersion: baseMcVer, loader: 'fabric' });
        console.log(`[Launcher] Pomyślnie zaktualizowano Fabric API do wersji dla Minecraft ${baseMcVer}`);
      } catch (err) {
        console.warn('[Launcher] Błąd automatycznej naprawy Fabric API:', err.message);
      }
    }
  }
}

function extractVersionJvmArgs(rootDir, versionId, baseMcVer, profileLoader) {
  const collected = [];
  try {
    const versionJsonPath = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) return collected;

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    const rawJvm = Array.isArray(versionJson.arguments?.jvm) ? versionJson.arguments.jvm : [];

    const libDir = path.join(rootDir, 'libraries');
    const sep = process.platform === 'win32' ? ';' : ':';
    const osName = process.platform === 'win32' ? 'windows' : (process.platform === 'darwin' ? 'osx' : 'linux');
    const osArch = process.arch === 'ia32' ? 'x86' : process.arch;

    const matchesRule = (rule) => {
      if (!rule) return true;
      if (rule.os) {
        if (rule.os.name && rule.os.name !== osName) return false;
        if (rule.os.arch && rule.os.arch !== osArch) return false;
      }
      return rule.action === 'allow';
    };

    const processItem = (val) => {
      if (typeof val !== 'string') return;
      let arg = val
        .replace(/\${library_directory}/g, libDir)
        .replace(/\${classpath_separator}/g, sep)
        .replace(/\${version_name}/g, versionId)
        .replace(/\${natives_directory}/g, rootDir)
        .replace(/\${launcher_name}/g, 'KasteuszLauncher')
        .replace(/\${launcher_version}/g, '1.0.0');

      if (
        arg === '-cp' ||
        arg === '${classpath}' ||
        arg.startsWith('-Djava.library.path=') ||
        arg.startsWith('-Djna.tmpdir=') ||
        arg.startsWith('-Dorg.lwjgl.system.SharedLibraryExtractPath=') ||
        arg.startsWith('-Dio.netty.native.workdir=') ||
        arg.startsWith('-Xmx') ||
        arg.startsWith('-Xms') ||
        arg === '-Xss1M' ||
        arg === '-XstartOnFirstThread'
      ) {
        return;
      }

      collected.push(arg);
    };

    for (const item of rawJvm) {
      if (typeof item === 'string') {
        processItem(item);
      } else if (item && typeof item === 'object') {
        const rules = Array.isArray(item.rules) ? item.rules : [];
        const isAllowed = rules.length === 0 || rules.some(matchesRule);
        if (isAllowed && item.value) {
          if (Array.isArray(item.value)) {
            for (const v of item.value) processItem(v);
          } else {
            processItem(item.value);
          }
        }
      }
    }

    const isForge = profileLoader === 'forge' || profileLoader === 'neoforge' || versionId.includes('forge') || versionId.includes('neoforge');
    if (isForge) {
      const javaOpens = [
        '--add-opens=java.base/java.lang=ALL-UNNAMED',
        '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
        '--add-opens=java.base/java.lang.reflect=ALL-UNNAMED',
        '--add-opens=java.base/java.util=ALL-UNNAMED',
        '--add-opens=java.base/java.util.jar=ALL-UNNAMED',
        '--add-opens=java.base/sun.security.util=ALL-UNNAMED'
      ];
      for (const openArg of javaOpens) {
        if (!collected.includes(openArg)) {
          collected.push(openArg);
        }
      }
    }
  } catch (err) {
    console.warn(`[KasteuszLauncher] Błąd ekstrakcji flag JVM dla wersji ${versionId}:`, err.message);
  }
  return collected;
}

function ensureVersionJsonArguments(rootDir, versionId) {
  try {
    const versionJsonPath = path.join(rootDir, 'versions', versionId, `${versionId}.json`);
    if (!fs.existsSync(versionJsonPath)) return;

    const versionJson = JSON.parse(fs.readFileSync(versionJsonPath, 'utf8'));
    const gameArgs = Array.isArray(versionJson.arguments?.game) ? versionJson.arguments.game : [];
    const hasBasePlayerArg = gameArgs.some(a => typeof a === 'string' && (a === '${auth_player_name}' || a === '--username'));

    let changed = false;
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
        if (baseJson.arguments && Array.isArray(baseJson.arguments.game) && (gameArgs.length === 0 || !hasBasePlayerArg)) {
          versionJson.arguments = versionJson.arguments || {};
          const existingGameArgs = Array.isArray(versionJson.arguments.game) ? versionJson.arguments.game : [];
          const mergedGame = [...existingGameArgs];
          for (const item of baseJson.arguments.game) {
            if (typeof item === 'string' && mergedGame.includes(item)) continue;
            mergedGame.push(item);
          }
          versionJson.arguments.game = mergedGame;
          changed = true;
        }

        if (baseJson.arguments && Array.isArray(baseJson.arguments.jvm)) {
          versionJson.arguments = versionJson.arguments || {};
          if (!Array.isArray(versionJson.arguments.jvm) || versionJson.arguments.jvm.length === 0) {
            versionJson.arguments.jvm = [...baseJson.arguments.jvm];
            changed = true;
          }
        }
        if (!versionJson.assetIndex && baseJson.assetIndex) {
          versionJson.assetIndex = baseJson.assetIndex;
          changed = true;
        }
        if (!versionJson.assets && baseJson.assets) {
          versionJson.assets = baseJson.assets;
          changed = true;
        }
      }
    }

    if (changed) {
      fs.writeFileSync(versionJsonPath, JSON.stringify(versionJson, null, 2), 'utf8');
      console.log(`[KasteuszLauncher] Zsynchronizowano argumenty gry w pliku JSON dla wersji ${versionId}`);
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

  let currentAccount = account;
  if (account.isPremium && account.msRefreshToken && account.expiresAt) {
    const timeRemaining = account.expiresAt - Date.now();
    if (timeRemaining < 10 * 60 * 1000) {
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

  const rootDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }
  if (!fs.existsSync(instanceDir)) {
    fs.mkdirSync(instanceDir, { recursive: true });
  }

  isLaunching = true;
  activeLauncherClient = new Client();

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

      try {
        await ensureFabricApiCompatibility(instanceDir, baseMcVer, window);
      } catch (fApiErr) {
        console.warn('[Launcher] Weryfikacja Fabric API:', fApiErr.message);
      }
    } else if (profileLoader === 'quilt') {
      const quiltVerId = `quilt-${baseMcVer}`;
      const quiltJsonPath = path.join(rootDir, 'versions', quiltVerId, `${quiltVerId}.json`);
      if (!fs.existsSync(quiltJsonPath)) {
        window?.webContents.send('launcher:status', { message: `Instalowanie silnika Quilt dla ${baseMcVer}...` });
        await mods.installQuilt(baseMcVer);
      }
      versionToLaunch = quiltVerId;
    } else if (profileLoader === 'forge' || profileLoader === 'neoforge') {
      let forgeVerId = activeProfile?.customVersionId;
      const jsonExists = forgeVerId && fs.existsSync(path.join(rootDir, 'versions', forgeVerId, `${forgeVerId}.json`));
      if (!jsonExists) {
        window?.webContents.send('launcher:status', { message: `Przygotowywanie silnika Forge dla Minecraft ${baseMcVer}...` });
        forgeVerId = await mods.installForge(baseMcVer, activeProfile?.forgeVersion, (status) => {
          if (status?.message) {
            window?.webContents.send('launcher:status', { message: status.message });
          }
        });
        if (forgeVerId && activeProfile?.id) {
          profiles.updateProfile(activeProfile.id, { customVersionId: forgeVerId });
        }
      }
      versionToLaunch = forgeVerId || `${baseMcVer}-forge`;
    } else if (profileLoader === 'custom' && activeProfile?.customVersionId) {
      versionToLaunch = activeProfile.customVersionId;
    } else {
      versionToLaunch = baseMcVer;
    }
  } catch (loaderErr) {
    isLaunching = false;
    throw new Error(`Nie udało się przygotować silnika profilu (${profileLoader}): ${loaderErr.message}`);
  }

  ensureVersionJsonArguments(rootDir, versionToLaunch);

  const isPureReleaseId = /^\d+\.\d+(\.\d+)?$/.test(versionToLaunch) && profileLoader === 'vanilla';
  const isCustomVersion = !isPureReleaseId && (
    versionToLaunch.startsWith('fabric-') ||
    versionToLaunch.startsWith('quilt-') ||
    versionToLaunch.includes('-forge-') ||
    versionToLaunch.startsWith('forge-') ||
    fs.existsSync(path.join(rootDir, 'versions', versionToLaunch, `${versionToLaunch}.json`))
  );

  const versionObj = {
    number: isCustomVersion ? baseMcVer : versionToLaunch,
    type: (profileLoader === 'forge' || profileLoader === 'neoforge') ? 'Forge' : (profileLoader === 'fabric' ? 'Fabric' : 'Kasteusz Client')
  };
  if (isCustomVersion) {
    versionObj.custom = versionToLaunch;
  }

  if (appConfig.fpsBoostMode && appConfig.optimizeGameOptions) {
    applyFpsBoostOptions(instanceDir);
  }

  ensureKasteuszClientTheme(instanceDir);
  if (instanceDir !== rootDir) {
    ensureKasteuszClientTheme(rootDir);
  }

  cleanupKasteuszClientHudMod(instanceDir);
  if (instanceDir !== rootDir) {
    cleanupKasteuszClientHudMod(rootDir);
  }

  try {
    if (typeof auth.syncSkinToInstance === 'function') {
      await auth.syncSkinToInstance(instanceDir, currentAccount);
    }
  } catch (skinErr) {
    console.warn('[Launcher] Błąd synchronizacji skórki:', skinErr.message);
  }

  const profileLabel = activeProfile?.name ? `${activeProfile.name} (${versionToLaunch})` : versionToLaunch;
  window?.webContents.send('launcher:status', { message: `Przygotowywanie profilu: ${profileLabel}...` });

  const customArgs = [];

  if (profileLoader === 'forge' || profileLoader === 'neoforge' || versionToLaunch.includes('-forge-') || versionToLaunch.startsWith('forge-')) {
    customArgs.push(
      '--add-opens=java.base/java.lang.invoke=ALL-UNNAMED',
      '--add-opens=java.base/java.util.jar=ALL-UNNAMED'
    );
    const forgeJsonPath = path.join(rootDir, 'versions', versionToLaunch, `${versionToLaunch}.json`);
    if (fs.existsSync(forgeJsonPath)) {
      try {
        const forgeJson = JSON.parse(fs.readFileSync(forgeJsonPath, 'utf8'));
        const libDir = path.join(rootDir, 'libraries');
        const sep = path.delimiter;
        if (Array.isArray(forgeJson.arguments?.jvm)) {
          for (const entry of forgeJson.arguments.jvm) {
            if (typeof entry === 'string') {
              const resolved = entry
                .split('${library_directory}').join(libDir)
                .split('${classpath_separator}').join(sep)
                .split('${version_name}').join(baseMcVer)
                .split('${natives_directory}').join(path.join(rootDir, 'natives'));
              if (
                resolved === '-cp' ||
                resolved === '${classpath}' ||
                resolved.startsWith('-Djava.library.path=') ||
                resolved.startsWith('-Djna.tmpdir=') ||
                resolved.startsWith('-Dorg.lwjgl.system.SharedLibraryExtractPath=') ||
                resolved.startsWith('-Dio.netty.native.workdir=') ||
                resolved.startsWith('-Xmx') ||
                resolved.startsWith('-Xms') ||
                resolved === '-Xss1M' ||
                resolved === '-XstartOnFirstThread'
              ) {
                continue;
              }
              if (!customArgs.includes(resolved)) {
                customArgs.push(resolved);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Launcher] Nie udało się sparsować arguments.jvm dla Forge:', err.message);
      }
    }
  }

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

  const versionJvmArgs = extractVersionJvmArgs(rootDir, versionToLaunch, baseMcVer, profileLoader);
  if (versionJvmArgs.length > 0) {
    for (const vArg of versionJvmArgs) {
      if (!customArgs.includes(vArg)) {
        customArgs.push(vArg);
      }
    }
    window?.webContents.send('launcher:log', {
      level: 'info',
      text: `[KasteuszLauncher] Załadowano ${versionJvmArgs.length} wymaganych flag silnika gry (${profileLoader}).`
    });
  }

  if (activeProfile?.id) {
    profiles.markProfilePlayed(activeProfile.id);
  }

  const effectiveMaxRam = activeProfile?.memoryMax || appConfig.memoryMax || 4;
  const effectiveMinRam = Math.min(effectiveMaxRam, appConfig.memoryMin || 2);

  const requiredJavaMajor = javaManager.getRequiredJavaMajor(baseMcVer);
  window?.webContents.send('launcher:status', { message: `Weryfikacja środowiska Java (Java ${requiredJavaMajor})...` });

  let resolvedJavaBin = null;
  try {
    resolvedJavaBin = await javaManager.ensureJava(requiredJavaMajor, (status) => {
      if (window && !window.isDestroyed()) {
        window.webContents.send('launcher:status', {
          message: status.message,
          isDownloading: !!status.isDownloading
        });
        if (status.percentage !== undefined) {
          window.webContents.send('launcher:progress', {
            type: 'java',
            task: status.downloaded || 0,
            total: status.total || 100,
            percentage: status.percentage,
            isDownloading: true,
            label: `Pobieranie Java ${requiredJavaMajor} (${status.percentage}%)`
          });
        }
      }
    }, appConfig.javaPath);
  } catch (javaErr) {
    isLaunching = false;
    throw new Error(`Błąd przygotowywania środowiska Java dla Minecraft: ${javaErr.message}`);
  }

  const playerName = currentAccount.username || currentAccount.name || 'Mcqueen420_';
  const rawUuid = currentAccount.uuid;
  const playerUuid = (!currentAccount.isPremium && (!rawUuid || /^0+-?0*$/.test(rawUuid)) && typeof auth.computeOfflineUuid === 'function')
    ? auth.computeOfflineUuid(playerName)
    : (rawUuid || '00000000000000000000000000000000');
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
    javaPath: resolvedJavaBin || resolveJavaExecutable(appConfig.javaPath, requiredJavaMajor),
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

  const sessionLogs = [];

  return new Promise((resolve, reject) => {
    const safeSend = (channel, ...args) => {
      try {
        if (window && !window.isDestroyed() && window.webContents && !window.webContents.isDestroyed()) {
          window.webContents.send(channel, ...args);
        }
      } catch (_) {}
    };

    activeLauncherClient.on('debug', (e) => {
      const msg = typeof e === 'string' ? e : String(e || '');
      if (msg.includes('Couldn\'t start') || msg.includes('Failed to start') || msg.includes('Exception') || msg.includes('Error')) {
        sessionLogs.push(msg);
        if (sessionLogs.length > 250) sessionLogs.shift();
      }
      safeSend('launcher:log', { level: 'debug', text: e });
    });

    activeLauncherClient.on('data', (e) => {
      const line = e.toString().trim();
      sessionLogs.push(line);
      if (sessionLogs.length > 250) sessionLogs.shift();
      safeSend('launcher:log', { level: 'info', text: line });

      const lanPortMatch = line.match(/(?:Local game hosted on port|udostępnion[ay] na porcie|na porcie)\s+(\d{2,5})/i);
      if (lanPortMatch && lanPortMatch[1]) {
        safeSend('server:lan-detected', { port: parseInt(lanPortMatch[1], 10) });
      }

      if (line.includes('[voicechat]') || line.toLowerCase().includes('voice chat')) {
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
            try { presence.sendPresenceHeartbeat(`Na serwerze ${serverName}`); } catch (_) {}
          }
        }
      } else if (line.includes('Starting integrated minecraft server') || line.includes('Starting integrated server')) {
        discord.setLauncherActivity({
          isPlaying: true,
          serverIp: null,
          statusDetails: 'Tryb jednoosobowy (Singleplayer)',
          gameVersion: versionToLaunch
        });
        try { presence.sendPresenceHeartbeat(`W grze: Singleplayer (${versionToLaunch})`); } catch (_) {}
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
        try { presence.sendPresenceHeartbeat(`W grze: W menu (${versionToLaunch})`); } catch (_) {}
      }
    });

    let hasActiveDownload = false;
    let lastDownloadTs = 0;

    activeLauncherClient.on('download-status', (e) => {
      hasActiveDownload = true;
      lastDownloadTs = Date.now();
      const rawName = e.name ? path.basename(e.name) : (e.type || 'plików');
      safeSend('launcher:status', {
        message: `Pobieranie: ${rawName}`,
        isDownloading: true
      });
    });

    activeLauncherClient.on('progress', (e) => {
      const percentage = e.total > 0 ? Math.round((e.task / e.total) * 100) : 0;
      const isReallyDownloading = hasActiveDownload && (Date.now() - lastDownloadTs < 2000);
      safeSend('launcher:progress', {
        type: e.type,
        task: e.task,
        total: e.total,
        percentage,
        isDownloading: isReallyDownloading,
        label: isReallyDownloading ? `Pobieranie ${percentage}%` : `Weryfikacja ${percentage}%`
      });
    });

    activeLauncherClient.on('close', async (code) => {
      isLaunching = false;
      let updatedStats = null;
      try {
        if (stats && typeof stats.recordClose === 'function') {
          updatedStats = stats.recordClose();
        }
      } catch (stErr) {
        console.warn('[Stats] Błąd recordClose:', stErr.message);
      }
      discord.setLauncherActivity({ isPlaying: false, serverIp: null, statusDetails: 'W menu launchera' });
      try { presence.setGameActivity(false); } catch (_) {}
      safeSend('launcher:closed', { code });
      if (updatedStats) {
        const curAcc = config.getActiveAccount();
        safeSend('stats:updated', {
          ...updatedStats,
          rankTitle: stats.getRankTitle(updatedStats.totalPlaytimeMinutes, curAcc?.username || curAcc?.name, curAcc?.uuid || curAcc?.id)
        });
      }

      if (code !== 0 && code !== null) {
        try {
          const crashDoctor = require('./crashDoctor');
          const consoleBuffer = sessionLogs.join('\n');
          const diagnosis = await crashDoctor.diagnose('active', consoleBuffer);
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
        let currentStats = null;
        try {
          if (stats && typeof stats.recordLaunch === 'function') {
            currentStats = stats.recordLaunch(versionToLaunch);
          }
        } catch (stErr) {
          console.warn('[Stats] Błąd recordLaunch:', stErr.message);
        }
        discord.setLauncherActivity({
          isPlaying: true,
          serverIp: null,
          statusDetails: 'W menu gry',
          gameVersion: versionToLaunch
        });
        try { presence.setGameActivity(true, versionToLaunch); } catch (_) {}
        safeSend('launcher:started', { version: versionToLaunch });
        if (currentStats) {
          safeSend('stats:updated', currentStats);
        }
        resolve({ success: true, version: versionToLaunch });
        if (appConfig.closeOnLaunch) {
          setTimeout(() => {
            if (window && !window.isDestroyed()) {
              window.close();
            }
          }, 3000);
        } else {
          setTimeout(() => {
            if (window && !window.isDestroyed() && !window.isMinimized()) {
              window.minimize();
            }
          }, 2000);
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
  ensureKasteuszClientHudMod,
  cleanupKasteuszClientHudMod,
  ensureVersionJsonArguments,
  extractVersionJvmArgs
};
