const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const AdmZip = require('adm-zip');
const serverHost = require('./server');

const UA = 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)';

function getTargetPluginsInfo(cfg = null) {
  const currentCfg = cfg || serverHost.getServerConfig();
  const engine = String(currentCfg.engine || 'paper').toLowerCase();
  const srvDir = serverHost.getInstanceServerDir(currentCfg);

  if (engine === 'vanilla') {
    return {
      supported: false,
      engine: 'vanilla',
      type: 'none',
      dir: null,
      serverDir: srvDir,
      message: 'Silnik Vanilla nie obsługuje pluginów. Zmień silnik na Paper lub Purpur, aby instalować pluginy.'
    };
  }

  if (engine === 'fabric') {
    const dir = path.join(srvDir, 'mods');
    return {
      supported: true,
      engine: 'fabric',
      type: 'mods',
      dir,
      serverDir: srvDir,
      label: 'Modyfikacje serwera (Fabric)',
      loaders: ['fabric']
    };
  }

  // Paper, Purpur and Bukkit-based
  const dir = path.join(srvDir, 'plugins');
  return {
    supported: true,
    engine,
    type: 'plugins',
    dir,
    serverDir: srvDir,
    label: 'Pluginy serwera (Paper / Spigot / Purpur)',
    loaders: ['paper', 'purpur', 'spigot', 'bukkit', 'folia']
  };
}

function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b >= 1024 * 1024 * 1024) return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function readPluginMetadataFromJar(jarPath) {
  try {
    const zip = new AdmZip(jarPath);
    const pluginEntry = zip.getEntry('plugin.yml') || zip.getEntry('paper-plugin.yml');
    if (pluginEntry) {
      const text = pluginEntry.getData().toString('utf8');
      const nameMatch = text.match(/^name:\s*['"]?([^'"\r\n]+)['"]?/m);
      const verMatch = text.match(/^version:\s*['"]?([^'"\r\n]+)['"]?/m);
      const descMatch = text.match(/^description:\s*['"]?([^'"\r\n]+)['"]?/m);
      const authorMatch = text.match(/^author:\s*['"]?([^'"\r\n]+)['"]?/m) || text.match(/^authors:\s*\[?([^\]\r\n]+)\]?/m);
      return {
        name: nameMatch ? nameMatch[1].trim() : null,
        version: verMatch ? verMatch[1].trim() : null,
        description: descMatch ? descMatch[1].trim() : null,
        author: authorMatch ? authorMatch[1].trim().replace(/[\[\]'"]/g, '') : null
      };
    }

    const fabricEntry = zip.getEntry('fabric.mod.json');
    if (fabricEntry) {
      const data = JSON.parse(fabricEntry.getData().toString('utf8'));
      return {
        name: data.name || data.id,
        version: data.version,
        description: data.description,
        author: Array.isArray(data.authors) ? data.authors.map(a => typeof a === 'string' ? a : a.name).join(', ') : null
      };
    }
  } catch (_) {}
  return null;
}

async function getServerPlugins() {
  const target = getTargetPluginsInfo();
  if (!target.supported || !target.dir) {
    return {
      supported: false,
      engine: target.engine,
      message: target.message,
      folder: null,
      items: []
    };
  }

  if (!fs.existsSync(target.dir)) {
    fs.mkdirSync(target.dir, { recursive: true });
  }

  try {
    const entries = await fs.promises.readdir(target.dir, { withFileTypes: true });
    const items = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (!lower.endsWith('.jar') && !lower.endsWith('.jar.disabled')) continue;

      const fullPath = path.join(target.dir, entry.name);
      let stat = null;
      try {
        stat = await fs.promises.stat(fullPath);
      } catch (_) {}

      const enabled = !lower.endsWith('.disabled');
      const meta = readPluginMetadataFromJar(fullPath);
      const rawBaseName = entry.name.replace(/\.jar(\.disabled)?$/i, '');

      items.push({
        filename: entry.name,
        displayName: meta?.name || rawBaseName,
        version: meta?.version || null,
        description: meta?.description || null,
        author: meta?.author || null,
        enabled,
        sizeBytes: stat?.size || 0,
        sizeFormatted: formatBytes(stat?.size || 0),
        mtime: stat?.mtimeMs || 0
      });
    }

    // Sort by name
    items.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return {
      supported: true,
      engine: target.engine,
      type: target.type,
      label: target.label,
      folder: target.dir,
      items
    };
  } catch (err) {
    console.error('[ServerPlugins] Błąd listowania pluginów:', err);
    throw err;
  }
}

