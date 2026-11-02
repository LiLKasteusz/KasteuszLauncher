const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { shell, dialog } = require('electron');
const config = require('./config');
const profiles = require('./profiles');

let AdmZip = null;
try {
  AdmZip = require('adm-zip');
} catch (_) {
  AdmZip = null;
}

const archiveMetaCache = new Map();

function stripMcCodes(text) {
  if (!text) return '';
  if (typeof text === 'object') {
    if (typeof text.text === 'string') return stripMcCodes(text.text);
    if (Array.isArray(text.extra)) return text.extra.map(stripMcCodes).join('');
    return '';
  }
  return String(text).replace(/§[0-9a-fk-or]/gi, '').replace(/\s+/g, ' ').trim();
}

function inspectJarMetadata(fullPath, mtimeMs) {
  const cacheKey = `${fullPath}:${mtimeMs}`;
  if (archiveMetaCache.has(cacheKey)) {
    return archiveMetaCache.get(cacheKey);
  }
  const meta = { displayName: null, version: null, description: null, iconDataUrl: null };
  if (!AdmZip) return meta;
  try {
    const zip = new AdmZip(fullPath);
    const modJsonEntry = zip.getEntry('fabric.mod.json');
    if (modJsonEntry) {
      const raw = modJsonEntry.getData().toString('utf8');
      const parsed = JSON.parse(raw);
      meta.displayName = parsed.name || null;
      meta.version = parsed.version || null;
      meta.description = typeof parsed.description === 'string' ? parsed.description.trim() : null;

      let iconPath = null;
      if (typeof parsed.icon === 'string') {
        iconPath = parsed.icon;
      } else if (parsed.icon && typeof parsed.icon === 'object') {
        const keys = Object.keys(parsed.icon);
        if (keys.length > 0) iconPath = parsed.icon[keys[keys.length - 1]];
      }
      if (iconPath) {
        const normalizedIcon = iconPath.replace(/^\/+/, '');
        const iconEntry = zip.getEntry(normalizedIcon);
        if (iconEntry) {
          const buf = iconEntry.getData();
          if (buf && buf.length > 0 && buf.length < 512 * 1024) {
            meta.iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
          }
        }
      }
    }
  } catch (_) {}
  archiveMetaCache.set(cacheKey, meta);
  return meta;
}

function inspectPackMetadata(fullPath, isDirectory, mtimeMs) {
  const cacheKey = `pack:${fullPath}:${mtimeMs}`;
  if (archiveMetaCache.has(cacheKey)) {
    return archiveMetaCache.get(cacheKey);
  }
  const meta = { description: '', packFormat: null, iconDataUrl: null };
  try {
    if (isDirectory) {
      const mcmetaPath = path.join(fullPath, 'pack.mcmeta');
      if (fs.existsSync(mcmetaPath)) {
        const parsed = JSON.parse(fs.readFileSync(mcmetaPath, 'utf8'));
        meta.description = stripMcCodes(parsed?.pack?.description);
        meta.packFormat = parsed?.pack?.pack_format || null;
      }
      const pngPath = path.join(fullPath, 'pack.png');
      if (fs.existsSync(pngPath)) {
        const buf = fs.readFileSync(pngPath);
        if (buf.length > 0 && buf.length < 1024 * 1024) {
          meta.iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        }
      }
    } else if (AdmZip) {
      const zip = new AdmZip(fullPath);
      const mcmetaEntry = zip.getEntry('pack.mcmeta') || zip.getEntries().find(e => e.entryName.endsWith('/pack.mcmeta') && e.entryName.split('/').length <= 2);
      if (mcmetaEntry) {
        try {
          const parsed = JSON.parse(mcmetaEntry.getData().toString('utf8'));
          meta.description = stripMcCodes(parsed?.pack?.description);
          meta.packFormat = parsed?.pack?.pack_format || null;
        } catch (_) {}
      }
      const pngEntry = zip.getEntry('pack.png') || zip.getEntries().find(e => (e.entryName.endsWith('/pack.png') || e.entryName === 'logo.png') && e.entryName.split('/').length <= 2);
      if (pngEntry) {
        const buf = pngEntry.getData();
        if (buf && buf.length > 0 && buf.length < 1024 * 1024) {
          meta.iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        }
      }
    }
  } catch (_) {}
  archiveMetaCache.set(cacheKey, meta);
  return meta;
}

