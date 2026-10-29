
const fs = require('fs');
const path = require('path');
const os = require('os');
const { nativeImage, clipboard, shell } = require('electron');
const profiles = require('./profiles');
const config = require('./config');

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.bmp']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.mkv']);
const ALL_MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);

const thumbnailCache = new Map();
const MAX_CACHE_ITEMS = 300;

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return 'Nieznana data';
  const d = new Date(timestamp);
  return d.toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getScreenshotsDirectories(filterProfileId = 'all') {
  const dirs = [];
  const defaultMcDir = path.join(os.homedir(), '.kasteuszlauncher', 'minecraft');
  const sharedScreenshots = path.join(defaultMcDir, 'screenshots');
  const vanillaScreenshots = path.join(os.homedir(), '.minecraft', 'screenshots');

  if (!fs.existsSync(sharedScreenshots)) {
    try {
      fs.mkdirSync(sharedScreenshots, { recursive: true });
    } catch (_) {}
  }

  const allProfiles = profiles.getAllProfiles ? profiles.getAllProfiles() : [];
  const activeProfile = profiles.getActiveProfile ? profiles.getActiveProfile() : null;

  if (filterProfileId === 'active') {
    if (activeProfile) {
      const activeDir = profiles.getInstanceDirectory(activeProfile);
      dirs.push({
        dir: path.join(activeDir, 'screenshots'),
        profileId: activeProfile.id,
        profileName: activeProfile.name
      });
    } else {
      dirs.push({
        dir: sharedScreenshots,
        profileId: 'default',
        profileName: 'Kasteusz Main'
      });
    }
  } else if (filterProfileId && filterProfileId !== 'all') {
    const prof = allProfiles.find(p => p.id === filterProfileId);
    if (prof) {
      const pDir = profiles.getInstanceDirectory(prof);
      dirs.push({
        dir: path.join(pDir, 'screenshots'),
        profileId: prof.id,
        profileName: prof.name
      });
    }
  } else {
    for (const p of allProfiles) {
      const pDir = profiles.getInstanceDirectory(p);
      dirs.push({
        dir: path.join(pDir, 'screenshots'),
        profileId: p.id,
        profileName: p.name
      });
    }

    dirs.push({
      dir: sharedScreenshots,
      profileId: 'shared',
      profileName: 'Domyślny Kasteusz'
    });

    if (fs.existsSync(vanillaScreenshots)) {
      dirs.push({
        dir: vanillaScreenshots,
        profileId: 'vanilla',
        profileName: 'Vanilla .minecraft'
      });
    }
  }

  return dirs;
}

async function getScreenshots(filterProfileId = 'all') {
  const dirs = getScreenshotsDirectories(filterProfileId);
  const seenPaths = new Set();
  const list = [];

  for (const { dir, profileId, profileName } of dirs) {
    if (!fs.existsSync(dir)) continue;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (!ALL_MEDIA_EXTENSIONS.has(ext)) continue;

        const fullPath = path.join(dir, entry.name);
        const canonical = path.resolve(fullPath);

        if (seenPaths.has(canonical)) continue;
        seenPaths.add(canonical);

        try {
          const stat = fs.statSync(fullPath);
          const isVideo = VIDEO_EXTENSIONS.has(ext);

          list.push({
            id: Buffer.from(canonical).toString('base64url'),
            fileName: entry.name,
            filePath: canonical,
            fileUrl: `file://${canonical}`,
            isVideo,
            ext,
            sizeBytes: stat.size,
            sizeFormatted: formatBytes(stat.size),
            timestamp: stat.mtimeMs || stat.ctimeMs || 0,
            dateFormatted: formatDate(stat.mtimeMs || stat.ctimeMs),
            profileId,
            profileName
          });
        } catch (_) {}
      }
    } catch (err) {
      console.warn(`[Screenshots] Błąd czytania folderu ${dir}:`, err.message);
    }
  }

  list.sort((a, b) => b.timestamp - a.timestamp);

  const totalBytes = list.reduce((acc, item) => acc + item.sizeBytes, 0);

  return {
    success: true,
    screenshots: list,
    totalCount: list.length,
    totalSizeFormatted: formatBytes(totalBytes),
    activeProfileId: profiles.getActiveProfile?.()?.id || 'default-main'
  };
}

