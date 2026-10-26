const fs = require('fs');
const path = require('path');
const { shell, dialog } = require('electron');
const config = require('./config');

function getModsDirectory() {
  const appConfig = config.getConfig();
  const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  const modsDir = path.join(gameDir, 'mods');
  if (!fs.existsSync(modsDir)) {
    fs.mkdirSync(modsDir, { recursive: true });
  }
  return modsDir;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Zwraca listę wszystkich zainstalowanych modów
 */
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

        return {
          filename,
          name: cleanName,
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

/**
 * Otwiera natywne okno wyboru plików i kopiuje mody do folderu mods
 */
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

/**
 * Włącza lub wyłącza moda (.jar <-> .jar.disabled)
 */
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

/**
 * Usuwa plik moda
 */
function deleteMod(filename) {
  const modsDir = getModsDirectory();
  const filePath = path.join(modsDir, filename);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  return getInstalledMods();
}

/**
 * Otwiera folder mods w eksploratorze plików systemu Linux
 */
function openModsFolder() {
  const modsDir = getModsDirectory();
  shell.openPath(modsDir);
  return modsDir;
}

/**
 * Automatyczna instalacja profilu Fabric Loader dla danej wersji gry
 * Scala konfigurację Mojang z Fabric, gwarantując 100% kompatybilność z MCLC
 */
async function installFabric(minecraftVersion = '1.20.4') {
  const appConfig = config.getConfig();
  const gameDir = appConfig.gameDirectory || config.DEFAULT_GAME_DIR;
  
  // 1. Sprawdź lub pobierz plik JSON wersji bazowej Minecraft
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

  // 2. Pobierz loader z Fabric Meta API
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

  // 3. Pobierz profil Fabric JSON
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

  // 4. Scal konfigurację Fabric z bazowym klientem Minecraft
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

  // Skopiuj plik jar wersji bazowej jeśli istnieje, aby Fabric go widział
  const baseJar = path.join(gameDir, 'versions', minecraftVersion, `${minecraftVersion}.jar`);
  const fabricJar = path.join(versionDir, `${versionId}.jar`);
  if (fs.existsSync(baseJar) && !fs.existsSync(fabricJar)) {
    try {
      fs.copyFileSync(baseJar, fabricJar);
    } catch (e) {}
  }

  // Ustaw jako aktywną wersję w launcherze
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

  // Upewnij się że Fabric jest zainstalowany
  await installFabric(minecraftVersion);

  return {
    filename: file.filename,
    mods: getInstalledMods()
  };
}

/**
 * Wyszukuje mody w bazie Modrinth
 */
async function searchModrinth({ query = '', category = '', gameVersion = '1.21.11', sort = 'downloads', limit = 20, offset = 0, onlyCurrentVersion = false } = {}) {
  try {
    const facets = [
      ['project_type:mod'],
      ['categories:fabric']
    ];

    if (category && category !== 'all') {
      facets.push([`categories:${category}`]);
    }

    if (onlyCurrentVersion && gameVersion) {
      facets.push([`versions:${gameVersion}`]);
    }

    const params = new URLSearchParams();
    if (query && query.trim()) {
      params.append('query', query.trim());
    }
    params.append('facets', JSON.stringify(facets));
    params.append('index', sort || 'downloads');
    params.append('limit', String(limit || 20));
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
      limit: data.limit || 20
    };
  } catch (err) {
    console.error('Błąd searchModrinth:', err);
    throw err;
  }
}

/**
 * Pobiera i instaluje mod z Modrinth bezpośrednio do katalogu mods
 */
async function installModrinthMod({ projectId, slug, gameVersion = '1.21.11' }) {
  const modsDir = getModsDirectory();
  const idOrSlug = slug || projectId;

  // 1. Sprawdzamy wersje dla Fabric i wybranej wersji gry
  let versions = [];
  try {
    const res = await fetch(`https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=["fabric"]&game_versions=["${gameVersion}"]`, {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
    });
    if (res.ok) {
      versions = await res.json();
    }
  } catch (err) {
    console.warn(`Nie znaleziono wersji pod ${gameVersion}, szukam ogólnej Fabric...`, err);
  }

  // 2. Jeśli brak wersji pod konkretne wydanie, bierzemy najnowszą wersję na Fabric
  if (!versions || versions.length === 0) {
    const res = await fetch(`https://api.modrinth.com/v2/project/${idOrSlug}/version?loaders=["fabric"]`, {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0.0 (contact@szkolnesmp.com.pl)' }
    });
    if (res.ok) {
      versions = await res.json();
    }
  }

  if (!versions || versions.length === 0) {
    throw new Error(`Nie znaleziono wersji moda ${idOrSlug} kompatybilnej z Fabric.`);
  }

  const targetVersion = versions[0];
  const primaryFile = (targetVersion.files && targetVersion.files.find(f => f.primary)) || targetVersion.files?.[0];
  if (!primaryFile || !primaryFile.url) {
    throw new Error(`Brak pliku do pobrania dla moda ${idOrSlug}.`);
  }

  // 3. Pobieranie pliku moda
  const destPath = path.join(modsDir, primaryFile.filename);
  const fileRes = await fetch(primaryFile.url);
  if (!fileRes.ok) throw new Error(`Błąd pobierania pliku: ${fileRes.status}`);
  const buf = await fileRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));

  // 4. Pobieranie wymaganych zależności (np. Sodium dla Iris)
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

  // Upewniamy się, że Fabric Loader jest zainstalowany
  try {
    await installFabric(gameVersion);
  } catch (fErr) {
    console.warn('Fabric Loader check warning:', fErr.message);
  }

  return {
    success: true,
    filename: primaryFile.filename,
    versionNumber: targetVersion.version_number,
    dependencies: installedDependencies,
    mods: getInstalledMods()
  };
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
  installSodium,
  searchModrinth,
  installModrinthMod
};