function getModsDirectory() {
  try {
    const dir = path.join(profiles.getActiveInstanceDirectory(), 'mods');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (_) {
    const appConfig = config.getConfig();
    const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
    const modsDir = path.join(gameDir, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }
    return modsDir;
  }
}

function getPacksDirectory(type = 'resourcepacks') {
  const folder = type === 'shaderpacks' ? 'shaderpacks' : 'resourcepacks';
  try {
    const dir = path.join(profiles.getActiveInstanceDirectory(), folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  } catch (_) {
    const appConfig = config.getConfig();
    const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
    const dir = path.join(gameDir, folder);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getInstalledMods() {
  const modsDir = getModsDirectory();
  try {
    const files = fs.readdirSync(modsDir);
    const mods = files
      .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
      .map(filename => {
        const fullPath = path.join(modsDir, filename);
        const stats = fs.statSync(fullPath);
        const isEnabled = filename.endsWith('.jar');
        const cleanName = filename.replace(/\.jar(\.disabled)?$/, '');
        const meta = inspectJarMetadata(fullPath, stats.mtimeMs);

        return {
          filename,
          name: cleanName,
          displayName: meta.displayName || cleanName,
          version: meta.version || null,
          description: meta.description || null,
          iconDataUrl: meta.iconDataUrl || null,
          size: formatBytes(stats.size),
          bytes: stats.size,
          enabled: isEnabled,
          modified: stats.mtime
        };
      });

    return mods.sort((a, b) => b.modified - a.modified);
  } catch (err) {
    console.error('Błąd odczytu katalogu modów:', err);
    return [];
  }
}

async function selectAndAddMods(parentWindow) {
  const modsDir = getModsDirectory();
  const result = await dialog.showOpenDialog(parentWindow, {
    title: 'Wybierz mody Minecraft (.jar)',
    filters: [
      { name: 'Mody Minecraft (*.jar)', extensions: ['jar'] }
    ],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { added: 0, mods: getInstalledMods() };
  }

  let added = 0;
  for (const srcPath of result.filePaths) {
    const baseName = path.basename(srcPath);
    const destPath = path.join(modsDir, baseName);
    try {
      fs.copyFileSync(srcPath, destPath);
      added++;
    } catch (err) {
      console.error(`Nie udało się skopiować moda ${baseName}:`, err);
    }
  }

  return { added, mods: getInstalledMods() };
}

function toggleMod(filename) {
  const modsDir = getModsDirectory();
  const currentPath = path.join(modsDir, filename);

  if (!fs.existsSync(currentPath)) {
    throw new Error('Plik moda nie istnieje.');
  }

  let newFilename;
  if (filename.endsWith('.jar')) {
    newFilename = filename + '.disabled';
  } else if (filename.endsWith('.disabled')) {
    newFilename = filename.replace(/\.disabled$/, '');
  } else {
    throw new Error('Nieprawidłowe rozszerzenie pliku moda.');
  }

  const newPath = path.join(modsDir, newFilename);
  fs.renameSync(currentPath, newPath);

  return getInstalledMods();
}

function deleteMod(filename) {
  const modsDir = getModsDirectory();
  const filePath = path.join(modsDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return getInstalledMods();
}

function openModsFolder() {
  const modsDir = getModsDirectory();
  shell.openPath(modsDir);
  return modsDir;
}

async function installFabric(minecraftVersion = '1.20.4') {
  const appConfig = config.getConfig();
  const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  
  let baseJson = null;
  const baseJsonPath = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.json`);
  if (fs.existsSync(baseJsonPath)) {
    try {
      baseJson = JSON.parse(fs.readFileSync(baseJsonPath, 'utf8'));
    } catch (e) {
      console.warn('Błąd czytania lokalnego JSON wersji bazowej:', e);
    }
  }

  if (!baseJson) {
    try {
      const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const manifest = await manifestRes.json();
      const verEntry = manifest.versions?.find(v => v.id === minecraftVersion);
      if (verEntry) {
        const verRes = await fetch(verEntry.url);
        baseJson = await verRes.json();
        const baseDir = path.join(gameDir, 'versions', minecraftVersion);
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        fs.writeFileSync(baseJsonPath, JSON.stringify(baseJson, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('Nie udało się pobrać wersji bazowej z Mojang:', e);
    }
  }

  const metaUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}`;
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) {
    throw new Error(`Brak wsparcia Fabric dla Minecraft ${minecraftVersion}`);
  }

  const loaders = await metaRes.json();
  if (!loaders || loaders.length === 0) {
    throw new Error(`Nie znaleziono loadera Fabric dla Minecraft ${minecraftVersion}`);
  }

  const loaderVersion = loaders[0].loader.version;

  const profileUrl = `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`;
  const profileRes = await fetch(profileUrl);
  if (!profileRes.ok) {
    throw new Error('Nie udało się pobrać konfiguracji profilu Fabric');
  }

  const fabricJson = await profileRes.json();
  const versionId = `fabric-${minecraftVersion}`;

  const versionDir = path.join(gameDir, 'versions', versionId);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  const baseGameArgs = (baseJson && baseJson.arguments && Array.isArray(baseJson.arguments.game))
    ? baseJson.arguments.game
    : [];
  const fabricGameArgs = (fabricJson && fabricJson.arguments && Array.isArray(fabricJson.arguments.game))
    ? fabricJson.arguments.game
    : [];

  const baseJvmArgs = (baseJson && baseJson.arguments && Array.isArray(baseJson.arguments.jvm))
    ? baseJson.arguments.jvm
    : [];
  const fabricJvmArgs = (fabricJson && fabricJson.arguments && Array.isArray(fabricJson.arguments.jvm))
    ? fabricJson.arguments.jvm
    : [];

  const merged = {
    ...baseJson,
    ...fabricJson,
    id: versionId,
    inheritsFrom: minecraftVersion,
    arguments: {
      game: baseGameArgs.length > 0 ? [...baseGameArgs, ...fabricGameArgs] : fabricGameArgs,
      jvm: [...baseJvmArgs, ...fabricJvmArgs]
    },
    minecraftArguments: baseJson?.minecraftArguments || fabricJson.minecraftArguments,
    downloads: baseJson?.downloads || {},
    assetIndex: baseJson?.assetIndex || { id: minecraftVersion },
    assets: baseJson?.assets || minecraftVersion,
    libraries: [
      ...(fabricJson.libraries || []),
      ...(baseJson?.libraries || [])
    ],
    mainClass: fabricJson.mainClass || 'net.fabricmc.loader.impl.launch.knot.KnotClient'
  };

  fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(merged, null, 2), 'utf8');

  const baseJar = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.jar`);
  const fabricJar = path.join(versionDir, `${versionId}.jar`);
  if (fs.existsSync(baseJar) && !fs.existsSync(fabricJar)) {
    try {
      fs.copyFileSync(baseJar, fabricJar);
    } catch (e) {}
  }

  config.saveConfig({ selectedVersion: versionId });

  return {
    versionId,
    loaderVersion,
    minecraftVersion
  };
}

async function installForge(minecraftVersion = '1.20.1', requestedForgeVersion = null, onProgress = null) {
  const rootDir = config.getConfig().gameDirectory || config.DEFAULT_GAME_DIR;
  if (!fs.existsSync(rootDir)) {
    fs.mkdirSync(rootDir, { recursive: true });
  }

  const launcherProfilesPath = path.join(rootDir, 'launcher_profiles.json');
  if (!fs.existsSync(launcherProfilesPath)) {
    fs.writeFileSync(launcherProfilesPath, JSON.stringify({ profiles: {} }, null, 2), 'utf8');
  }

  const defaultForgeMap = {
    '1.20.1': '47.2.17',
    '1.20.2': '48.1.0',
    '1.20.4': '49.0.38',
    '1.19.2': '43.3.5',
    '1.18.2': '40.2.14',
    '1.16.5': '36.2.39'
  };

  let forgeVer = (requestedForgeVersion && String(requestedForgeVersion).trim()) || null;
  if (!forgeVer) {
    try {
      const promoRes = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', {
        headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
      });
      if (promoRes.ok) {
        const promoData = await promoRes.json();
        forgeVer = promoData.promos?.[`${minecraftVersion}-recommended`] || promoData.promos?.[`${minecraftVersion}-latest`];
      }
    } catch (_) {}
  }
  if (!forgeVer) {
    forgeVer = defaultForgeMap[minecraftVersion] || '47.2.17';
  }

  const versionId = `${minecraftVersion}-forge-${forgeVer}`;
  const versionDir = path.join(rootDir, 'versions', versionId);
  const versionJsonPath = path.join(versionDir, `${versionId}.json`);

  if (fs.existsSync(versionJsonPath)) {
    try {
      const launcher = require('./launcher');
      if (typeof launcher.ensureVersionJsonArguments === 'function') {
        launcher.ensureVersionJsonArguments(rootDir, versionId);
      }
    } catch (_) {}
    return versionId;
  }

  const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${minecraftVersion}-${forgeVer}/forge-${minecraftVersion}-${forgeVer}-installer.jar`;
  const tempDir = path.join(rootDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  const tempInstallerJar = path.join(tempDir, `forge-${minecraftVersion}-${forgeVer}-installer.jar`);

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'forge_download',
      percent: 92,
      message: `Pobieranie instalatora Forge ${minecraftVersion} (${forgeVer})...`
    });
  }

  const res = await fetch(installerUrl, {
    headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
  });
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać instalatora Forge (${res.status} ${res.statusText})`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(tempInstallerJar, buf);

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'forge_install',
      percent: 95,
      message: `Instalacja bibliotek silnika Forge dla ${minecraftVersion}... (chwila cierpliwości)`
    });
  }

  const launcher = require('./launcher');
  const javaManager = require('./javaManager');
  const reqMajor = javaManager.getRequiredJavaMajor(minecraftVersion);
  const javaExec = javaManager.resolveConsoleJava ? javaManager.resolveConsoleJava(reqMajor) : (launcher.resolveJavaExecutable ? launcher.resolveJavaExecutable() : 'java');

  await new Promise((resolve, reject) => {
    const cp = require('child_process').spawn(javaExec, ['-jar', tempInstallerJar, '--installClient', rootDir], {
      cwd: tempDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let errLog = '';
    cp.stdout.on('data', (d) => {
      const line = d.toString();
      if (typeof onProgress === 'function' && (line.includes('Task:') || line.includes('Patching'))) {
        const m = line.match(/(Task:[^\n]+|Patching[^\n]+)/);
        if (m) {
          onProgress({ stage: 'forge_install', percent: 97, message: `Forge: ${m[1].trim()}` });
        }
      }
    });
    cp.stderr.on('data', (d) => { errLog += d.toString(); });
    cp.on('close', (code) => {
      try { fs.unlinkSync(tempInstallerJar); } catch (_) {}
      if (code === 0 && fs.existsSync(versionJsonPath)) {
        try {
          const launcher = require('./launcher');
          if (typeof launcher.ensureVersionJsonArguments === 'function') {
            launcher.ensureVersionJsonArguments(rootDir, versionId);
          }
        } catch (_) {}
        resolve();
      } else {
        reject(new Error(`Instalator Forge zakończył się błędem (kod ${code}): ${errLog.slice(-300)}`));
      }
    });
    cp.on('error', (err) => {
      try { fs.unlinkSync(tempInstallerJar); } catch (_) {}
      reject(err);
    });
  });

  return versionId;
}

async function installQuilt(minecraftVersion = '1.21.1') {
  const appConfig = config.getConfig();
  const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;

  let baseJson = null;
  const baseJsonPath = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.json`);
  if (fs.existsSync(baseJsonPath)) {
    try {
      baseJson = JSON.parse(fs.readFileSync(baseJsonPath, 'utf8'));
    } catch (_) {}
  }

  if (!baseJson) {
    try {
      const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
      const manifest = await manifestRes.json();
      const verEntry = manifest.versions?.find(v => v.id === minecraftVersion);
      if (verEntry) {
        const verRes = await fetch(verEntry.url);
        baseJson = await verRes.json();
        const baseDir = path.join(gameDir, 'versions', minecraftVersion);
        if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
        fs.writeFileSync(baseJsonPath, JSON.stringify(baseJson, null, 2), 'utf8');
      }
    } catch (e) {
      console.warn('Nie udało się pobrać wersji bazowej dla Quilt:', e);
    }
  }

  const metaUrl = `https://meta.quiltmc.org/v3/versions/loader/${minecraftVersion}`;
  const metaRes = await fetch(metaUrl);
  if (!metaRes.ok) {
    throw new Error(`Brak wsparcia Quilt dla Minecraft ${minecraftVersion}`);
  }

  const loaders = await metaRes.json();
  if (!loaders || loaders.length === 0) {
    throw new Error(`Nie znaleziono loadera Quilt dla Minecraft ${minecraftVersion}`);
  }

  const loaderVersion = loaders[0].loader.version;

  const profileUrl = `https://meta.quiltmc.org/v3/versions/loader/${minecraftVersion}/${loaderVersion}/profile/json`;
  const profileRes = await fetch(profileUrl);
  if (!profileRes.ok) {
    throw new Error('Nie udało się pobrać profilu Quilt');
  }

  const quiltJson = await profileRes.json();
  const versionId = `quilt-${minecraftVersion}`;

  const versionDir = path.join(gameDir, 'versions', versionId);
  if (!fs.existsSync(versionDir)) {
    fs.mkdirSync(versionDir, { recursive: true });
  }

  const baseGameArgs = (baseJson?.arguments?.game && Array.isArray(baseJson.arguments.game)) ? baseJson.arguments.game : [];
  const quiltGameArgs = (quiltJson?.arguments?.game && Array.isArray(quiltJson.arguments.game)) ? quiltJson.arguments.game : [];

  const baseJvmArgs = (baseJson?.arguments?.jvm && Array.isArray(baseJson.arguments.jvm)) ? baseJson.arguments.jvm : [];
  const quiltJvmArgs = (quiltJson?.arguments?.jvm && Array.isArray(quiltJson.arguments.jvm)) ? quiltJson.arguments.jvm : [];

  const merged = {
    ...baseJson,
    ...quiltJson,
    id: versionId,
    inheritsFrom: minecraftVersion,
    arguments: {
      game: baseGameArgs.length > 0 ? [...baseGameArgs, ...quiltGameArgs] : quiltGameArgs,
      jvm: [...baseJvmArgs, ...quiltJvmArgs]
    },
    minecraftArguments: baseJson?.minecraftArguments || quiltJson.minecraftArguments,
    downloads: baseJson?.downloads || {},
    assetIndex: baseJson?.assetIndex || { id: minecraftVersion },
    assets: baseJson?.assets || minecraftVersion,
    libraries: [
      ...(quiltJson.libraries || []),
      ...(baseJson?.libraries || [])
    ],
    mainClass: quiltJson.mainClass || 'org.quiltmc.loader.impl.launch.knot.KnotClient'
  };

  fs.writeFileSync(path.join(versionDir, `${versionId}.json`), JSON.stringify(merged, null, 2), 'utf8');

  const baseJar = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.jar`);
  const quiltJar = path.join(versionDir, `${versionId}.jar`);
  if (fs.existsSync(baseJar) && !fs.existsSync(quiltJar)) {
    try {
      fs.copyFileSync(baseJar, quiltJar);
    } catch (_) {}
  }

  config.saveConfig({ selectedVersion: versionId });

  return {
    versionId,
    loaderVersion,
    minecraftVersion
  };
}

function copyModPaths(paths) {
  const modsDir = getModsDirectory();
  let count = 0;
  for (const p of paths) {
    if (fs.existsSync(p) && p.endsWith('.jar')) {
      const dest = path.join(modsDir, path.basename(p));
      fs.copyFileSync(p, dest);
      count++;
    }
  }
  return { added: count, mods: getInstalledMods() };
}

async function installSodium(minecraftVersion = '1.20.4') {
  const modsDir = getModsDirectory();
  const res = await fetch(`https://api.modrinth.com/v2/project/sodium/version?game_versions=["${minecraftVersion}"]&loaders=["fabric"]`);
  if (!res.ok) throw new Error(`Brak wersji Sodium dla Minecraft ${minecraftVersion}`);
  const versions = await res.json();
  if (!versions || versions.length === 0) throw new Error(`Nie znaleziono moda Sodium dla ${minecraftVersion}`);

  const file = versions[0].files?.[0];
  if (!file || !file.url) throw new Error('Brak adresu pliku moda');

  const destPath = path.join(modsDir, file.filename);
  const fileRes = await fetch(file.url);
  const fileBuf = await fileRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(fileBuf));

  await installFabric(minecraftVersion);

  return {
    filename: file.filename,
    mods: getInstalledMods()
  };
}

