const { app, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs = require('fs');
const config = require('./config');

let mainWindow = null;
let updateStatus = {
  state: 'idle', // 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  currentVersion: app.getVersion() || '2.5.0',
  availableVersion: null,
  releaseNotes: null,
  releaseDate: null,
  downloadUrl: null,
  progress: null,
  error: null,
  repo: 'filipeczek1/KasteuszLauncher'
};

function getUpdateFeedConfig() {
  const cfg = config.loadConfig ? config.loadConfig() : {};
  const repo = (cfg && cfg.githubRepo) ? cfg.githubRepo.trim() : 'filipeczek1/KasteuszLauncher';
  const parts = repo.split('/');
  return {
    owner: parts[0] || 'filipeczek1',
    repo: parts[1] || 'KasteuszLauncher',
    fullRepo: repo
  };
}

function sendUpdateStatus() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status-changed', updateStatus);
  }
}

function sendUpdateProgress(progressObj) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:progress', progressObj);
  }
}

function initUpdater(win) {
  mainWindow = win;

  const feed = getUpdateFeedConfig();
  updateStatus.repo = feed.fullRepo;
  updateStatus.currentVersion = app.getVersion() || '2.5.0';

  // electron-updater configuration
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: feed.owner,
      repo: feed.repo
    });
  } catch (e) {
    console.warn('[Updater] Błąd konfiguracji feedu:', e.message);
  }

  autoUpdater.on('checking-for-update', () => {
    console.log('[Updater] Sprawdzanie dostępności aktualizacji...');
    updateStatus = {
      ...updateStatus,
      state: 'checking',
      error: null
    };
    sendUpdateStatus();
  });

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Dostępna nowa wersja:', info.version);
    updateStatus = {
      ...updateStatus,
      state: 'available',
      availableVersion: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : (Array.isArray(info.releaseNotes) ? info.releaseNotes.map(n => n.note).join('\n') : null),
      releaseDate: info.releaseDate || null,
      error: null
    };
    sendUpdateStatus();
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('[Updater] Brak nowych aktualizacji. Aktualna wersja jest najnowsza.');
    updateStatus = {
      ...updateStatus,
      state: 'not-available',
      availableVersion: info?.version || updateStatus.currentVersion,
      error: null
    };
    sendUpdateStatus();
  });

  autoUpdater.on('download-progress', (progressObj) => {
    updateStatus = {
      ...updateStatus,
      state: 'downloading',
      progress: {
        percent: Math.min(100, Math.round(progressObj.percent || 0)),
        bytesPerSecond: progressObj.bytesPerSecond || 0,
        transferred: progressObj.transferred || 0,
        total: progressObj.total || 0
      }
    };
    sendUpdateStatus();
    sendUpdateProgress(updateStatus.progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Aktualizacja pobrana pomyślnie:', info.version);
    updateStatus = {
      ...updateStatus,
      state: 'downloaded',
      availableVersion: info.version,
      error: null
    };
    sendUpdateStatus();
  });

  autoUpdater.on('error', (err) => {
    console.warn('[Updater] Błąd autoUpdater:', err?.message || err);
    // Jeśli błąd wynika z braku konfiguracji deweloperskiej, sprawdzamy przez GitHub API
    if (!app.isPackaged) {
      checkViaGitHubApi(feed).catch(() => {});
      return;
    }
    updateStatus = {
      ...updateStatus,
      state: 'error',
      error: err?.message || 'Nie udało się połączyć z serwerem aktualizacji.'
    };
    sendUpdateStatus();
  });

  // Automatyczne sprawdzenie w tle 4 sekundy po uruchomieniu launchera
  setTimeout(() => {
    triggerCheck();
  }, 4000);
}

