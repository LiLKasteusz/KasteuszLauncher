const fs = require('fs');
const path = require('path');
const { shell } = require('electron');
const config = require('./config');

const PROFILES_FILE = path.join(config.APP_DIR, 'profiles.json');
const PROFILES_INSTANCES_DIR = path.join(config.APP_DIR, 'profiles');

function ensureBaseDirs() {
  if (!fs.existsSync(config.APP_DIR)) {
    fs.mkdirSync(config.APP_DIR, { recursive: true });
  }
  if (!fs.existsSync(PROFILES_INSTANCES_DIR)) {
    fs.mkdirSync(PROFILES_INSTANCES_DIR, { recursive: true });
  }
}

function sanitizeSlug(name) {
  return String(name || 'profil')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36) || 'profil';
}

function getSharedRootDir() {
  const cfg = config.getConfig();
  return cfg.gameDirectory || config.DEFAULT_GAME_DIR;
}

function resolveProfileInstanceDir(profile) {
  const sharedRoot = getSharedRootDir();
  if (!profile || !profile.isolated) {
    return sharedRoot;
  }
  const folderName = profile.folderName || profile.id;
  return path.join(PROFILES_INSTANCES_DIR, folderName);
}

function ensureProfileFolders(instanceDir) {
  const subdirs = ['', 'mods', 'resourcepacks', 'shaderpacks', 'config'];
  for (const sub of subdirs) {
    const target = sub ? path.join(instanceDir, sub) : instanceDir;
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
  }
}

function countProfileMods(instanceDir) {
  try {
    const modsDir = path.join(instanceDir, 'mods');
    if (!fs.existsSync(modsDir)) return { enabled: 0, total: 0 };
    const files = fs.readdirSync(modsDir);
    let enabled = 0;
    let total = 0;
    for (const f of files) {
      if (f.endsWith('.jar')) {
        enabled++;
        total++;
      } else if (f.endsWith('.jar.disabled')) {
        total++;
      }
    }
    return { enabled, total };
  } catch (_) {
    return { enabled: 0, total: 0 };
  }
}

function deriveLegacyVersion(cfg) {
  const raw = String(cfg?.selectedVersion || '1.21.11');
  if (raw.startsWith('fabric-')) {
    return { loader: 'fabric', mcVersion: raw.replace(/^fabric-/, '') };
  }
  if (raw.startsWith('quilt-')) {
    return { loader: 'quilt', mcVersion: raw.replace(/^quilt-/, '') };
  }
  const sharedMods = countProfileMods(cfg?.gameDirectory || config.DEFAULT_GAME_DIR);
  if (sharedMods.total > 0) {
    return { loader: 'fabric', mcVersion: raw };
  }
  return { loader: 'vanilla', mcVersion: raw };
}

function createInitialState() {
  const cfg = config.getConfig();
  const legacy = deriveLegacyVersion(cfg);
  const now = Date.now();

  const mainProfile = {
    id: 'default-main',
    name: 'Kasteusz Main',
    mcVersion: legacy.mcVersion || '1.21.11',
    loader: legacy.loader || 'fabric',
    customVersionId: null,
    icon: 'bolt',
    isolated: false,
    folderName: null,
    memoryMax: null,
    jvmArgs: '',
    createdAt: now,
    lastPlayedAt: now
  };

  const vanillaProfile = {
    id: 'vanilla-clean',
    name: 'Czysta Vanilla',
    mcVersion: '1.21.11',
    loader: 'vanilla',
    customVersionId: null,
    icon: 'cube',
    isolated: true,
    folderName: 'vanilla-clean',
    memoryMax: null,
    jvmArgs: '',
    createdAt: now + 1,
    lastPlayedAt: null
  };

  ensureProfileFolders(resolveProfileInstanceDir(vanillaProfile));

  return {
    activeProfileId: mainProfile.id,
    profiles: [mainProfile, vanillaProfile]
  };
}