function getCandidateMcVersions(rawVersion) {
  const clean = String(rawVersion || '1.21.11').replace(/^(fabric|quilt)-/, '').trim();
  const candidates = [clean];
  const parts = clean.split('.');
  // Only add major.minor if the version explicitly ends in .0 (e.g. 1.21.0 -> 1.21)
  if (parts.length === 3 && parts[2] === '0') {
    candidates.push(`${parts[0]}.${parts[1]}`);
  }
  return candidates;
}

async function searchModrinth({
  query = '',
  projectType = 'all',
  category = '',
  loader = 'all',
  gameVersion = '1.21.11',
  sort = 'downloads',
  limit = 30,
  offset = 0,
  onlyCurrentVersion = false
} = {}) {
  try {
    const facets = [];

    if (projectType === 'modpack') {
      facets.push(['project_type:modpack']);
    } else if (projectType === 'mod') {
      facets.push(['project_type:mod']);
    } else if (projectType === 'shader' || projectType === 'shaderpacks') {
      facets.push(['project_type:shader']);
    } else if (projectType === 'resourcepack' || projectType === 'resourcepacks') {
      facets.push(['project_type:resourcepack']);
    } else {
      facets.push(['project_type:mod', 'project_type:modpack']);
    }

    if (loader && loader !== 'all') {
      facets.push([`categories:${loader}`]);
    }

    if (category && category !== 'all') {
      facets.push([`categories:${category}`]);
    }

    if (onlyCurrentVersion && gameVersion) {
      const candidates = getCandidateMcVersions(gameVersion);
      const verFacets = candidates.map(v => `versions:${v}`);
      facets.push(verFacets);
    }

    const params = new URLSearchParams();
    if (query && query.trim()) {
      params.append('query', query.trim());
    }
    params.append('facets', JSON.stringify(facets));
    params.append('index', sort || 'downloads');
    params.append('limit', String(limit || 30));
    params.append('offset', String(offset || 0));

    const url = `https://api.modrinth.com/v2/search?${params.toString()}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)'
      }
    });

    if (!res.ok) {
      throw new Error(`Błąd wyszukiwania Modrinth: ${res.statusText}`);
    }

    const data = await res.json();
    return {
      hits: data.hits || [],
      total_hits: data.total_hits || 0,
      offset: data.offset || 0,
      limit: data.limit || limit || 30
    };
  } catch (err) {
    console.error('Błąd searchModrinth:', err);
    throw err;
  }
}

async function getModrinthProjectVersions(idOrSlug) {
  try {
    const res = await fetch(`https://api.modrinth.com/v2/project/${idOrSlug}/version`, {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
    });
    if (!res.ok) throw new Error(`Błąd pobierania wersji dla ${idOrSlug}: ${res.statusText}`);
    return await res.json();
  } catch (err) {
    console.error('Błąd getModrinthProjectVersions:', err);
    throw err;
  }
}