async function getScreenshotThumbnail(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Plik nie istnieje' };
  }

  try {
    const stat = fs.statSync(filePath);
    const cacheKey = `${filePath}:${stat.mtimeMs}`;
    if (thumbnailCache.has(cacheKey)) {
      return { success: true, dataUrl: thumbnailCache.get(cacheKey) };
    }

    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) {
      return { success: true, isVideo: true };
    }

    let dataUrl = null;
    let width = 0;
    let height = 0;

    if (nativeImage && typeof nativeImage.createFromPath === 'function') {
      try {
        const img = nativeImage.createFromPath(filePath);
        if (!img.isEmpty()) {
          const size = img.getSize();
          width = size.width;
          height = size.height;
          let thumb = img;
          if (size.width > 480) {
            const scale = 480 / size.width;
            thumb = img.resize({
              width: 480,
              height: Math.round(size.height * scale),
              quality: 'good'
            });
          }
          dataUrl = thumb.toDataURL();
        }
      } catch (_) {}
    }

    if (!dataUrl) {
      const buf = fs.readFileSync(filePath);
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    }

    if (thumbnailCache.size >= MAX_CACHE_ITEMS) {
      const firstKey = thumbnailCache.keys().next().value;
      thumbnailCache.delete(firstKey);
    }
    thumbnailCache.set(cacheKey, dataUrl);

    return {
      success: true,
      dataUrl,
      width,
      height
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function getScreenshotFull(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Plik nie istnieje' };
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) {
      return { success: true, isVideo: true, filePath };
    }

    let dataUrl = null;
    let width = 0;
    let height = 0;

    if (nativeImage && typeof nativeImage.createFromPath === 'function') {
      try {
        const img = nativeImage.createFromPath(filePath);
        if (!img.isEmpty()) {
          const size = img.getSize();
          width = size.width;
          height = size.height;
          dataUrl = img.toDataURL();
        }
      } catch (_) {}
    }

    if (!dataUrl) {
      const buf = fs.readFileSync(filePath);
      const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
      dataUrl = `data:${mime};base64,${buf.toString('base64')}`;
    }

    return {
      success: true,
      dataUrl,
      width,
      height
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function copyScreenshotToClipboard(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Plik nie istnieje' };
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    if (VIDEO_EXTENSIONS.has(ext)) {
      if (clipboard && typeof clipboard.writeText === 'function') {
        clipboard.writeText(filePath);
      }
      return { success: true, isVideo: true, message: 'Skopiowano ścieżkę do klipu wideo!' };
    }

    if (nativeImage && typeof nativeImage.createFromPath === 'function' && clipboard && typeof clipboard.writeImage === 'function') {
      const img = nativeImage.createFromPath(filePath);
      if (!img.isEmpty()) {
        clipboard.writeImage(img);
        return { success: true, message: 'Obraz skopiowany do schowka! Wklej go w Discordzie (Ctrl+V).' };
      }
    }

    if (clipboard && typeof clipboard.writeText === 'function') {
      clipboard.writeText(filePath);
      return { success: true, message: 'Skopiowano ścieżkę do pliku.' };
    }

    return { success: false, error: 'Moduł schowka jest niedostępny' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function deleteScreenshot(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Plik nie istnieje' };
  }

  try {
    fs.unlinkSync(filePath);

    for (const key of thumbnailCache.keys()) {
      if (key.startsWith(filePath)) {
        thumbnailCache.delete(key);
      }
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function openScreenshotsFolder(filterProfileId = 'active') {
  try {
    let targetDir = null;

    if (filterProfileId === 'active' || !filterProfileId) {
      const activeDir = profiles.getActiveInstanceDirectory ? profiles.getActiveInstanceDirectory() : null;
      if (activeDir) {
        targetDir = path.join(activeDir, 'screenshots');
      }
    } else if (filterProfileId !== 'all') {
      const allProfiles = profiles.getAllProfiles ? profiles.getAllProfiles() : [];
      const prof = allProfiles.find(p => p.id === filterProfileId);
      if (prof) {
        const pDir = profiles.getInstanceDirectory(prof);
        targetDir = path.join(pDir, 'screenshots');
      }
    }

    if (!targetDir) {
      targetDir = path.join(os.homedir(), '.kasteuszlauncher', 'minecraft', 'screenshots');
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    await shell.openPath(targetDir);
    return { success: true, path: targetDir };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function openScreenshotFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Plik nie istnieje' };
  }
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  getScreenshots,
  getScreenshotThumbnail,
  getScreenshotFull,
  copyScreenshotToClipboard,
  deleteScreenshot,
  openScreenshotsFolder,
  openScreenshotFile
};