function readRawState() {
  ensureBaseDirs();
  try {
    if (fs.existsSync(PROFILES_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PROFILES_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        if (!parsed.profiles.some(p => p.id === parsed.activeProfileId)) {
          parsed.activeProfileId = parsed.profiles[0].id;
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[Profiles] Błąd odczytu profiles.json:', err.message);
  }

  const initial = createInitialState();
  writeRawState(initial);
  return initial;
}

function writeRawState(state) {
  ensureBaseDirs();
  fs.writeFileSync(PROFILES_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function formatVersionIdForProfile(profile) {
  if (!profile) return '1.21.11';
  if ((profile.loader === 'custom' || profile.loader === 'forge' || profile.loader === 'neoforge') && profile.customVersionId) {
    return profile.customVersionId;
  }
  if (profile.loader === 'forge') {
    return profile.customVersionId || `forge-${profile.mcVersion}`;
  }
  if (profile.loader === 'fabric') {
    return `fabric-${profile.mcVersion}`;
  }
  if (profile.loader === 'quilt') {
    return `quilt-${profile.mcVersion}`;
  }
  return profile.mcVersion || '1.21.11';
}

function enrichProfile(profile, activeId) {
  const instanceDir = resolveProfileInstanceDir(profile);
  const modStats = profile.loader === 'vanilla'
    ? { enabled: 0, total: 0 }
    : countProfileMods(instanceDir);
  return {
    ...profile,
    isActive: profile.id === activeId,
    instanceDir,
    effectiveVersionId: formatVersionIdForProfile(profile),
    modsEnabled: modStats.enabled,
    modsTotal: modStats.total
  };
}

function getProfilesState() {
  const state = readRawState();
  return {
    activeProfileId: state.activeProfileId,
    profiles: state.profiles.map(p => enrichProfile(p, state.activeProfileId)),
    customEngines: getInstalledCustomEngines()
  };
}

function getActiveProfile() {
  const state = readRawState();
  const found = state.profiles.find(p => p.id === state.activeProfileId) || state.profiles[0];
  return enrichProfile(found, state.activeProfileId);
}

function getProfileById(profileId) {
  const state = readRawState();
  if (!profileId || profileId === 'active') {
    return getActiveProfile();
  }
  const found = state.profiles.find(p => p.id === profileId);
  return found ? enrichProfile(found, state.activeProfileId) : getActiveProfile();
}

function getInstanceDirectory(profileOrId) {
  if (!profileOrId) return getActiveInstanceDirectory();
  if (typeof profileOrId === 'string') {
    const prof = getProfileById(profileOrId);
    const dir = resolveProfileInstanceDir(prof);
    ensureProfileFolders(dir);
    return dir;
  }
  const dir = resolveProfileInstanceDir(profileOrId);
  ensureProfileFolders(dir);
  return dir;
}

function getActiveInstanceDirectory() {
  const active = getActiveProfile();
  const dir = resolveProfileInstanceDir(active);
  ensureProfileFolders(dir);
  return dir;
}

function syncLegacyConfigVersion(profile) {
  if (!profile) return;
  config.saveConfig({ selectedVersion: formatVersionIdForProfile(profile) });
}

function setActiveProfile(profileId) {
  const state = readRawState();
  const target = state.profiles.find(p => p.id === profileId);
  if (!target) {
    throw new Error('Nie znaleziono wybranego profilu.');
  }
  state.activeProfileId = target.id;
  writeRawState(state);
  ensureProfileFolders(resolveProfileInstanceDir(target));
  syncLegacyConfigVersion(target);
  return getProfilesState();
}

function createProfile(payload = {}) {
  const state = readRawState();
  const name = String(payload.name || '').trim() || 'Nowy Profil';
  const loader = ['fabric', 'quilt', 'forge', 'neoforge', 'vanilla', 'custom'].includes(payload.loader)
    ? payload.loader
    : 'fabric';
  const mcVersion = String(payload.mcVersion || '1.21.11').trim();
  const customVersionId = (loader === 'custom' || loader === 'forge' || loader === 'neoforge') && payload.customVersionId
    ? String(payload.customVersionId).trim()
    : (loader === 'custom' ? mcVersion : null);
  const icon = ['bolt', 'cube', 'sword', 'spark', 'compass', 'crown'].includes(payload.icon)
    ? payload.icon
    : (loader === 'vanilla' ? 'cube' : 'bolt');
  const isolated = payload.isolated !== undefined ? !!payload.isolated : true;
  const memoryMax = payload.memoryMax ? Math.max(2, Math.min(16, parseInt(payload.memoryMax, 10) || 4)) : null;
  const jvmPreset = ['ultra', 'g1gc', 'lowend', 'custom'].includes(payload.jvmPreset) ? payload.jvmPreset : 'ultra';
  const jvmArgs = typeof payload.jvmArgs === 'string' ? payload.jvmArgs.trim() : '';

  const id = `prof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const folderName = `${sanitizeSlug(name)}-${id.slice(-4)}`;

  const newProfile = {
    id,
    name,
    mcVersion,
    loader,
    customVersionId,
    forgeVersion: payload.forgeVersion || null,
    icon,
    isolated,
    folderName: isolated ? folderName : null,
    memoryMax,
    jvmPreset,
    jvmArgs,
    createdAt: Date.now(),
    lastPlayedAt: null
  };

  ensureProfileFolders(resolveProfileInstanceDir(newProfile));

  state.profiles.push(newProfile);
  state.activeProfileId = newProfile.id;
  writeRawState(state);
  syncLegacyConfigVersion(newProfile);

  return getProfilesState();
}

function updateProfile(profileId, updates = {}) {
  const state = readRawState();
  const idx = state.profiles.findIndex(p => p.id === profileId);
  if (idx < 0) {
    throw new Error('Profil nie istnieje.');
  }

  const current = state.profiles[idx];
  const loader = updates.loader && ['fabric', 'quilt', 'forge', 'neoforge', 'vanilla', 'custom'].includes(updates.loader)
    ? updates.loader
    : current.loader;

  const isolated = updates.isolated !== undefined ? !!updates.isolated : current.isolated;
  let folderName = current.folderName;
  if (isolated && !folderName) {
    folderName = `${sanitizeSlug(updates.name || current.name)}-${current.id.slice(-4)}`;
  }

  const updated = {
    ...current,
    name: updates.name !== undefined ? (String(updates.name).trim() || current.name) : current.name,
    mcVersion: updates.mcVersion !== undefined ? String(updates.mcVersion).trim() : current.mcVersion,
    loader,
    customVersionId: (loader === 'custom' || loader === 'forge' || loader === 'neoforge')
      ? String(updates.customVersionId || current.customVersionId || current.mcVersion).trim()
      : null,
    forgeVersion: updates.forgeVersion !== undefined ? updates.forgeVersion : current.forgeVersion,
    icon: updates.icon && ['bolt', 'cube', 'sword', 'spark', 'compass', 'crown'].includes(updates.icon)
      ? updates.icon
      : current.icon,
    isolated,
    folderName: isolated ? folderName : null,
    memoryMax: updates.memoryMax !== undefined
      ? (updates.memoryMax ? Math.max(2, Math.min(16, parseInt(updates.memoryMax, 10) || 4)) : null)
      : current.memoryMax,
    jvmPreset: updates.jvmPreset && ['ultra', 'g1gc', 'lowend', 'custom'].includes(updates.jvmPreset)
      ? updates.jvmPreset
      : (current.jvmPreset || 'ultra'),
    jvmArgs: updates.jvmArgs !== undefined ? String(updates.jvmArgs || '').trim() : (current.jvmArgs || '')
  };

  ensureProfileFolders(resolveProfileInstanceDir(updated));
  state.profiles[idx] = updated;
  writeRawState(state);

  if (state.activeProfileId === updated.id) {
    syncLegacyConfigVersion(updated);
  }

  return getProfilesState();
}

function duplicateProfile(profileId) {
  const state = readRawState();
  const src = state.profiles.find(p => p.id === profileId);
  if (!src) throw new Error('Nie znaleziono profilu do skopiowania.');

  const id = `prof-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const folderName = `${sanitizeSlug(src.name)}-copy-${id.slice(-4)}`;
  const copy = {
    ...src,
    id,
    name: `${src.name} (Kopia)`,
    isolated: true,
    folderName,
    createdAt: Date.now(),
    lastPlayedAt: null
  };

  const srcDir = resolveProfileInstanceDir(src);
  const destDir = resolveProfileInstanceDir(copy);
  ensureProfileFolders(destDir);

  try {
    const srcMods = path.join(srcDir, 'mods');
    const destMods = path.join(destDir, 'mods');
    if (fs.existsSync(srcMods)) {
      for (const f of fs.readdirSync(srcMods)) {
        if (f.endsWith('.jar') || f.endsWith('.jar.disabled')) {
          fs.copyFileSync(path.join(srcMods, f), path.join(destMods, f));
        }
      }
    }
  } catch (_) {}

  state.profiles.push(copy);
  state.activeProfileId = copy.id;
  writeRawState(state);
  syncLegacyConfigVersion(copy);

  return getProfilesState();
}

function deleteProfile(profileId) {
  const state = readRawState();
  if (state.profiles.length <= 1) {
    throw new Error('Nie można usunąć jedynego profilu w launcherze.');
  }
  if (profileId === 'default-main') {
    throw new Error('Główny profil bazowy nie może zostać usunięty (możesz go edytować).');
  }

  const target = state.profiles.find(p => p.id === profileId);
  if (!target) throw new Error('Profil nie istnieje.');

  state.profiles = state.profiles.filter(p => p.id !== profileId);
  if (state.activeProfileId === profileId) {
    state.activeProfileId = state.profiles[0].id;
    syncLegacyConfigVersion(state.profiles[0]);
  }
  writeRawState(state);

  return getProfilesState();
}

function openProfileFolder(profileId) {
  const state = readRawState();
  const target = state.profiles.find(p => p.id === profileId) || state.profiles[0];
  const dir = resolveProfileInstanceDir(target);
  ensureProfileFolders(dir);
  shell.openPath(dir);
  return dir;
}

function markProfilePlayed(profileId) {
  const state = readRawState();
  const idx = state.profiles.findIndex(p => p.id === profileId);
  if (idx >= 0) {
    state.profiles[idx].lastPlayedAt = Date.now();
    writeRawState(state);
  }
}

function getInstalledCustomEngines() {
  try {
    const versionsDir = path.join(getSharedRootDir(), 'versions');
    if (!fs.existsSync(versionsDir)) return [];
    const entries = fs.readdirSync(versionsDir);
    const custom = [];
    for (const dirName of entries) {
      if (/^\d+\.\d+(\.\d+)?$/.test(dirName)) continue;
      const jsonPath = path.join(versionsDir, dirName, `${dirName}.json`);
      if (fs.existsSync(jsonPath)) {
        custom.push(dirName);
      }
    }
    return custom.sort();
  } catch (_) {
    return [];
  }
}

module.exports = {
  getProfilesState,
  getActiveProfile,
  getProfileById,
  getInstanceDirectory,
  resolveProfileInstanceDir,
  getActiveInstanceDirectory,
  setActiveProfile,
  createProfile,
  updateProfile,
  duplicateProfile,
  deleteProfile,
  openProfileFolder,
  markProfilePlayed,
  getInstalledCustomEngines,
  formatVersionIdForProfile
};