async function installModrinthMod({ projectId, slug, gameVersion = '1.21.11', loader = 'fabric', versionId = null }) {
  const modsDir = getModsDirectory();
  const idOrSlug = slug || projectId;

  let targetVersion = null;

  if (versionId) {
    try {
      const res = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
      });
      if (res.ok) {
        targetVersion = await res.json();
      }
    } catch (e) {
      console.warn(`Błąd pobierania wersji po id ${versionId}:`, e.message);
    }
  }

  const cleanVer = String(gameVersion || '1.21.11').replace(/^(fabric|quilt)-/, '').trim();
  const loadersToTry = loader === 'quilt' ? ['quilt', 'fabric'] : [loader || 'fabric'];

  if (!targetVersion) {
    // 1. Najpierw szukaj wersji dokładnie dopasowanej do wersji gry i silnika
    try {
      const res = await fetch(
        `https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}&game_versions=${encodeURIComponent(JSON.stringify([cleanVer]))}`,
        { headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' } }
      );
      if (res.ok) {
        const exactVersions = await res.json();
        if (Array.isArray(exactVersions) && exactVersions.length > 0) {
          targetVersion = exactVersions.find(v => v.version_type === 'release') || exactVersions[0];
        }
      }
    } catch (err) {
      console.warn(`Błąd wyszukiwania wersji pod ${cleanVer}:`, err.message);
    }

    // 2. Jeśli wersja kończy się na .0 (np. 1.21.0), sprawdź też wersję nadrzędną 1.21
    if (!targetVersion) {
      const parts = cleanVer.split('.');
      if (parts.length === 3 && parts[2] === '0') {
        const mm = `${parts[0]}.${parts[1]}`;
        try {
          const res = await fetch(
            `https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}&game_versions=${encodeURIComponent(JSON.stringify([mm]))}`,
            { headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' } }
          );
          if (res.ok) {
            const mmVersions = await res.json();
            if (Array.isArray(mmVersions) && mmVersions.length > 0) {
              targetVersion = mmVersions.find(v => v.version_type === 'release') || mmVersions[0];
            }
          }
        } catch (_) {}
      }
    }

    // 3. Sprawdź, czy któraś z wersji loadera zawiera cleanVer w game_versions
    if (!targetVersion) {
      try {
        const res = await fetch(
          `https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}`,
          { headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' } }
        );
        if (res.ok) {
          const allVersions = await res.json();
          if (Array.isArray(allVersions)) {
            const matching = allVersions.find(v => Array.isArray(v.game_versions) && v.game_versions.includes(cleanVer));
            if (matching) targetVersion = matching;
          }
        }
      } catch (_) {}
    }

    // 4. Jeśli brak wersji kompatybilnej — NIGDY nie pobieraj losowej wersji z innego Minecrafta!
    if (!targetVersion) {
      throw new Error(`Mod "${idOrSlug}" nie posiada wersji kompatybilnej z Minecraft ${cleanVer} dla silnika ${loader}. Wybierz wersję ręcznie w szczegółach lub zmień wersję profilu.`);
    }
  }
  const primaryFile = (targetVersion.files && targetVersion.files.find(f => f.primary)) || targetVersion.files?.[0];
  if (!primaryFile || !primaryFile.url) {
    throw new Error(`Brak pliku do pobrania dla moda ${idOrSlug}.`);
  }

  // Usuń starsze / niekompatybilne wersje tego samego moda przed zapisem nowego
  const modSlug = String(slug || idOrSlug || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const filePrefix = primaryFile.filename.split(/[-_]\d+/)[0]?.toLowerCase();

  if (fs.existsSync(modsDir)) {
    const existing = fs.readdirSync(modsDir);
    for (const f of existing) {
      if ((f.endsWith('.jar') || f.endsWith('.jar.disabled')) && f !== primaryFile.filename) {
        const flow = f.toLowerCase();
        const matchesSlug = modSlug && modSlug.length >= 3 && flow.replace(/[^a-z0-9]/g, '').startsWith(modSlug);
        const matchesPrefix = filePrefix && filePrefix.length >= 3 && flow.startsWith(filePrefix);
        if (matchesSlug || matchesPrefix) {
          try {
            fs.unlinkSync(path.join(modsDir, f));
            console.log(`[Mods] Usunięto starszą wersję moda "${f}" przed instalacją nowej`);
          } catch (unErr) {
            console.warn(`[Mods] Błąd usuwania starej wersji ${f}:`, unErr.message);
          }
        }
      }
    }
  }

  const destPath = path.join(modsDir, primaryFile.filename);
  const fileRes = await fetch(primaryFile.url);
  if (!fileRes.ok) throw new Error(`Błąd pobierania pliku moda: ${fileRes.status}`);
  const buf = await fileRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));

  const installedDependencies = [];
  if (Array.isArray(targetVersion.dependencies)) {
    for (const dep of targetVersion.dependencies) {
      if (dep.dependency_type === 'required') {
        const depProjId = dep.project_id;
        if (depProjId) {
          try {
            const depRes = await fetch(
              `https://api.modrinth.com/v2/project/${depProjId}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}&game_versions=${encodeURIComponent(JSON.stringify([cleanVer]))}`,
              { headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' } }
            );
            if (depRes.ok) {
              const depVersions = await depRes.json();
              if (Array.isArray(depVersions) && depVersions.length > 0) {
                const depTarget = depVersions.find(v => v.version_type === 'release') || depVersions[0];
                const depFile = (depTarget.files && depTarget.files.find(f => f.primary)) || depTarget.files?.[0];
                if (depFile && depFile.url) {
                  const depDest = path.join(modsDir, depFile.filename);
                  if (!fs.existsSync(depDest)) {
                    const depPrefix = depFile.filename.split(/[-_]\d+/)[0]?.toLowerCase();
                    if (depPrefix && depPrefix.length >= 3) {
                      for (const f of fs.readdirSync(modsDir)) {
                        if ((f.endsWith('.jar') || f.endsWith('.jar.disabled')) && f !== depFile.filename && f.toLowerCase().startsWith(depPrefix)) {
                          try { fs.unlinkSync(path.join(modsDir, f)); } catch (_) {}
                        }
                      }
                    }
                    const depBufRes = await fetch(depFile.url);
                    if (depBufRes.ok) {
                      fs.writeFileSync(depDest, Buffer.from(await depBufRes.arrayBuffer()));
                      installedDependencies.push(depFile.filename);
                    }
                  }
                }
              }
            }
          } catch (depErr) {
            console.warn(`[Mods] Błąd pobierania zależności ${depProjId}:`, depErr.message);
          }
        } else if (dep.version_id) {
          try {
            const depVerRes = await fetch(`https://api.modrinth.com/v2/version/${dep.version_id}`, {
              headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' }
            });
            if (depVerRes.ok) {
              const depVer = await depVerRes.json();
              let chosenDepVer = depVer;
              if (depVer.project_id && (!depVer.game_versions || !depVer.game_versions.includes(cleanVer))) {
                try {
                  const cleanDepRes = await fetch(
                    `https://api.modrinth.com/v2/project/${depVer.project_id}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}&game_versions=${encodeURIComponent(JSON.stringify([cleanVer]))}`,
                    { headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (contact@szkolnesmp.com.pl)' } }
                  );
                  if (cleanDepRes.ok) {
                    const cleanList = await cleanDepRes.json();
                    if (Array.isArray(cleanList) && cleanList.length > 0) {
                      chosenDepVer = cleanList.find(v => v.version_type === 'release') || cleanList[0];
                    }
                  }
                } catch (_) {}
              }

              const depFile = (chosenDepVer.files && chosenDepVer.files.find(f => f.primary)) || chosenDepVer.files?.[0];
              if (depFile && depFile.url) {
                const depDest = path.join(modsDir, depFile.filename);
                if (!fs.existsSync(depDest)) {
                  const depBufRes = await fetch(depFile.url);
                  if (depBufRes.ok) {
                    fs.writeFileSync(depDest, Buffer.from(await depBufRes.arrayBuffer()));
                    installedDependencies.push(depFile.filename);
                  }
                }
              }
            }
          } catch (depErr) {
            console.warn('Nie udało się pobrać zależności po version_id:', depErr.message);
          }
        }
      }
    }
  }

  try {
    if (loader === 'quilt') {
      await installQuilt(cleanVer);
    } else {
      await installFabric(cleanVer);
    }
  } catch (fErr) {
    console.warn('Loader check warning:', fErr.message);
  }

  archiveMetaCache.clear();

  return {
    success: true,
    filename: primaryFile.filename,
    versionNumber: targetVersion.version_number,
    dependencies: installedDependencies,
    mods: getInstalledMods()
  };
}

async function installModrinthModpack({ projectId, slug, versionId, profileName, onProgress } = {}) {
  const idOrSlug = slug || projectId;
  if (!idOrSlug) throw new Error('Brak identyfikatora modpacka.');

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'fetching_meta',
      percent: 3,
      message: 'Pobieranie szczegółów wybranej wersji modpacka...',
      currentFile: idOrSlug,
      completedFiles: 0,
      totalFiles: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });
  }

  let targetVersion = null;
  if (versionId) {
    try {
      const res = await fetch(`https://api.modrinth.com/v2/version/${versionId}`, {
        headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
      });
      if (res.ok) targetVersion = await res.json();
    } catch (_) {}
  }

  if (!targetVersion) {
    const res = await fetch(`https://api.modrinth.com/v2/project/${idOrSlug}/version`, {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
    });
    if (!res.ok) throw new Error(`Nie udało się pobrać wersji modpacka: ${res.statusText}`);
    const versions = await res.json();
    if (!versions || versions.length === 0) throw new Error('Ten modpack nie posiada dostępnych wersji.');
    targetVersion = versions[0];
  }

  const mrpackFile = targetVersion.files?.find(f => f.filename?.endsWith('.mrpack') || f.primary) || targetVersion.files?.[0];
  if (!mrpackFile || !mrpackFile.url) {
    throw new Error('Brak pliku instalacyjnego .mrpack dla wybranej wersji modpacka.');
  }

  const mrpackTotalSize = mrpackFile.size || 0;
  let mrpackDownloadedBytes = 0;
  const mrpackStartTime = Date.now();

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'downloading_mrpack',
      percent: 6,
      message: `Pobieranie paczki .mrpack (${mrpackFile.filename})...`,
      currentFile: mrpackFile.filename,
      completedFiles: 0,
      totalFiles: 1,
      downloadedBytes: 0,
      totalBytes: mrpackTotalSize,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });
  }

  const mrpackRes = await fetch(mrpackFile.url, {
    headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
  });
  if (!mrpackRes.ok) throw new Error(`Błąd pobierania .mrpack: ${mrpackRes.statusText}`);

  let mrpackBuf = null;
  if (mrpackRes.body && typeof mrpackRes.body.getReader === 'function') {
    const reader = mrpackRes.body.getReader();
    const chunks = [];
    let lastMrpackReport = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        chunks.push(value);
        mrpackDownloadedBytes += value.length;

        const now = Date.now();
        if (now - lastMrpackReport > 120) {
          lastMrpackReport = now;
          const elapsed = Math.max(0.1, (now - mrpackStartTime) / 1000);
          const spd = mrpackDownloadedBytes / elapsed;
          const rem = Math.max(0, mrpackTotalSize - mrpackDownloadedBytes);
          const eta = spd > 1024 ? Math.round(rem / spd) : 0;
          const pct = mrpackTotalSize > 0
            ? 6 + Math.round((mrpackDownloadedBytes / mrpackTotalSize) * 16)
            : 15;

          if (typeof onProgress === 'function') {
            onProgress({
              stage: 'downloading_mrpack',
              percent: pct,
              message: `Pobieranie paczki .mrpack (${mrpackFile.filename})...`,
              currentFile: mrpackFile.filename,
              completedFiles: 0,
              totalFiles: 1,
              downloadedBytes: mrpackDownloadedBytes,
              totalBytes: mrpackTotalSize,
              speedBytesPerSec: Math.round(spd),
              etaSeconds: eta
            });
          }
        }
      }
    }
    mrpackBuf = Buffer.concat(chunks);
  } else {
    mrpackBuf = Buffer.from(await mrpackRes.arrayBuffer());
  }

  return await installMrpackFromBuffer(mrpackBuf, {
    profileName,
    fallbackName: idOrSlug,
    targetVersion,
    mrpackDownloadedBytes,
    mrpackTotalSize,
    onProgress
  });
}