async function searchServerPlugins({ query = '', filter = 'all', limit = 24, offset = 0 } = {}) {
  const target = getTargetPluginsInfo();
  if (!target.supported) {
    return {
      supported: false,
      engine: target.engine,
      message: target.message,
      hits: [],
      total_hits: 0
    };
  }

  const facets = [];
  if (target.engine === 'fabric') {
    facets.push(['project_type:mod']);
    facets.push(['categories:fabric']);
  } else {
    facets.push(['project_type:plugin']);
  }

  let effectiveQuery = (query || '').trim();
  let sort = 'downloads';

  if (filter === 'crossplay') {
    effectiveQuery = effectiveQuery ? `${effectiveQuery} geyser floodgate` : 'geyser floodgate';
  } else if (filter === 'admin') {
    effectiveQuery = effectiveQuery ? `${effectiveQuery} luckperms essentials viaversion` : 'luckperms essentials';
  } else if (filter === 'world') {
    effectiveQuery = effectiveQuery ? `${effectiveQuery} worldedit chunky coreprotect` : 'worldedit chunky';
  }

  const params = new URLSearchParams();
  if (effectiveQuery) {
    params.append('query', effectiveQuery);
  }
  params.append('facets', JSON.stringify(facets));
  params.append('index', sort);
  params.append('limit', String(Math.min(50, Math.max(1, limit))));
  params.append('offset', String(Math.max(0, offset)));

  const url = `https://api.modrinth.com/v2/search?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });

  if (!res.ok) {
    throw new Error(`Błąd wyszukiwania w Modrinth: ${res.statusText}`);
  }

  const data = await res.json();
  const installedPlugins = await getServerPlugins();
  const installedFilenames = new Set(installedPlugins.items.map(i => i.filename.toLowerCase()));
  const installedTitles = new Set(installedPlugins.items.map(i => i.displayName.toLowerCase()));

  const hits = (data.hits || []).map(hit => {
    const isInstalled = installedTitles.has((hit.title || '').toLowerCase()) ||
      installedFilenames.has(`${(hit.slug || '').toLowerCase()}.jar`) ||
      installedPlugins.items.some(i => i.displayName.toLowerCase().includes((hit.slug || '').toLowerCase()));

    return {
      id: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      categories: hit.categories || [],
      downloads: hit.downloads || 0,
      icon_url: hit.icon_url || null,
      author: hit.author || null,
      isInstalled
    };
  });

  return {
    supported: true,
    engine: target.engine,
    hits,
    total_hits: data.total_hits || hits.length,
    offset: data.offset || 0,
    limit: data.limit || limit
  };
}

async function installServerPlugin({ slug, projectId, window = null }) {
  const target = getTargetPluginsInfo();
  if (!target.supported || !target.dir) {
    throw new Error(target.message || 'Ten silnik nie obsługuje pluginów.');
  }

  const idOrSlug = slug || projectId;
  if (!idOrSlug) throw new Error('Brak identyfikatora pluginu do instalacji.');

  if (!fs.existsSync(target.dir)) {
    fs.mkdirSync(target.dir, { recursive: true });
  }

  const cfg = serverHost.getServerConfig();
  const gameVer = cfg.version || '1.21.11';
  const majorVer = gameVer.split('.').slice(0, 2).join('.'); // e.g. 1.21

  // 1. Fetch versions
  const verUrl = `https://api.modrinth.com/v2/project/${idOrSlug}/version`;
  const res = await fetch(verUrl, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać wersji pluginu ${idOrSlug}: ${res.statusText}`);
  }

  const versions = await res.json();
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`Brak dostępnych wydań pluginu ${idOrSlug} na Modrinth.`);
  }

  const loadersToMatch = target.loaders || ['paper', 'purpur', 'spigot', 'bukkit'];

  // Match: loader + exact game version -> loader + major version -> loader alone -> first
  let matchedVer = versions.find(v => {
    const hasLoader = (v.loaders || []).some(l => loadersToMatch.includes(l.toLowerCase()));
    const hasVer = (v.game_versions || []).includes(gameVer);
    return hasLoader && hasVer;
  });

  if (!matchedVer) {
    matchedVer = versions.find(v => {
      const hasLoader = (v.loaders || []).some(l => loadersToMatch.includes(l.toLowerCase()));
      const hasMajor = (v.game_versions || []).some(gv => gv.startsWith(majorVer));
      return hasLoader && hasMajor;
    });
  }

  if (!matchedVer) {
    matchedVer = versions.find(v => {
      return (v.loaders || []).some(l => loadersToMatch.includes(l.toLowerCase()));
    });
  }

  if (!matchedVer) {
    throw new Error(`Plugin ${idOrSlug} nie posiada wersji zgodnej z silnikiem ${target.engine}.`);
  }

  const file = (matchedVer.files && matchedVer.files.find(f => f.primary)) ||
    matchedVer.files?.find(f => f.filename?.endsWith('.jar')) ||
    matchedVer.files?.[0];

  if (!file || !file.url) {
    throw new Error(`Wydanie ${matchedVer.name || idOrSlug} nie zawiera pliku .jar.`);
  }

  const destPath = path.join(target.dir, file.filename);
  window?.webContents.send('server:log', `[Pluginy] Pobieranie ${file.filename} (${formatBytes(file.size)})...`);

  const fileRes = await fetch(file.url, { headers: { 'User-Agent': UA } });
  if (!fileRes.ok) {
    throw new Error(`Błąd pobierania pliku ${file.filename}: ${fileRes.status}`);
  }

  const buf = await fileRes.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
  window?.webContents.send('server:log', `[Pluginy] Pomyślnie zainstalowano plugin: ${file.filename}`);

  // Optional: Install required dependencies
  const installedDeps = [];
  if (Array.isArray(matchedVer.dependencies)) {
    for (const dep of matchedVer.dependencies) {
      if (dep.dependency_type === 'required' && dep.project_id) {
        try {
          const depId = dep.project_id;
          const depRes = await installServerPlugin({ slug: depId, window });
          if (depRes?.filename) installedDeps.push(depRes.filename);
        } catch (depErr) {
          console.warn(`[ServerPlugins] Nie udało się automatycznie pobrać zależności ${dep.project_id}:`, depErr.message);
        }
      }
    }
  }

  return {
    success: true,
    filename: file.filename,
    versionName: matchedVer.name || matchedVer.version_number,
    size: file.size,
    sizeFormatted: formatBytes(file.size),
    installedDeps
  };
}

async function toggleServerPlugin(filename) {
  const target = getTargetPluginsInfo();
  if (!target.supported || !target.dir) throw new Error('Silnik nie obsługuje pluginów.');

  const safeName = path.basename(filename);
  const oldPath = path.join(target.dir, safeName);
  if (!fs.existsSync(oldPath)) throw new Error(`Plik ${safeName} nie istnieje w folderze pluginów.`);

  let newName = safeName;
  let nowEnabled = false;

  if (safeName.toLowerCase().endsWith('.disabled')) {
    newName = safeName.replace(/\.disabled$/i, '');
    nowEnabled = true;
  } else {
    newName = `${safeName}.disabled`;
    nowEnabled = false;
  }

  const newPath = path.join(target.dir, newName);
  await fs.promises.rename(oldPath, newPath);

  return {
    success: true,
    oldFilename: safeName,
    newFilename: newName,
    enabled: nowEnabled
  };
}

async function deleteServerPlugin(filename) {
  const target = getTargetPluginsInfo();
  if (!target.supported || !target.dir) throw new Error('Silnik nie obsługuje pluginów.');

  const safeName = path.basename(filename);
  const targetFile = path.join(target.dir, safeName);

  if (!fs.existsSync(targetFile)) {
    return { success: true, message: 'Plik już nie istnieje.' };
  }

  await fs.promises.unlink(targetFile);

  return {
    success: true,
    filename: safeName
  };
}

function openServerPluginsFolder() {
  const target = getTargetPluginsInfo();
  if (!target.dir) {
    return serverHost.openServerFolder();
  }
  if (!fs.existsSync(target.dir)) {
    fs.mkdirSync(target.dir, { recursive: true });
  }
  shell.openPath(target.dir);
  return { success: true, path: target.dir };
}

module.exports = {
  getTargetPluginsInfo,
  getServerPlugins,
  searchServerPlugins,
  installServerPlugin,
  toggleServerPlugin,
  deleteServerPlugin,
  openServerPluginsFolder
};