async function checkViaGitHubApi(feed) {
  try {
    updateStatus.state = 'checking';
    sendUpdateStatus();

    const url = `https://api.github.com/repos/${feed.owner}/${feed.repo}/releases/latest`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': `KasteuszLauncher/${updateStatus.currentVersion}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) {
      if (res.status === 404) {
        updateStatus = {
          ...updateStatus,
          state: 'not-available',
          error: null
        };
        sendUpdateStatus();
        return;
      }
      throw new Error(`Błąd serwera GitHub (${res.status})`);
    }

    const data = await res.json();
    const latestTag = String(data.tag_name || data.name || '').replace(/^v/i, '').trim();
    const current = updateStatus.currentVersion.replace(/^v/i, '').trim();

    if (compareSemver(latestTag, current) > 0) {
      // Find asset for platform
      let directDownload = data.html_url;
      if (Array.isArray(data.assets)) {
        const isWin = process.platform === 'win32';
        const targetExt = isWin ? '.exe' : '.AppImage';
        const match = data.assets.find(a => a.name && a.name.endsWith(targetExt));
        if (match && match.browser_download_url) {
          directDownload = match.browser_download_url;
        }
      }

      updateStatus = {
        ...updateStatus,
        state: 'available',
        availableVersion: latestTag,
        releaseNotes: data.body || 'Nowe usprawnienia i poprawki w Kasteusz Launcher.',
        releaseDate: data.published_at || null,
        downloadUrl: directDownload,
        error: null
      };
    } else {
      updateStatus = {
        ...updateStatus,
        state: 'not-available',
        availableVersion: latestTag,
        error: null
      };
    }
    sendUpdateStatus();
  } catch (err) {
    updateStatus = {
      ...updateStatus,
      state: 'error',
      error: err.message
    };
    sendUpdateStatus();
  }
}

function compareSemver(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

async function triggerCheck() {
  const feed = getUpdateFeedConfig();
  updateStatus.repo = feed.fullRepo;

  if (!app.isPackaged) {
    // In dev mode, check directly via GitHub API
    await checkViaGitHubApi(feed);
    return;
  }

  try {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: feed.owner,
      repo: feed.repo
    });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    console.warn('[Updater] autoUpdater.checkForUpdates error:', err.message);
    await checkViaGitHubApi(feed);
  }
}

function setupUpdaterIpc() {
  ipcMain.handle('updater:check', async () => {
    await triggerCheck();
    return updateStatus;
  });

  ipcMain.handle('updater:download', async () => {
    if (app.isPackaged) {
      try {
        updateStatus.state = 'downloading';
        sendUpdateStatus();
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (err) {
        console.warn('[Updater] Błąd pobierania autoUpdater:', err.message);
      }
    }

    // Jeśli w trybie deweloperskim lub pobieranie przez przeglądarkę
    if (updateStatus.downloadUrl) {
      shell.openExternal(updateStatus.downloadUrl);
      return { success: true, openedBrowser: true };
    } else {
      const feed = getUpdateFeedConfig();
      shell.openExternal(`https://github.com/${feed.owner}/${feed.repo}/releases/latest`);
      return { success: true, openedBrowser: true };
    }
  });

  ipcMain.handle('updater:install', () => {
    try {
      if (app.isPackaged) {
        // isSilent = false, isForceRunAfter = true
        autoUpdater.quitAndInstall(false, true);
        return { success: true };
      } else {
        app.relaunch();
        app.exit(0);
        return { success: true };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('updater:get-status', () => {
    return updateStatus;
  });

  ipcMain.handle('updater:save-repo', (_e, newRepo) => {
    const cleanRepo = String(newRepo || '').trim();
    if (!cleanRepo || !cleanRepo.includes('/')) {
      throw new Error('Podaj repozytorium w formacie: właściciel/nazwa (np. filipeczek1/KasteuszLauncher)');
    }
    const currentCfg = config.loadConfig ? config.loadConfig() : {};
    currentCfg.githubRepo = cleanRepo;
    if (config.saveConfig) config.saveConfig(currentCfg);

    const feed = getUpdateFeedConfig();
    updateStatus.repo = feed.fullRepo;
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: feed.owner,
        repo: feed.repo
      });
    } catch (_) {}

    sendUpdateStatus();
    return { success: true, repo: cleanRepo };
  });
}

module.exports = {
  initUpdater,
  setupUpdaterIpc,
  getUpdateFeedConfig,
  triggerCheck
};