async function installMrpackFromBuffer(mrpackBuf, {
  profileName = null,
  fallbackName = 'Paczka Modów',
  targetVersion = null,
  mrpackDownloadedBytes = 0,
  mrpackTotalSize = 0,
  onProgress = null
} = {}) {
  if (!AdmZip) {
    throw new Error('Biblioteka archiwów (AdmZip) nie jest dostępna.');
  }

  const zip = new AdmZip(mrpackBuf);
  const indexEntry = zip.getEntry('modrinth.index.json');
  if (!indexEntry) {
    throw new Error('Nieprawidłowy plik .mrpack: brak pliku modrinth.index.json.');
  }

  const index = JSON.parse(indexEntry.getData().toString('utf8'));
  let kasteuszMeta = null;
  const kasteuszEntry = zip.getEntry('kasteusz.profile.json');
  if (kasteuszEntry) {
    try {
      kasteuszMeta = JSON.parse(kasteuszEntry.getData().toString('utf8'));
    } catch (_) {}
  }

  const mcVersion = targetVersion?.game_versions?.[0] || index.dependencies?.minecraft || kasteuszMeta?.mcVersion || '1.21.1';

  let loader = kasteuszMeta?.loader || 'fabric';
  let forgeVersion = kasteuszMeta?.forgeVersion || null;
  if (index.dependencies?.['quilt-loader']) {
    loader = 'quilt';
  } else if (index.dependencies?.['fabric-loader']) {
    loader = 'fabric';
  } else if (index.dependencies?.['forge']) {
    loader = 'forge';
    forgeVersion = index.dependencies['forge'];
  } else if (index.dependencies?.['neoforge']) {
    loader = 'forge';
    forgeVersion = index.dependencies['neoforge'];
  } else if (targetVersion?.loaders?.includes('forge')) {
    loader = 'forge';
  } else if (targetVersion?.loaders?.includes('neoforge')) {
    loader = 'forge';
  } else if (targetVersion?.loaders?.includes('quilt')) {
    loader = 'quilt';
  } else if (index.dependencies && Object.keys(index.dependencies).length === 1 && index.dependencies.minecraft && kasteuszMeta?.loader === 'vanilla') {
    loader = 'vanilla';
  }

  const rawPackTitle = profileName || index.name || targetVersion?.name || fallbackName;
  const finalProfileName = rawPackTitle.startsWith('[Modpack]') || kasteuszMeta ? rawPackTitle : `[Modpack] ${rawPackTitle}`;
  const customVersionId = loader === 'forge' && forgeVersion ? `${mcVersion}-forge-${forgeVersion}` : null;

  const profilesResult = profiles.createProfile({
    name: finalProfileName,
    mcVersion,
    loader,
    customVersionId,
    forgeVersion,
    memoryMax: kasteuszMeta?.memoryMax || null,
    jvmPreset: kasteuszMeta?.jvmPreset || null,
    icon: kasteuszMeta?.icon || 'crown',
    isolated: true
  });

  const createdProfile = profilesResult.profiles.find(p => p.id === profilesResult.activeProfileId)
    || profilesResult.profiles[profilesResult.profiles.length - 1];

  const instanceDir = profiles.resolveProfileInstanceDir(createdProfile);
  if (!fs.existsSync(instanceDir)) {
    fs.mkdirSync(instanceDir, { recursive: true });
  }

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'extracting_overrides',
      percent: 24,
      message: 'Wypakowywanie konfiguracji, shaderów i opcji...',
      currentFile: 'overrides/',
      completedFiles: 0,
      totalFiles: 1,
      downloadedBytes: mrpackDownloadedBytes,
      totalBytes: mrpackTotalSize,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });
  }

  const zipEntries = zip.getEntries();
  for (const entry of zipEntries) {
    let relPath = null;
    if (entry.entryName.startsWith('overrides/')) {
      relPath = entry.entryName.slice('overrides/'.length);
    } else if (entry.entryName.startsWith('client-overrides/')) {
      relPath = entry.entryName.slice('client-overrides/'.length);
    }

    if (!relPath) continue;

    const destPath = path.join(instanceDir, relPath);
    if (entry.isDirectory) {
      if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
    } else {
      const parent = path.dirname(destPath);
      if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }
  }

  const clientFiles = (index.files || []).filter(f => !f.env || f.env.client !== 'unsupported');
  const totalFiles = clientFiles.length;
  const totalModBytes = clientFiles.reduce((acc, f) => acc + (f.fileSize || 0), 0);

  let totalBytesDownloaded = 0;
  let completedFiles = 0;
  let lastBytes = 0;
  let lastSampleTime = Date.now();
  let lastIpcEmitTime = 0;
  const speedSamples = [];

  function emitModProgress(currentFileName = '', force = false) {
    if (typeof onProgress !== 'function') return;
    const now = Date.now();
    if (!force && now - lastIpcEmitTime < 120) return;
    lastIpcEmitTime = now;

    const dt = (now - lastSampleTime) / 1000;
    if (dt >= 0.25) {
      const instSpeed = (totalBytesDownloaded - lastBytes) / Math.max(0.001, dt);
      lastSampleTime = now;
      lastBytes = totalBytesDownloaded;
      speedSamples.push(instSpeed);
      if (speedSamples.length > 5) speedSamples.shift();
    }
    const avgSpeed = speedSamples.length > 0
      ? speedSamples.reduce((a, b) => a + b, 0) / speedSamples.length
      : 0;

    const remainingBytes = Math.max(0, totalModBytes - totalBytesDownloaded);
    const etaSeconds = avgSpeed > 1024 ? Math.round(remainingBytes / avgSpeed) : 0;
    const progressSpan = totalModBytes > 0
      ? Math.round((totalBytesDownloaded / totalModBytes) * 67)
      : Math.round((completedFiles / Math.max(1, totalFiles)) * 67);
    const pct = Math.min(92, 25 + progressSpan);

    onProgress({
      stage: 'downloading_mods',
      percent: pct,
      completedFiles,
      totalFiles,
      downloadedBytes: totalBytesDownloaded,
      totalBytes: totalModBytes,
      speedBytesPerSec: Math.round(avgSpeed),
      etaSeconds,
      currentFile: currentFileName,
      message: `Pobieranie modów: ${completedFiles} / ${totalFiles}`
    });
  }

  emitModProgress('Inicjalizacja pobierania modów...', true);

  const CONCURRENCY = 5;
  const queue = [...clientFiles];

  async function downloadWorker() {
    while (queue.length > 0) {
      const fileObj = queue.shift();
      if (!fileObj) break;

      const fileUrl = fileObj.downloads?.[0];
      if (!fileUrl) continue;

      const fileName = path.basename(fileObj.path);
      const destPath = path.join(instanceDir, fileObj.path);
      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }

      try {
        const fileRes = await fetch(fileUrl, {
          headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
        });
        if (fileRes.ok) {
          if (fileRes.body && typeof fileRes.body.getReader === 'function') {
            const reader = fileRes.body.getReader();
            const chunks = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value && value.length > 0) {
                chunks.push(value);
                totalBytesDownloaded += value.length;
                emitModProgress(fileName, false);
              }
            }
            fs.writeFileSync(destPath, Buffer.concat(chunks));
          } else {
            const buf = Buffer.from(await fileRes.arrayBuffer());
            totalBytesDownloaded += buf.length;
            fs.writeFileSync(destPath, buf);
          }
        }
      } catch (err) {
        console.warn(`[Modpack] Błąd pobierania ${fileObj.path}:`, err.message);
      }

      completedFiles++;
      emitModProgress(fileName, true);
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, Math.max(1, queue.length)) }, () => downloadWorker());
  await Promise.all(workers);

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'installing_loader',
      percent: 94,
      message: `Konfiguracja silnika ${loader} dla Minecraft ${mcVersion}...`,
      currentFile: `${loader}-${mcVersion}`,
      completedFiles: totalFiles,
      totalFiles,
      downloadedBytes: totalModBytes,
      totalBytes: totalModBytes,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });
  }

  try {
    if (loader === 'fabric') {
      await installFabric(mcVersion);
    } else if (loader === 'quilt') {
      await installQuilt(mcVersion);
    } else if (loader === 'forge' || loader === 'neoforge') {
      const forgeVerId = await installForge(mcVersion, forgeVersion, (p) => {
        if (typeof onProgress === 'function') onProgress(p);
      });
      if (forgeVerId && createdProfile) {
        profiles.updateProfile(createdProfile.id, {
          customVersionId: forgeVerId
        });
      }
    }
  } catch (loaderErr) {
    console.warn('[Modpack] Uwaga podczas instalacji loadera:', loaderErr.message);
  }

  try {
    const launcher = require('./launcher');
    if (typeof launcher.ensureKasteuszClientTheme === 'function') {
      launcher.ensureKasteuszClientTheme(instanceDir);
    }
    if (typeof launcher.cleanupKasteuszClientHudMod === 'function') {
      launcher.cleanupKasteuszClientHudMod(instanceDir);
    }
  } catch (tErr) {
    console.warn('[Modpack] Uwaga podczas instalacji motywu:', tErr.message);
  }

  profiles.setActiveProfile(createdProfile.id);

  if (typeof onProgress === 'function') {
    onProgress({
      stage: 'completed',
      percent: 100,
      message: 'Modpack zainstalowany pomyślnie!',
      currentFile: 'Gotowe',
      completedFiles: totalFiles,
      totalFiles,
      downloadedBytes: totalModBytes,
      totalBytes: totalModBytes,
      speedBytesPerSec: 0,
      etaSeconds: 0
    });
  }

  return {
    success: true,
    profile: createdProfile,
    modCount: completedFiles,
    name: finalProfileName
  };
}

