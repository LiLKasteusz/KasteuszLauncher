const fs = require('fs');
const path = require('path');
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
  const javaExec = launcher.resolveJavaExecutable ? launcher.resolveJavaExecutable() : 'java';

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
  if (parts.length >= 2) {
    const majorMinor = `${parts[0]}.${parts[1]}`;
    if (!candidates.includes(majorMinor)) candidates.push(majorMinor);
    if (parts.length === 3 && parseInt(parts[2], 10) > 1) {
      const dotOne = `${parts[0]}.${parts[1]}.1`;
      if (!candidates.includes(dotOne)) candidates.push(dotOne);
    }
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

async function installModrinthMod({ projectId, slug, gameVersion = '1.21.11', loader = 'fabric' }) {
  const modsDir = getModsDirectory();
  const idOrSlug = slug || projectId;
  const candidates = getCandidateMcVersions(gameVersion);

  let versions = [];
  const loadersToTry = loader === 'quilt' ? ['quilt', 'fabric'] : [loader || 'fabric'];

  try {
    const res = await fetch(
      `https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}&game_versions=${encodeURIComponent(JSON.stringify(candidates))}`,
      { headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' } }
    );
    if (res.ok) {
      versions = await res.json();
    }
  } catch (err) {
    console.warn(`Nie znaleziono wersji pod ${candidates.join(',')}, szukam ogólnej...`, err);
  }

  if (!versions || versions.length === 0) {
    const res = await fetch(
      `https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=${encodeURIComponent(JSON.stringify(loadersToTry))}`,
      { headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' } }
    );
    if (res.ok) {
      versions = await res.json();
    }
  }

  if (!versions || versions.length === 0) {
    const res = await fetch(
      `https://api.modrinth.com/v2/project/${idOrSlug}/version`,
      { headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' } }
    );
    if (res.ok) {
      versions = await res.json();
    }
  }

  if (!versions || versions.length === 0) {
    throw new Error(`Nie znaleziono wersji moda ${idOrSlug} do pobrania.`);
  }

  const targetVersion = versions[0];
  const primaryFile = (targetVersion.files && targetVersion.files.find(f => f.primary)) || targetVersion.files?.[0];
  if (!primaryFile || !primaryFile.url) {
    throw new Error(`Brak pliku do pobrania dla moda ${idOrSlug}.`);
  }

  const destPath = path.join(modsDir, primaryFile.filename);
  const fileRes = await fetch(primaryFile.url);
  if (!fileRes.ok) throw new Error(`Błąd pobierania pliku moda: ${fileRes.status}`);
  const buf = await fileRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));

  const installedDependencies = [];
  if (Array.isArray(targetVersion.dependencies)) {
    for (const dep of targetVersion.dependencies) {
      if (dep.dependency_type === 'required' && dep.version_id) {
        try {
          const depVerRes = await fetch(`https://api.modrinth.com/v2/version/${dep.version_id}`, {
            headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
          });
          if (depVerRes.ok) {
            const depVer = await depVerRes.json();
            const depFile = (depVer.files && depVer.files.find(f => f.primary)) || depVer.files?.[0];
            if (depFile) {
              const depDest = path.join(modsDir, depFile.filename);
              if (!fs.existsSync(depDest)) {
                const depBufRes = await fetch(depFile.url);
                if (depBufRes.ok) {
                  const depBuf = await depBufRes.arrayBuffer();
                  fs.writeFileSync(depDest, Buffer.from(depBuf));
                  installedDependencies.push(depFile.filename);
                }
              }
            }
          }
        } catch (depErr) {
          console.warn('Nie udało się pobrać zależności:', dep, depErr);
        }
      }
    }
  }

  try {
    const cleanVer = candidates[0] || '1.21.11';
    if (loader === 'quilt') {
      await installQuilt(cleanVer);
    } else {
      await installFabric(cleanVer);
    }
  } catch (fErr) {
    console.warn('Loader check warning:', fErr.message);
  }

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

  if (!AdmZip) {
    throw new Error('Biblioteka archiwów (AdmZip) nie jest dostępna.');
  }

  const zip = new AdmZip(mrpackBuf);
  const indexEntry = zip.getEntry('modrinth.index.json');
  if (!indexEntry) {
    throw new Error('Nieprawidłowy plik .mrpack: brak pliku modrinth.index.json.');
  }

  const index = JSON.parse(indexEntry.getData().toString('utf8'));
  const mcVersion = targetVersion.game_versions?.[0] || index.dependencies?.minecraft || '1.21.1';

  let loader = 'fabric';
  let forgeVersion = null;
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
  } else if (targetVersion.loaders?.includes('forge')) {
    loader = 'forge';
  } else if (targetVersion.loaders?.includes('neoforge')) {
    loader = 'forge';
  } else if (targetVersion.loaders?.includes('quilt')) {
    loader = 'quilt';
  }

  const rawPackTitle = profileName || index.name || targetVersion.name || idOrSlug;
  const finalProfileName = rawPackTitle.startsWith('[Modpack]') ? rawPackTitle : `[Modpack] ${rawPackTitle}`;
  const customVersionId = loader === 'forge' && forgeVersion ? `${mcVersion}-forge-${forgeVersion}` : null;

  const profilesResult = profiles.createProfile({
    name: finalProfileName,
    mcVersion,
    loader,
    customVersionId,
    forgeVersion,
    icon: 'crown',
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
  getPacksDirectory,
  getPacksList,
  selectAndAddPacks,
  copyPackPaths,
  togglePack,
  deletePack,
  openPacksFolder
};