function getPacksList(type = 'resourcepacks') {
  const dir = getPacksDirectory(type);
  try {
    const entries = fs.readdirSync(dir);
    const items = [];

    for (const filename of entries) {
      if (filename.startsWith('.')) continue;
      if (filename === 'KasteuszOfflineSkin.zip' || filename === 'KasteuszClient-Menu.zip') continue;
      const fullPath = path.join(dir, filename);
      let stats;
      try {
        stats = fs.statSync(fullPath);
      } catch (_) {
        continue;
      }

      const isDir = stats.isDirectory();
      const isZip = filename.endsWith('.zip') || filename.endsWith('.zip.disabled');
      const isDisabledDir = isDir && filename.endsWith('.disabled');

      if (!isDir && !isZip) continue;

      const enabled = !filename.endsWith('.disabled');
      const cleanName = filename
        .replace(/\.zip(\.disabled)?$/i, '')
        .replace(/\.disabled$/i, '');

      const meta = inspectPackMetadata(fullPath, isDir, stats.mtimeMs);

      items.push({
        filename,
        name: cleanName,
        description: meta.description || (type === 'shaderpacks' ? 'Paczka shaderów GLSL / Iris' : 'Pakiet zasobów Minecraft'),
        packFormat: meta.packFormat,
        iconDataUrl: meta.iconDataUrl,
        size: isDir ? 'Folder' : formatBytes(stats.size),
        bytes: isDir ? 0 : stats.size,
        isDirectory: isDir || isDisabledDir,
        enabled,
        modified: stats.mtime
      });
    }

    return items.sort((a, b) => b.modified - a.modified);
  } catch (err) {
    console.error(`Błąd odczytu katalogu ${type}:`, err);
    return [];
  }
}

async function selectAndAddPacks(parentWindow, type = 'resourcepacks') {
  const dir = getPacksDirectory(type);
  const label = type === 'shaderpacks' ? 'Shadery Minecraft (*.zip)' : 'Pakiety Zasobów (*.zip)';
  const result = await dialog.showOpenDialog(parentWindow, {
    title: type === 'shaderpacks' ? 'Wybierz paczki shaderów (.zip)' : 'Wybierz pakiety zasobów (.zip)',
    filters: [{ name: label, extensions: ['zip'] }],
    properties: ['openFile', 'multiSelections']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { added: 0, packs: getPacksList(type) };
  }

  let added = 0;
  for (const srcPath of result.filePaths) {
    const baseName = path.basename(srcPath);
    const destPath = path.join(dir, baseName);
    try {
      fs.copyFileSync(srcPath, destPath);
      added++;
    } catch (err) {
      console.error(`Nie udało się skopiować paczki ${baseName}:`, err);
    }
  }

  return { added, packs: getPacksList(type) };
}

function copyPackPaths(type = 'resourcepacks', paths = []) {
  const dir = getPacksDirectory(type);
  let count = 0;
  for (const p of paths) {
    if (!p || !fs.existsSync(p)) continue;
    const stat = fs.statSync(p);
    if (!stat.isDirectory() && p.toLowerCase().endsWith('.zip')) {
      const dest = path.join(dir, path.basename(p));
      try {
        fs.copyFileSync(p, dest);
        count++;
      } catch (_) {}
    }
  }
  return { added: count, packs: getPacksList(type) };
}

function togglePack(type = 'resourcepacks', filename) {
  const dir = getPacksDirectory(type);
  const currentPath = path.join(dir, filename);
  if (!fs.existsSync(currentPath)) {
    throw new Error('Plik paczki nie istnieje.');
  }
  const newFilename = filename.endsWith('.disabled')
    ? filename.replace(/\.disabled$/, '')
    : `${filename}.disabled`;
  fs.renameSync(currentPath, path.join(dir, newFilename));
  return getPacksList(type);
}

function deletePack(type = 'resourcepacks', filename) {
  const dir = getPacksDirectory(type);
  const targetPath = path.join(dir, filename);
  if (fs.existsSync(targetPath)) {
    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }
  }
  return getPacksList(type);
}

function openPacksFolder(type = 'resourcepacks') {
  const dir = getPacksDirectory(type);
  shell.openPath(dir);
  return dir;
}

async function installModrinthPack({
  projectId,
  slug,
  packType = 'shaderpacks',
  gameVersion = '1.21.11',
  loader = 'fabric'
} = {}) {
  const normalizedType = packType === 'shaderpacks' ? 'shaderpacks' : 'resourcepacks';
  const targetDir = getPacksDirectory(normalizedType);
  const idOrSlug = slug || projectId;
  if (!idOrSlug) throw new Error('Brak identyfikatora paczki na Modrinth.');

  const candidates = getCandidateMcVersions(gameVersion);
  const ua = { 'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)' };

  let versions = [];
  try {
    const res = await fetch(
      `https://api.modrinth.com/v2/project/${encodeURIComponent(idOrSlug)}/version?game_versions=${encodeURIComponent(JSON.stringify(candidates))}`,
      { headers: ua }
    );
    if (res.ok) versions = await res.json();
  } catch (_) {}

  if (!Array.isArray(versions) || versions.length === 0) {
    const res = await fetch(
      `https://api.modrinth.com/v2/project/${encodeURIComponent(idOrSlug)}/version`,
      { headers: ua }
    );
    if (res.ok) versions = await res.json();
  }

  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`Brak plików do pobrania dla ${idOrSlug}.`);
  }

  const chosen = versions[0];
  const file = (chosen.files && chosen.files.find(f => f.primary)) || chosen.files?.[0];
  if (!file || !file.url) {
    throw new Error(`Nie znaleziono archiwum .zip dla ${idOrSlug}.`);
  }

  const destPath = path.join(targetDir, file.filename);
  const dlRes = await fetch(file.url, { headers: ua });
  if (!dlRes.ok) {
    throw new Error(`Błąd pobierania paczki (${dlRes.status}).`);
  }
  const buf = Buffer.from(await dlRes.arrayBuffer());
  fs.writeFileSync(destPath, buf);

  const instanceDir = profiles.getActiveInstanceDirectory();
  const autoInstalledMods = [];

  if (normalizedType === 'shaderpacks') {
    // Auto-set active shader in iris.properties so user sees it right away
    try {
      const cfgDir = path.join(instanceDir, 'config');
      fs.mkdirSync(cfgDir, { recursive: true });
      const irisPropPath = path.join(cfgDir, 'iris.properties');
      let lines = fs.existsSync(irisPropPath) ? fs.readFileSync(irisPropPath, 'utf8').split('\n') : [];
      const setProp = (k, v) => {
        const idx = lines.findIndex(l => l.startsWith(`${k}=`));
        if (idx >= 0) lines[idx] = `${k}=${v}`;
        else lines.push(`${k}=${v}`);
      };
      setProp('shaderPack', file.filename);
      setProp('enableShaders', 'true');
      fs.writeFileSync(irisPropPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
    } catch (_) {}

    // Ensure Iris & Sodium are installed if profile uses Fabric or Quilt
    if (loader === 'fabric' || loader === 'quilt') {
      const modsDir = getModsDirectory();
      const existingLower = fs.existsSync(modsDir)
        ? fs.readdirSync(modsDir).map(f => f.toLowerCase())
        : [];
      const hasIris = existingLower.some(f => f.includes('iris') && f.endsWith('.jar'));
      const hasSodium = existingLower.some(f => f.includes('sodium') && f.endsWith('.jar'));

      if (!hasSodium) {
        try {
          const sRes = await installModrinthMod({ slug: 'sodium', gameVersion, loader });
          if (sRes?.filename) autoInstalledMods.push('Sodium');
        } catch (_) {}
      }
      if (!hasIris) {
        try {
          const iRes = await installModrinthMod({ slug: 'iris', gameVersion, loader });
          if (iRes?.filename) autoInstalledMods.push('Iris Shaders');
        } catch (_) {}
      }
    }
  } else {
    // Enable downloaded resourcepack in options.txt automatically
    try {
      const optionsPath = path.join(instanceDir, 'options.txt');
      const entryName = `file/${file.filename}`;
      let lines = fs.existsSync(optionsPath) ? fs.readFileSync(optionsPath, 'utf8').split('\n') : [];
      const rpIdx = lines.findIndex(l => l.startsWith('resourcePacks:'));
      if (rpIdx >= 0) {
        let list = [];
        try { list = JSON.parse(lines[rpIdx].replace(/^resourcePacks:/, '').trim()); } catch (_) { list = ['vanilla']; }
        if (!Array.isArray(list)) list = ['vanilla'];
        if (!list.includes(entryName)) {
          list.push(entryName);
          lines[rpIdx] = `resourcePacks:${JSON.stringify(list)}`;
          fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
        }
      } else {
        lines.push(`resourcePacks:["vanilla",${JSON.stringify(entryName)}]`);
        fs.writeFileSync(optionsPath, lines.filter(Boolean).join('\n') + '\n', 'utf8');
      }
    } catch (_) {}
  }

  return {
    success: true,
    filename: file.filename,
    versionNumber: chosen.version_number,
    autoInstalledMods,
    packs: getPacksList(normalizedType)
  };
}

async function updateInstalledMods({ gameVersion = '1.21.11', loader = 'fabric' } = {}) {
  const modsDir = getModsDirectory();
  if (!fs.existsSync(modsDir)) {
    return { checkedCount: 0, updatedCount: 0, updatedMods: [], mods: [] };
  }

  const entries = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'));
  if (entries.length === 0) {
    return { checkedCount: 0, updatedCount: 0, updatedMods: [], mods: getInstalledMods() };
  }

  const hashToLocal = new Map();
  for (const filename of entries) {
    const fullPath = path.join(modsDir, filename);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) continue;
      const buf = fs.readFileSync(fullPath);
      const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
      hashToLocal.set(sha1, {
        filename,
        fullPath,
        disabled: filename.endsWith('.disabled')
      });
    } catch (_) {}
  }

  const hashes = Array.from(hashToLocal.keys());
  if (hashes.length === 0) {
    return { checkedCount: 0, updatedCount: 0, updatedMods: [], mods: getInstalledMods() };
  }

  const loaders = loader === 'quilt' ? ['quilt', 'fabric'] : [loader || 'fabric'];
  const candidates = getCandidateMcVersions(gameVersion);
  const ua = {
    'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)',
    'Content-Type': 'application/json'
  };

  const res = await fetch('https://api.modrinth.com/v2/version_files/update', {
    method: 'POST',
    headers: ua,
    body: JSON.stringify({
      hashes,
      algorithm: 'sha1',
      loaders,
      game_versions: candidates
    })
  });

  if (!res.ok) {
    throw new Error(`Błąd sprawdzania aktualizacji na Modrinth (${res.status}).`);
  }

  const updatesMap = await res.json();
  const updatedMods = [];

  for (const [oldSha1, latestVer] of Object.entries(updatesMap || {})) {
    const localInfo = hashToLocal.get(oldSha1);
    if (!localInfo || !latestVer || !Array.isArray(latestVer.files)) continue;

    const primaryFile = latestVer.files.find(f => f.primary) || latestVer.files[0];
    if (!primaryFile || !primaryFile.url) continue;

    const newSha1 = primaryFile.hashes?.sha1;
    if (newSha1 && newSha1.toLowerCase() === oldSha1.toLowerCase()) {
      continue; // Already on newest compatible version
    }

    try {
      const dlRes = await fetch(primaryFile.url, {
        headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)' }
      });
      if (!dlRes.ok) continue;
      const newBuf = Buffer.from(await dlRes.arrayBuffer());

      const targetFileName = localInfo.disabled ? `${primaryFile.filename}.disabled` : primaryFile.filename;
      const newPath = path.join(modsDir, targetFileName);
      fs.writeFileSync(newPath, newBuf);

      if (path.resolve(newPath) !== path.resolve(localInfo.fullPath) && fs.existsSync(localInfo.fullPath)) {
        try { fs.unlinkSync(localInfo.fullPath); } catch (_) {}
      }

      updatedMods.push({
        oldFile: localInfo.filename,
        newFile: targetFileName,
        version: latestVer.version_number || latestVer.name || ''
      });
    } catch (err) {
      console.warn(`[ModUpdate] Nie udało się zaktualizować ${localInfo.filename}:`, err.message);
    }
  }

  archiveMetaCache.clear();
  return {
    checkedCount: hashes.length,
    updatedCount: updatedMods.length,
    updatedMods,
    mods: getInstalledMods()
  };
}

async function exportProfileToMrpack(parentWindow, profileId = null) {
  if (!AdmZip) {
    throw new Error('Biblioteka archiwów (AdmZip) nie jest dostępna.');
  }

  const state = profiles.getProfilesState();
  const targetProf = (profileId && state.profiles.find(p => p.id === profileId))
    || state.profiles.find(p => p.id === state.activeProfileId)
    || state.profiles[0];

  if (!targetProf) {
    throw new Error('Nie znaleziono profilu do wyeksportowania.');
  }

  const safeFileBase = String(targetProf.name || 'Paczka-Kasteusz')
    .replace(/^\[Modpack\]\s*/i, '')
    .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ _.-]/g, '')
    .trim()
    .replace(/\s+/g, '-') || 'Paczka-Kasteusz';

  const saveDialog = await dialog.showSaveDialog(parentWindow, {
    title: `Eksportuj paczkę profilu „${targetProf.name}” dla znajomych`,
    defaultPath: `${safeFileBase}.mrpack`,
    filters: [
      { name: 'Paczka modów Kasteusz / Modrinth (.mrpack)', extensions: ['mrpack'] }
    ]
  });

  if (saveDialog.canceled || !saveDialog.filePath) {
    return { canceled: true };
  }

  const outPath = saveDialog.filePath.endsWith('.mrpack')
    ? saveDialog.filePath
    : `${saveDialog.filePath}.mrpack`;

  const instanceDir = profiles.resolveProfileInstanceDir(targetProf);
  const candidateFiles = [];

  const collectFolderFiles = (subFolder, allowedExt) => {
    const fullDir = path.join(instanceDir, subFolder);
    if (!fs.existsSync(fullDir)) return;
    for (const entry of fs.readdirSync(fullDir)) {
      if (entry.startsWith('.') || entry.endsWith('.disabled')) continue;
      if (entry === 'KasteuszOfflineSkin.zip' || entry === 'KasteuszClient-Menu.zip') continue;
      if (allowedExt && !entry.toLowerCase().endsWith(allowedExt)) continue;
      const fullPath = path.join(fullDir, entry);
      try {
        const st = fs.statSync(fullPath);
        if (!st.isFile()) continue;
        const buf = fs.readFileSync(fullPath);
        const sha1 = crypto.createHash('sha1').update(buf).digest('hex');
        const sha512 = crypto.createHash('sha512').update(buf).digest('hex');
        candidateFiles.push({
          relPath: `${subFolder}/${entry}`,
          fullPath,
          buf,
          size: st.size,
          sha1,
          sha512
        });
      } catch (_) {}
    }
  };

  if (targetProf.loader !== 'vanilla') {
    collectFolderFiles('mods', '.jar');
  }
  collectFolderFiles('shaderpacks', '.zip');
  collectFolderFiles('resourcepacks', '.zip');

  // Batch lookup on Modrinth so known mods/shaders take 0 bytes in the .mrpack!
  let modrinthMap = {};
  if (candidateFiles.length > 0) {
    try {
      const res = await fetch('https://api.modrinth.com/v2/version_files', {
        method: 'POST',
        headers: {
          'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          hashes: candidateFiles.map(f => f.sha1),
          algorithm: 'sha1'
        })
      });
      if (res.ok) {
        modrinthMap = await res.json();
      }
    } catch (_) {}
  }

  const zip = new AdmZip();
  const indexFiles = [];
  let modrinthLinkedCount = 0;
  let embeddedFilesCount = 0;

  for (const item of candidateFiles) {
    const matchedVer = modrinthMap?.[item.sha1];
    const matchedFile = matchedVer?.files?.find(f => f.hashes?.sha1 === item.sha1) || matchedVer?.files?.[0];

    if (matchedFile && matchedFile.url) {
      indexFiles.push({
        path: item.relPath,
        hashes: {
          sha1: matchedFile.hashes?.sha1 || item.sha1,
          sha512: matchedFile.hashes?.sha512 || item.sha512
        },
        env: { client: 'required', server: 'optional' },
        downloads: [matchedFile.url],
        fileSize: matchedFile.size || item.size
      });
      modrinthLinkedCount++;
    } else {
      zip.addFile(`overrides/${item.relPath}`, item.buf);
      embeddedFilesCount++;
    }
  }

  // Include lightweight config/ files, options.txt, and servers.dat
  const addConfigDirRecursive = (dirPath, relPrefix) => {
    if (!fs.existsSync(dirPath)) return;
    for (const name of fs.readdirSync(dirPath)) {
      if (name.startsWith('.') || /cache|crash|logs|backups/i.test(name)) continue;
      const fp = path.join(dirPath, name);
      const rel = `${relPrefix}/${name}`;
      try {
        const st = fs.statSync(fp);
        if (st.isDirectory()) {
          addConfigDirRecursive(fp, rel);
        } else if (st.isFile() && st.size <= 2 * 1024 * 1024) {
          zip.addFile(`overrides/${rel}`, fs.readFileSync(fp));
        }
      } catch (_) {}
    }
  };
  addConfigDirRecursive(path.join(instanceDir, 'config'), 'config');

  for (const singleFile of ['options.txt', 'servers.dat']) {
    const fp = path.join(instanceDir, singleFile);
    if (fs.existsSync(fp)) {
      try {
        const st = fs.statSync(fp);
        if (st.isFile() && st.size <= 1024 * 1024) {
          zip.addFile(`overrides/${singleFile}`, fs.readFileSync(fp));
        }
      } catch (_) {}
    }
  }

  const dependencies = {
    minecraft: targetProf.mcVersion || '1.21.11'
  };
  if (targetProf.loader === 'fabric') {
    dependencies['fabric-loader'] = '*';
  } else if (targetProf.loader === 'quilt') {
    dependencies['quilt-loader'] = '*';
  } else if (targetProf.loader === 'forge') {
    dependencies.forge = targetProf.forgeVersion || '*';
  }

  const cleanPackName = String(targetProf.name || 'Paczka Kasteusz').replace(/^\[Modpack\]\s*/i, '');
  const mrpackIndex = {
    formatVersion: 1,
    game: 'minecraft',
    versionId: '1.0.0',
    name: cleanPackName,
    summary: `Paczka wyeksportowana z Kasteusz Launcher (${cleanPackName})`,
    files: indexFiles,
    dependencies
  };

  const kasteuszMeta = {
    exportedBy: 'Kasteusz Launcher',
    exportedAt: new Date().toISOString(),
    mcVersion: targetProf.mcVersion,
    loader: targetProf.loader,
    forgeVersion: targetProf.forgeVersion || null,
    memoryMax: targetProf.memoryMax || null,
    jvmPreset: targetProf.jvmPreset || null,
    icon: targetProf.icon || 'bolt'
  };

  zip.addFile('modrinth.index.json', Buffer.from(JSON.stringify(mrpackIndex, null, 2), 'utf8'));
  zip.addFile('kasteusz.profile.json', Buffer.from(JSON.stringify(kasteuszMeta, null, 2), 'utf8'));
  zip.writeZip(outPath);

  const finalStat = fs.statSync(outPath);
  return {
    success: true,
    filePath: outPath,
    profileName: cleanPackName,
    modrinthLinkedCount,
    embeddedFilesCount,
    sizeFormatted: formatBytes(finalStat.size)
  };
}

async function importMrpackFromFile(parentWindow, explicitPath = null, onProgress = null) {
  let filePath = explicitPath;
  if (!filePath) {
    const openDialog = await dialog.showOpenDialog(parentWindow, {
      title: 'Wybierz paczkę .mrpack od znajomego lub z Modrinth',
      filters: [
        { name: 'Paczka modów (.mrpack)', extensions: ['mrpack'] }
      ],
      properties: ['openFile']
    });
    if (openDialog.canceled || openDialog.filePaths.length === 0) {
      return { canceled: true };
    }
    filePath = openDialog.filePaths[0];
  }

  if (!fs.existsSync(filePath)) {
    throw new Error('Wybrany plik .mrpack nie istnieje.');
  }

  const mrpackBuf = fs.readFileSync(filePath);
  const fallbackName = path.basename(filePath, '.mrpack');

  return await installMrpackFromBuffer(mrpackBuf, {
    fallbackName,
    mrpackDownloadedBytes: mrpackBuf.length,
    mrpackTotalSize: mrpackBuf.length,
    onProgress
  });
}

module.exports = {
  getModsDirectory,
  getInstalledMods,
  selectAndAddMods,
  copyModPaths,
  toggleMod,
  deleteMod,
  openModsFolder,
  installFabric,
  installQuilt,
  installForge,
  installSodium,
  searchModrinth,
  getModrinthProjectVersions,
  installModrinthMod,
  installModrinthModpack,
  installModrinthPack,
  updateInstalledMods,
  exportProfileToMrpack,
  importMrpackFromFile,
  getPacksDirectory,
  getPacksList,
  selectAndAddPacks,
  copyPackPaths,
  togglePack,
  deletePack,
  openPacksFolder
};
