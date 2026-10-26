// KasteuszLauncher Renderer Controller

let skinViewer = null;
let currentAccount = null;
let currentConfig = null;
let availableVersions = [];
let isGameLaunching = false;

// DOM Elements
const elements = {
  // Topbar
  navPills: document.querySelectorAll('.nav-pill'),
  tabViews: document.querySelectorAll('.tab-view'),
  userProfileBtn: document.getElementById('user-profile-btn'),
  userAvatarHead: document.getElementById('user-avatar-head'),
  userNicknameText: document.getElementById('user-nickname-text'),
  userStatusDot: document.getElementById('user-status-dot'),
  btnWinMinimize: document.getElementById('btn-win-minimize'),
  btnWinClose: document.getElementById('btn-win-close'),

  // Play View
  skinContainer: document.getElementById('skin-container'),
  skinCanvas: document.getElementById('skin-canvas'),
  currentVersionDisplay: document.getElementById('current-version-display'),
  playBtnGroup: document.getElementById('play-btn-group'),
  btnPlayGame: document.getElementById('btn-play-game'),
  playBtnText: document.getElementById('play-btn-text'),
  btnVersionDropdown: document.getElementById('btn-version-dropdown'),
  versionQuickMenu: document.getElementById('version-quick-menu'),

  // Versions View
  versionsFullGrid: document.getElementById('versions-full-grid'),

  // Settings View
  settingFpsBoost: document.getElementById('setting-fps-boost'),
  settingOptimizeOptions: document.getElementById('setting-optimize-options'),
  settingRamMax: document.getElementById('setting-ram-max'),
  settingRamVal: document.getElementById('setting-ram-val'),
  settingJavaPath: document.getElementById('setting-java-path'),
  settingJavaDesc: document.getElementById('setting-java-desc'),
  btnBrowseJava: document.getElementById('btn-browse-java'),
  settingGameDir: document.getElementById('setting-game-dir'),
  btnBrowseDir: document.getElementById('btn-browse-dir'),
  settingCloseOnLaunch: document.getElementById('setting-close-on-launch'),
  logsConsole: document.getElementById('logs-console'),
  btnClearLogs: document.getElementById('btn-clear-logs'),

  // Modals
  loginModal: document.getElementById('login-modal'),
  btnCloseLoginModal: document.getElementById('btn-close-login-modal'),
  btnMsLoginSubmit: document.getElementById('btn-ms-login-submit'),
  loginStatusText: document.getElementById('login-status-text'),
  offlineUsernameInput: document.getElementById('offline-username-input'),
  btnOfflineSubmit: document.getElementById('btn-offline-submit'),

  profileModal: document.getElementById('profile-modal'),
  btnCloseProfileModal: document.getElementById('btn-close-profile-modal'),
  modalAccountAvatar: document.getElementById('modal-account-avatar'),
  modalAccountName: document.getElementById('modal-account-name'),
  modalAccountBadge: document.getElementById('modal-account-badge'),
  modalAccountUuid: document.getElementById('modal-account-uuid'),
  profileNewUsernameInput: document.getElementById('profile-new-username-input'),
  btnProfileChangeNick: document.getElementById('btn-profile-change-nick'),
  btnUploadSkinFile: document.getElementById('btn-upload-skin-file'),
  btnResetDefaultSkin: document.getElementById('btn-reset-default-skin'),
  btnModalSwitchMs: document.getElementById('btn-modal-switch-ms'),
  btnModalLogout: document.getElementById('btn-modal-logout'),

  // Mods View
  modsListContainer: document.getElementById('mods-list-container'),
  btnAddMods: document.getElementById('btn-add-mods'),
  btnOpenModsFolder: document.getElementById('btn-open-mods-folder'),
  btnInstallFabric: document.getElementById('btn-install-fabric'),
  btnInstallSodium: document.getElementById('btn-install-sodium'),

  toastContainer: document.getElementById('toast-container')
};

// 1. Initialise App
async function initApp() {
  setupWindowControls();
  setupNavigation();
  init3DSkinViewer();
  setupSettingsListeners();
  setupModsListeners();
  setupModBrowser();
  setupLauncherEventListeners();

  await loadConfig();
  await loadAccount();
  await loadVersions();
  await loadMods();
  await loadFriends();
  setupFriendsListeners();
  initOfficialServerWidget();
  setupServerHostingListeners();
  await loadServerHosting();

  // "przed tym trzeba sie zalogowac na konto premium"
  // Automatycznie otwieramy okno logowania, jeśli użytkownik nie jest jeszcze zalogowany
  if (!currentAccount) {
    setTimeout(() => {
      openLoginModal();
    }, 400);
  }
}

// Window control buttons
function setupWindowControls() {
  elements.btnWinMinimize.addEventListener('click', () => window.api.minimizeWindow());
  elements.btnWinClose.addEventListener('click', () => window.api.closeWindow());
}

// Navigation between tabs
function setupNavigation() {
  elements.navPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const targetTab = pill.getAttribute('data-tab');
      
      elements.navPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      elements.tabViews.forEach(view => {
        view.classList.remove('active');
        if (view.id === `view-${targetTab}`) {
          view.classList.add('active');
          const panel = view.querySelector('.view-panel');
          if (panel) panel.scrollTop = 0;
        }
      });

      // Lazy load mod browser on first click to 'mods' tab
      if (targetTab === 'mods' && !hasLoadedModBrowseOnce) {
        hasLoadedModBrowseOnce = true;
        loadModrinthMods();
      }

      // Resize 3D viewer when switching back to play view
      if (targetTab === 'play' && skinViewer) {
        setTimeout(handleViewerResize, 50);
      }
    });
  });

  // Profile Button Click
  elements.userProfileBtn.addEventListener('click', () => {
    if (!currentAccount) {
      openLoginModal();
    } else {
      openProfileModal();
    }
  });

  // Version Dropdown Trigger
  elements.btnVersionDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.versionQuickMenu.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (!elements.versionQuickMenu.contains(e.target) && e.target !== elements.btnVersionDropdown) {
      elements.versionQuickMenu.classList.remove('open');
    }
  });

  // Subtabs inside Instancje (Zainstalowane / Wersje)
  const subtabBtnMods = document.getElementById('subtab-btn-mods');
  const subtabBtnVersions = document.getElementById('subtab-btn-versions');
  const subtabViewMods = document.getElementById('subtab-view-mods');
  const subtabViewVersions = document.getElementById('subtab-view-versions');

  function activateSubtab(btn, view) {
    [subtabBtnMods, subtabBtnVersions].forEach(b => {
      if (b) {
        b.classList.remove('active');
        b.style.background = 'transparent';
      }
    });
    [subtabViewMods, subtabViewVersions].forEach(v => {
      if (v) v.style.display = 'none';
    });
    if (btn) {
      btn.classList.add('active');
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
    }
    if (view) view.style.display = 'block';
  }

  subtabBtnMods?.addEventListener('click', () => activateSubtab(subtabBtnMods, subtabViewMods));
  subtabBtnVersions?.addEventListener('click', () => activateSubtab(subtabBtnVersions, subtabViewVersions));

  // Play Button Click
  elements.btnPlayGame.addEventListener('click', handlePlayClick);
}

// 2. 3D Skin Viewer setup with dynamic stance animation matching screenshot
function createStanceAnimationClass() {
  if (!window.skinview3d?.PlayerAnimation) return null;
  return class extends window.skinview3d.PlayerAnimation {
    animate(player) {
      const t = 1.4 * this.progress;
      // Arms slightly flared and naturally angled in 3/4 stance
      player.skin.leftArm.rotation.x = -0.18 + 0.03 * Math.sin(t);
      player.skin.leftArm.rotation.z = 0.12 + 0.015 * Math.cos(t);

      player.skin.rightArm.rotation.x = 0.18 - 0.03 * Math.sin(t);
      player.skin.rightArm.rotation.z = -0.12 - 0.015 * Math.cos(t);

      // Natural stepping/standing legs stance
      player.skin.leftLeg.rotation.x = 0.14;
      player.skin.leftLeg.rotation.z = -0.03;

      player.skin.rightLeg.rotation.x = -0.14;
      player.skin.rightLeg.rotation.z = 0.03;

      // Head tilted slightly towards viewer with clear eye contact
      player.skin.head.rotation.y = 0.30 + 0.02 * Math.sin(t * 0.5);
      player.skin.head.rotation.x = -0.02 + 0.01 * Math.cos(t * 0.5);
    }
  };
}

function init3DSkinViewer() {
  if (!window.skinview3d) {
    console.warn('Biblioteka skinview3d nie załadowana.');
    return;
  }

  const container = elements.skinContainer;
  const width = container.clientWidth || 400;
  const height = container.clientHeight || 450;

  skinViewer = new window.skinview3d.SkinViewer({
    canvas: elements.skinCanvas,
    width: width,
    height: height,
    skin: 'assets/default-skin.png'
  });

  // Setup animations and camera
  const StanceAnim = createStanceAnimationClass();
  if (StanceAnim) {
    skinViewer.animation = new StanceAnim();
    skinViewer.animation.speed = 0.6;
  } else {
    skinViewer.animation = new window.skinview3d.IdleAnimation();
  }

  skinViewer.controls.enableRotate = true;
  skinViewer.controls.enableZoom = false;
  skinViewer.controls.enablePan = false;

  // Set slight 3/4 angle on wrapper so it persists across animation cycles
  if (skinViewer.playerWrapper) {
    skinViewer.playerWrapper.rotation.y = -0.42;
    skinViewer.playerWrapper.position.y = -2;
  } else {
    skinViewer.playerObject.rotation.y = -0.42;
    skinViewer.playerObject.position.y = -2;
  }

  // Lighting with vibrant Minecraft colors matching screenshot
  if (skinViewer.globalLight) {
    skinViewer.globalLight.intensity = 1.05;
  }
  if (skinViewer.cameraLight) {
    skinViewer.cameraLight.intensity = 1.75;
  }

  window.addEventListener('resize', handleViewerResize);
}

function handleViewerResize() {
  if (!skinViewer || !elements.skinContainer) return;
  const width = elements.skinContainer.clientWidth;
  const height = elements.skinContainer.clientHeight;
  if (width > 0 && height > 0) {
    skinViewer.width = width;
    skinViewer.height = height;
  }
}

function updateSkinDisplay(skinUrl) {
  if (!skinViewer) return;
  const target = skinUrl || 'assets/default-skin.png';
  try {
    skinViewer.loadSkin(target).catch(err => {
      console.warn('Błąd ładowania skórki, używam fallbacku:', err);
      if (target !== 'assets/default-skin.png') {
        skinViewer.loadSkin('assets/default-skin.png');
      }
    });
  } catch (e) {
    console.warn('Wyjątek podczas wczytywania skórki:', e);
  }
}

// 3. Configuration & Settings
async function loadConfig() {
  try {
    currentConfig = await window.api.getConfig();
    
    // FPS Boost Settings
    if (elements.settingFpsBoost) {
      elements.settingFpsBoost.checked = currentConfig.fpsBoostMode !== false;
    }
    if (elements.settingOptimizeOptions) {
      elements.settingOptimizeOptions.checked = currentConfig.optimizeGameOptions !== false;
    }

    // RAM
    elements.settingRamMax.value = currentConfig.memoryMax || 4;
    elements.settingRamVal.textContent = `${currentConfig.memoryMax || 4} GB`;

    // Java
    elements.settingJavaPath.value = currentConfig.javaPath || '/usr/bin/java';
    elements.settingGameDir.value = currentConfig.gameDirectory || '~/.kasteuszlauncher/minecraft';
    elements.settingCloseOnLaunch.checked = !!currentConfig.closeOnLaunch;

    // Selected Version
    const version = currentConfig.selectedVersion || '1.21.4';
    updateSelectedVersion(version, false);
  } catch (err) {
    console.error('Błąd ładowania konfiguracji:', err);
  }
}

function setupSettingsListeners() {
  // FPS Boost Toggle
  elements.settingFpsBoost?.addEventListener('change', (e) => {
    window.api.saveConfig({ fpsBoostMode: e.target.checked });
    showToast(e.target.checked ? '⚡ Włączono tryb FPS Boost!' : 'Wyłączono tryb FPS Boost');
  });

  // Optimize Options Toggle
  elements.settingOptimizeOptions?.addEventListener('change', (e) => {
    window.api.saveConfig({ optimizeGameOptions: e.target.checked });
  });

  // RAM slider
  elements.settingRamMax.addEventListener('input', (e) => {
    const val = e.target.value;
    elements.settingRamVal.textContent = `${val} GB`;
    window.api.saveConfig({ memoryMax: parseInt(val, 10) });
  });

  // Java Browse
  elements.btnBrowseJava.addEventListener('click', async () => {
    const chosen = await window.api.selectJava();
    if (chosen) {
      elements.settingJavaPath.value = chosen;
      window.api.saveConfig({ javaPath: chosen });
      showToast('Zaktualizowano ścieżkę Java.');
    }
  });

  // Dir Browse
  elements.btnBrowseDir.addEventListener('click', async () => {
    const chosen = await window.api.selectDirectory();
    if (chosen) {
      elements.settingGameDir.value = chosen;
      window.api.saveConfig({ gameDirectory: chosen });
      showToast('Zaktualizowano katalog gry.');
    }
  });

  // Close on launch
  elements.settingCloseOnLaunch.addEventListener('change', (e) => {
    window.api.saveConfig({ closeOnLaunch: e.target.checked });
  });

  // Clear logs
  elements.btnClearLogs.addEventListener('click', () => {
    elements.logsConsole.innerHTML = '[KasteuszLauncher] Konsola wyczyszczona.<br>';
  });
}

// 4. Accounts & Authentication
async function loadAccount() {
  try {
    currentAccount = await window.api.getActiveAccount();
    await applyAccountToUI(currentAccount);
  } catch (err) {
    console.error('Błąd odczytu konta:', err);
    await applyAccountToUI(null);
  }
}

async function applyAccountToUI(account) {
  currentAccount = account;
  if (account) {
    elements.userNicknameText.textContent = account.username;
    if (elements.userStatusDot) elements.userStatusDot.style.background = '#22c55e';

    // Pobierz URL skórki na podstawie nicku jeśli jeszcze nie jest ustawiona
    let skinToUse = account.skinUrl;
    if (!skinToUse && account.username) {
      try {
        skinToUse = await window.api.getSkinUrl(account.username);
        account.skinUrl = skinToUse;
      } catch (err) {
        console.warn('Nie udało się pobrać skórki dla nicku:', err);
      }
    }

    if (skinToUse) {
      updateSkinDisplay(skinToUse);
      if (elements.userAvatarHead) elements.userAvatarHead.src = `https://mc-heads.net/avatar/${encodeURIComponent(account.username)}/32`;
    } else {
      updateSkinDisplay('assets/default-skin.png');
      if (elements.userAvatarHead) elements.userAvatarHead.src = 'assets/default-skin.png';
    }
  } else {
    elements.userNicknameText.textContent = 'Zaloguj się';
    if (elements.userStatusDot) elements.userStatusDot.style.background = '#f59e0b';
    if (elements.userAvatarHead) elements.userAvatarHead.src = 'assets/default-skin.png';
    updateSkinDisplay('assets/default-skin.png');
  }
}

// Setup Login Modal Handlers
elements.btnCloseLoginModal.addEventListener('click', closeLoginModal);

elements.btnMsLoginSubmit.addEventListener('click', async () => {
  elements.loginStatusText.textContent = 'Oczekiwanie na zalogowanie w oknie Microsoft...';
  elements.btnMsLoginSubmit.disabled = true;

  try {
    const account = await window.api.loginMicrosoft();
    await applyAccountToUI(account);
    closeLoginModal();
    showToast(`Zalogowano pomyślnie jako ${account.username}!`);
  } catch (err) {
    console.error('Błąd logowania Microsoft:', err);
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    elements.loginStatusText.textContent = cleanErr ? `Błąd: ${cleanErr}` : 'Błąd logowania';
  } finally {
    elements.btnMsLoginSubmit.disabled = false;
  }
});

elements.btnOfflineSubmit.addEventListener('click', async () => {
  const username = elements.offlineUsernameInput.value.trim();
  if (!username) {
    elements.loginStatusText.textContent = 'Podaj nazwę gracza.';
    return;
  }
  try {
    elements.loginStatusText.textContent = `Pobieranie skórki dla ${username}...`;
    const account = await window.api.loginOffline(username);
    await applyAccountToUI(account);
    closeLoginModal();
    showToast(`Wczytano konto i skórkę: ${account.username}`);
  } catch (err) {
    elements.loginStatusText.textContent = `Błąd: ${err.message}`;
  }
});

elements.offlineUsernameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.btnOfflineSubmit.click();
  }
});

// Setup Profile Modal Handlers
elements.btnCloseProfileModal.addEventListener('click', closeProfileModal);

elements.btnProfileChangeNick.addEventListener('click', async () => {
  const newNick = elements.profileNewUsernameInput.value.trim();
  if (!newNick) {
    showToast('Wpisz nick gracza Minecraft.');
    return;
  }
  showToast(`Pobieranie skórki Minecraft dla ${newNick}...`);
  try {
    const updated = await window.api.setUsername(newNick);
    await applyAccountToUI(updated);
    elements.modalAccountName.textContent = updated.username;
    elements.modalAccountAvatar.src = `https://mc-heads.net/avatar/${encodeURIComponent(updated.username)}/48`;
    showToast(`Ustawiono nick ${updated.username} i wczytano skórkę!`);
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
});

elements.profileNewUsernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.btnProfileChangeNick.click();
  }
});

elements.btnUploadSkinFile.addEventListener('click', async () => {
  try {
    const updated = await window.api.selectSkinFile();
    if (updated) {
      await applyAccountToUI(updated);
      showToast('Wczytano własną skórkę z pliku .png!');
    }
  } catch (err) {
    showToast(`Błąd wczytywania: ${err.message}`);
  }
});

elements.btnResetDefaultSkin.addEventListener('click', async () => {
  try {
    const updated = await window.api.setCustomSkin('assets/default-skin.png');
    await applyAccountToUI(updated);
    showToast('Przywrócono domyślną skórkę.');
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
});

elements.btnModalSwitchMs.addEventListener('click', () => {
  closeProfileModal();
  openLoginModal();
});

elements.btnModalLogout.addEventListener('click', async () => {
  await window.api.logout();
  await applyAccountToUI(null);
  closeProfileModal();
  showToast('Wylogowano z konta.');
});

// Modal backdrop clicks and escape key
elements.loginModal?.addEventListener('click', (e) => {
  if (e.target === elements.loginModal) closeLoginModal();
});

elements.profileModal?.addEventListener('click', (e) => {
  if (e.target === elements.profileModal) closeProfileModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeLoginModal();
    closeProfileModal();
  }
});

function openLoginModal(force = false) {
  if (currentAccount && !force) return;
  if (elements.loginStatusText) elements.loginStatusText.textContent = '';
  if (elements.offlineUsernameInput) elements.offlineUsernameInput.value = '';
  if (elements.loginModal) elements.loginModal.classList.add('open');
}

function closeLoginModal() {
  if (elements.loginModal) elements.loginModal.classList.remove('open');
}

function openProfileModal() {
  if (!currentAccount) {
    openLoginModal();
    return;
  }
  elements.modalAccountName.textContent = currentAccount.username;
  elements.modalAccountUuid.textContent = `UUID: ${currentAccount.uuid}`;
  elements.modalAccountAvatar.src = `https://mc-heads.net/avatar/${encodeURIComponent(currentAccount.username)}/48`;
  elements.profileNewUsernameInput.value = currentAccount.username;

  if (currentAccount.isPremium) {
    elements.modalAccountBadge.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
      <span>Konto Premium (Microsoft)</span>
    `;
    elements.modalAccountBadge.style.color = '#22c55e';
  } else {
    elements.modalAccountBadge.innerHTML = `<span>Tryb testowy (Offline)</span>`;
    elements.modalAccountBadge.style.color = '#eab308';
  }

  if (elements.profileModal) elements.profileModal.classList.add('open');
}

function closeProfileModal() {
  if (elements.profileModal) elements.profileModal.classList.remove('open');
}

// 4.5. Mods Manager
let installedMods = [];

async function loadMods() {
  try {
    installedMods = await window.api.getModsList();
    renderModsList(installedMods);
  } catch (err) {
    console.error('Błąd ładowania modów:', err);
  }
}

function renderModsList(mods) {
  if (!elements.modsListContainer) return;
  elements.modsListContainer.innerHTML = '';

  if (!mods || mods.length === 0) {
    elements.modsListContainer.innerHTML = `
      <div style="background: rgba(255, 255, 255, 0.02); border: 2px dashed rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 40px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 12px;">
        <div style="width: 52px; height: 52px; border-radius: 14px; background: rgba(168, 85, 247, 0.15); display: flex; align-items: center; justify-content: center; font-size: 24px;">
          🧩
        </div>
        <div style="font-size: 16px; font-weight: 700; color: #ffffff;">Brak zainstalowanych modów</div>
        <div style="font-size: 12.5px; color: #8e95a5; max-width: 440px; line-height: 1.5;">
          Możesz dodawać mody w formacie <b>.jar</b> (np. Sodium, Lithium, Iris) klikając przycisk powyżej lub przeciągając pliki bezpośrednio do tego okna.
        </div>
        <button class="btn-secondary" id="btn-empty-add-mods" style="margin-top: 6px; background: #ffffff; color: #000000; font-weight: 700; padding: 10px 20px;">
          ➕ Dodaj Mody (.jar)
        </button>
      </div>
    `;

    document.getElementById('btn-empty-add-mods')?.addEventListener('click', () => {
      elements.btnAddMods?.click();
    });
    return;
  }

  mods.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'setting-row';
    card.style.padding = '14px 18px';
    card.style.opacity = mod.enabled ? '1' : '0.6';
    card.style.transition = 'opacity 0.2s ease, transform 0.15s ease';

    card.innerHTML = `
      <div style="display: flex; align-items: center; gap: 14px;">
        <div style="width: 38px; height: 38px; border-radius: 10px; background: ${mod.enabled ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 255, 255, 0.05)'}; display: flex; align-items: center; justify-content: center; font-size: 18px;">
          ${mod.enabled ? '🧩' : '💤'}
        </div>
        <div style="display: flex; flex-direction: column; gap: 3px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13.5px; font-weight: 600; color: #ffffff;">${mod.name}</span>
            <span style="font-size: 9.5px; font-weight: 700; background: rgba(255, 255, 255, 0.08); padding: 1px 5px; border-radius: 4px; color: #94a3b8;">
              ${mod.enabled ? '.JAR' : 'WYŁĄCZONY'}
            </span>
          </div>
          <span style="font-size: 11px; color: #64748b;">Rozmiar: ${mod.size}</span>
        </div>
      </div>

      <div style="display: flex; align-items: center; gap: 12px;">
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: ${mod.enabled ? '#4ade80' : '#94a3b8'};">
          <input type="checkbox" class="mod-toggle" data-filename="${mod.filename}" ${mod.enabled ? 'checked' : ''} style="width: 17px; height: 17px; accent-color: #22c55e; cursor: pointer;">
          <span>${mod.enabled ? 'Aktywny' : 'Wyłączony'}</span>
        </label>

        <button class="win-btn close mod-delete-btn" data-filename="${mod.filename}" title="Usuń mod" style="width: 30px; height: 30px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;

    // Toggle switch
    const toggle = card.querySelector('.mod-toggle');
    toggle?.addEventListener('change', async () => {
      try {
        const updated = await window.api.toggleMod(mod.filename);
        installedMods = updated;
        renderModsList(installedMods);
        showToast(toggle.checked ? `Włączono mod: ${mod.name}` : `Wyłączono mod: ${mod.name}`);
      } catch (err) {
        showToast(`Błąd: ${err.message}`);
      }
    });

    // Delete button
    const deleteBtn = card.querySelector('.mod-delete-btn');
    deleteBtn?.addEventListener('click', async () => {
      if (confirm(`Czy na pewno chcesz usunąć mod "${mod.name}"?`)) {
        try {
          const updated = await window.api.deleteMod(mod.filename);
          installedMods = updated;
          renderModsList(installedMods);
          showToast(`Usunięto mod: ${mod.name}`);
        } catch (err) {
          showToast(`Błąd: ${err.message}`);
        }
      }
    });

    elements.modsListContainer.appendChild(card);
  });
}

function setupModsListeners() {
  // Add mods button
  elements.btnAddMods?.addEventListener('click', async () => {
    try {
      showToast('Wybierz pliki modów .jar...');
      const res = await window.api.addModFiles();
      if (res && res.added > 0) {
        installedMods = res.mods;
        renderModsList(installedMods);
        showToast(`Pomyślnie dodano ${res.added} mod(ów)!`);
      }
    } catch (err) {
      showToast(`Błąd dodawania modów: ${err.message}`);
    }
  });

  // Open mods folder
  elements.btnOpenModsFolder?.addEventListener('click', async () => {
    try {
      await window.api.openModsFolder();
      showToast('Otwarto folder mods w menedżerze plików.');
    } catch (err) {
      showToast(`Błąd: ${err.message}`);
    }
  });

  // Install Fabric Loader
  elements.btnInstallFabric?.addEventListener('click', async () => {
    const currentVer = elements.currentVersionDisplay.textContent || '1.20.4';
    // Jeśli wersja to np. 1.21.4, wyciągamy wersję bazową
    const baseVer = currentVer.replace(/fabric-loader-[^-]+-/, '');
    showToast(`Pobieranie i instalacja Fabric Loader dla Minecraft ${baseVer}...`);

    try {
      const res = await window.api.installFabric(baseVer);
      updateSelectedVersion(res.versionId);
      showToast(`Zainstalowano Fabric Loader ${res.loaderVersion} dla ${res.minecraftVersion}!`);
      appendLog(`[Fabric] Zainstalowano pomyślnie wersję ${res.versionId}.`);
    } catch (err) {
      console.warn('Fabric install error:', err);
      // Fallback: 1.20.4
      try {
        const res2 = await window.api.installFabric('1.20.4');
        updateSelectedVersion(res2.versionId);
        showToast(`Zainstalowano Fabric dla stabilnej wersji 1.20.4!`);
      } catch (err2) {
        showToast(`Błąd instalacji Fabric: ${err.message}`);
      }
    }
  });

  // Install Sodium 1-click
  elements.btnInstallSodium?.addEventListener('click', async () => {
    const currentVer = elements.currentVersionDisplay.textContent || '1.20.4';
    const baseVer = currentVer.replace(/fabric-[^-]+-/, '');
    showToast(`Pobieranie i instalacja modu Sodium dla Minecraft ${baseVer}...`);
    try {
      const res = await window.api.installSodium(baseVer);
      installedMods = res.mods;
      renderModsList(installedMods);
      updateSelectedVersion(`fabric-${baseVer}`);
      showToast(`Pomyślnie zainstalowano Sodium i włączono silnik Fabric!`);
    } catch (err) {
      try {
        const res2 = await window.api.installSodium('1.20.4');
        installedMods = res2.mods;
        renderModsList(installedMods);
        updateSelectedVersion('fabric-1.20.4');
        showToast('Pomyślnie zainstalowano Sodium dla 1.20.4!');
      } catch (err2) {
        showToast(`Błąd instalacji Sodium: ${err.message}`);
      }
    }
  });

  // Obsługa przeciągania modów (Drag and drop)
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const jarPaths = Array.from(e.dataTransfer.files)
        .filter(f => f.name.endsWith('.jar'))
        .map(f => f.path);

      if (jarPaths.length > 0) {
        showToast(`Dodawanie ${jarPaths.length} przeciągniętych modów...`);
        try {
          const res = await window.api.copyModFiles(jarPaths);
          if (res && res.added > 0) {
            installedMods = res.mods;
            renderModsList(installedMods);
            showToast(`Pomyślnie dodano ${res.added} mod(ów)!`);
          }
        } catch (err) {
          showToast(`Błąd: ${err.message}`);
        }
      }
    }
  });
}

// ============================================================================
// Wbudowana Przeglądarka Modów (Modrinth API)
// ============================================================================

let hasLoadedModBrowseOnce = false;
let currentModCategory = 'all';
let modSearchTimeout = null;

function isModInstalled(modHit) {
  if (!installedMods || installedMods.length === 0) return false;
  const slugClean = (modHit.slug || '').toLowerCase().replace(/[-_]/g, '');
  const titleClean = (modHit.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return installedMods.some(m => {
    const fn = m.filename.toLowerCase().replace(/[-_]/g, '');
    return (slugClean && fn.includes(slugClean)) || (titleClean && titleClean.length > 3 && fn.includes(titleClean));
  });
}

function formatDownloads(num) {
  if (!num) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

function setupModBrowser() {
  const searchInput = document.getElementById('mod-browse-search-input');
  const clearBtn = document.getElementById('mod-browse-search-clear');
  const sortSelect = document.getElementById('mod-browse-sort-select');
  const verLock = document.getElementById('mod-browse-ver-lock');
  const chipsContainer = document.getElementById('mod-categories-chips');

  // Search input with debounce
  searchInput?.addEventListener('input', () => {
    const val = searchInput.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'block' : 'none';
    clearTimeout(modSearchTimeout);
    modSearchTimeout = setTimeout(() => {
      loadModrinthMods();
    }, 350);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    loadModrinthMods();
  });

  sortSelect?.addEventListener('change', () => {
    loadModrinthMods();
  });

  verLock?.addEventListener('change', () => {
    loadModrinthMods();
  });

  // Category chips
  chipsContainer?.querySelectorAll('.mod-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsContainer.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentModCategory = chip.getAttribute('data-category') || 'all';
      loadModrinthMods();
    });
  });
}

async function loadModrinthMods() {
  const searchInput = document.getElementById('mod-browse-search-input');
  const sortSelect = document.getElementById('mod-browse-sort-select');
  const verLock = document.getElementById('mod-browse-ver-lock');
  const resultsContainer = document.getElementById('mod-browse-results');
  const loadingEl = document.getElementById('mod-browse-loading');

  if (!resultsContainer) return;
  if (loadingEl) loadingEl.style.display = 'block';
  resultsContainer.style.opacity = '0.5';

  const query = searchInput?.value.trim() || '';
  const sort = sortSelect?.value || 'downloads';
  const onlyCurrent = verLock ? verLock.checked : false;

  try {
    const res = await window.api.searchModrinth({
      query,
      category: currentModCategory,
      gameVersion: '1.21.11',
      sort,
      onlyCurrentVersion: onlyCurrent,
      limit: 24
    });

    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';
    renderModBrowseResults(res.hits || []);
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';
    resultsContainer.innerHTML = `
      <div style="padding: 30px; text-align: center; color: #ef4444; background: rgba(239, 68, 68, 0.05); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
        <p style="font-weight: 700; margin-bottom: 6px;">Błąd połączenia z Modrinth</p>
        <p style="font-size: 12px; color: #94a3b8;">${err.message || 'Nie udało się pobrać listy modów'}</p>
        <button class="btn-secondary" id="btn-retry-browse" style="margin-top: 10px; padding: 6px 14px; font-size: 12px;">Spróbuj ponownie</button>
      </div>
    `;
    document.getElementById('btn-retry-browse')?.addEventListener('click', loadModrinthMods);
  }
}

function renderModBrowseResults(hits) {
  const resultsContainer = document.getElementById('mod-browse-results');
  if (!resultsContainer) return;
  resultsContainer.innerHTML = '';

  if (!hits || hits.length === 0) {
    resultsContainer.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #94a3b8; background: rgba(255, 255, 255, 0.02); border-radius: 12px; border: 1px dashed rgba(255, 255, 255, 0.08);">
        <div style="font-size: 28px; margin-bottom: 8px;">🔍</div>
        <p style="font-weight: 700; color: #ffffff; margin-bottom: 4px;">Nie znaleziono modów</p>
        <p style="font-size: 12px;">Spróbuj zmienić zapytanie, odznaczyć filtr „Wersja 1.21.11” lub wybrać inną kategorię.</p>
      </div>
    `;
    return;
  }

  hits.forEach(mod => {
    const card = document.createElement('div');
    card.className = 'mod-browse-card';

    const installed = isModInstalled(mod);
    const iconUrl = mod.icon_url || 'assets/logo.svg';
    const downloadsFmt = formatDownloads(mod.downloads);
    const followsFmt = formatDownloads(mod.follows);

    const catMap = {
      'optimization': 'Wydajność',
      'decoration': 'Grafika',
      'gui': 'Interfejs',
      'game-mechanics': 'Rozgrywka',
      'utility': 'Narzędzia',
      'adventure': 'Przygoda',
      'magic': 'Magia',
      'technology': 'Technologia',
      'storage': 'Magazyn'
    };

    const tagsHtml = (mod.categories || [])
      .filter(c => c !== 'fabric' && catMap[c])
      .slice(0, 2)
      .map(c => `<span class="mod-card-tag">${catMap[c]}</span>`)
      .join('');

    card.innerHTML = `
      <div class="mod-card-left">
        <img src="${iconUrl}" class="mod-card-icon" alt="${mod.title}" onerror="this.src='assets/logo.svg'">
        <div class="mod-card-details">
          <div class="mod-card-title-row">
            <span class="mod-card-title" title="${mod.title}">${mod.title}</span>
            <span class="mod-card-author">od ${mod.author}</span>
          </div>
          <div class="mod-card-desc" title="${mod.description}">${mod.description}</div>
          <div class="mod-card-meta">
            <span class="mod-card-stat">🔥 ${downloadsFmt} pobrań</span>
            <span class="mod-card-stat">⭐ ${followsFmt}</span>
            <span class="mod-card-tag" style="color: #c084fc; background: rgba(192, 132, 252, 0.1);">Fabric</span>
            ${tagsHtml}
          </div>
        </div>
      </div>

      <div class="mod-card-actions">
        ${installed ? `
          <button class="btn-mod-installed" disabled>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Zainstalowany</span>
          </button>
        ` : `
          <button class="btn-mod-download" data-slug="${mod.slug}" data-id="${mod.project_id}" data-title="${encodeURIComponent(mod.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Pobierz mod</span>
          </button>
        `}
      </div>
    `;

    const downloadBtn = card.querySelector('.btn-mod-download');
    downloadBtn?.addEventListener('click', async () => {
      const slug = downloadBtn.getAttribute('data-slug');
      const pid = downloadBtn.getAttribute('data-id');
      const title = decodeURIComponent(downloadBtn.getAttribute('data-title'));
      console.log('Clicked download for mod:', title, slug, pid);

      downloadBtn.disabled = true;
      downloadBtn.innerHTML = `
        <span class="mod-browse-spinner" style="width: 14px; height: 14px; border-width: 2px;"></span>
        <span>Pobieranie...</span>
      `;

      try {
        const res = await window.api.installModrinthMod({
          projectId: pid,
          slug,
          gameVersion: '1.21.11'
        });

        if (res.success) {
          installedMods = res.mods;
          renderModsList(installedMods);

          showToast(`Pomyślnie pobrano mod: ${title}`);
          if (res.dependencies && res.dependencies.length > 0) {
            showToast(`Pobrano także wymagane zależności: ${res.dependencies.join(', ')}`);
          }

          downloadBtn.className = 'btn-mod-installed';
          downloadBtn.disabled = true;
          downloadBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Zainstalowany</span>
          `;
        }
      } catch (dlErr) {
        showToast(`Błąd pobierania: ${dlErr.message}`);
        downloadBtn.disabled = false;
        downloadBtn.className = 'btn-mod-download';
        downloadBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Spróbuj ponownie</span>
        `;
      }
    });

    resultsContainer.appendChild(card);
  });
}

// 5. Versions list
async function loadVersions() {
  try {
    const data = await window.api.getVersions();
    availableVersions = data.releases || [];
    renderQuickVersionDropdown();
    renderFullVersionsGrid();
  } catch (err) {
    console.error('Błąd pobierania wersji:', err);
  }
}

let currentSelectedVersionId = '1.21.11';

function updateSelectedVersion(versionId, save = true) {
  currentSelectedVersionId = versionId || '1.21.11';
  const cleanDisplay = currentSelectedVersionId.replace(/^fabric-/, '');
  elements.currentVersionDisplay.textContent = cleanDisplay;
  elements.playBtnText.textContent = `Graj ${cleanDisplay}`;
  
  if (save) {
    window.api.saveConfig({ selectedVersion: currentSelectedVersionId });
    showToast(`Wybrano wersję ${cleanDisplay}`);
  }

  // Update selected class in dropdown and grid
  renderQuickVersionDropdown();
  renderFullVersionsGrid();
}

function renderQuickVersionDropdown() {
  const current = currentSelectedVersionId;
  elements.versionQuickMenu.innerHTML = '';

  availableVersions.slice(0, 10).forEach(ver => {
    const item = document.createElement('div');
    const isSelected = ver.id === current || ver.id === elements.currentVersionDisplay.textContent;
    item.className = `version-item ${isSelected ? 'selected' : ''}`;
    item.innerHTML = `
      <span>${ver.id}</span>
      <span class="version-item-badge">Wydanie</span>
    `;
    item.addEventListener('click', () => {
      updateSelectedVersion(ver.id);
      elements.versionQuickMenu.classList.remove('open');
    });
    elements.versionQuickMenu.appendChild(item);
  });
}

function renderFullVersionsGrid() {
  const current = currentSelectedVersionId;
  elements.versionsFullGrid.innerHTML = '';

  availableVersions.forEach(ver => {
    const card = document.createElement('div');
    const isSelected = ver.id === current || ver.id === elements.currentVersionDisplay.textContent;
    card.className = `version-card ${isSelected ? 'active' : ''}`;
    card.innerHTML = `
      <div class="version-card-top">
        <span class="version-card-id">${ver.id}</span>
        <span class="version-item-badge">Wydanie</span>
      </div>
      <div class="version-card-date">Data wydania: ${ver.releaseTime || 'Oficjalne'}</div>
    `;
    card.addEventListener('click', () => {
      updateSelectedVersion(ver.id);
      // Switch back to play tab
      elements.navPills[0].click();
    });
    elements.versionsFullGrid.appendChild(card);
  });
}

// 6. Minecraft Launching Logic
async function handlePlayClick() {
  if (isGameLaunching) return;

  if (!currentAccount) {
    showToast('Przed uruchomieniem gry musisz się zalogować!');
    openLoginModal();
    return;
  }

  const selectedVer = currentSelectedVersionId || '1.21.11';
  const cleanDisplay = selectedVer.replace(/^fabric-/, '');
  setLaunchingState(true, `Uruchamianie ${cleanDisplay}...`);

  try {
    await window.api.launchGame(selectedVer);
  } catch (err) {
    console.error('Błąd startu gry:', err);
    showToast(`Błąd uruchamiania: ${err.message}`);
    setLaunchingState(false);
  }
}

function setLaunchingState(launching, text = '') {
  isGameLaunching = launching;
  if (launching) {
    elements.playBtnGroup.classList.add('launching');
    elements.playBtnText.textContent = text || 'Pobieranie plików...';
  } else {
    elements.playBtnGroup.classList.remove('launching');
    const ver = elements.currentVersionDisplay.textContent;
    elements.playBtnText.textContent = `Graj ${ver}`;
  }
}

function setupLauncherEventListeners() {
  window.api.onLauncherStatus((data) => {
    if (data?.message) {
      elements.playBtnText.textContent = data.message;
      appendLog(`[STATUS] ${data.message}`);
    }
  });

  window.api.onLauncherProgress((data) => {
    if (data) {
      elements.playBtnText.textContent = `Pobieranie: ${data.percentage}% (${data.task}/${data.total})`;
    }
  });

  window.api.onLauncherLog((data) => {
    if (data?.text) {
      appendLog(data.text);
    }
  });

  window.api.onLauncherStarted((data) => {
    showToast(`Minecraft ${data.version} został uruchomiony!`);
    elements.playBtnText.textContent = 'Gra jest uruchomiona';
    appendLog(`[KasteuszLauncher] Minecraft ${data.version} wystartował.`);
    // FPS Boost: wyłączamy animację 3D dla 0% obciążenia GPU podczas grania
    if (skinViewer) {
      skinViewer.animation = null;
    }
  });

  window.api.onLauncherClosed((data) => {
    setLaunchingState(false);
    showToast(`Gra została zamknięta (kod: ${data.code}).`);
    appendLog(`[KasteuszLauncher] Proces gry zakończony z kodem ${data.code}.`);
    // Wznawiamy animację 3D po wyjściu z gry
    if (skinViewer && window.skinview3d) {
      skinViewer.animation = new window.skinview3d.IdleAnimation();
      skinViewer.animation.speed = 0.7;
    }
  });

  window.api.onLauncherError((data) => {
    setLaunchingState(false);
    showToast(`Błąd Minecraft: ${data.message}`);
    appendLog(`[BŁĄD] ${data.message}`);
  });
}

function appendLog(line) {
  const lineEl = document.createElement('div');
  lineEl.textContent = line;
  elements.logsConsole.appendChild(lineEl);
  elements.logsConsole.scrollTop = elements.logsConsole.scrollHeight;
}

// Toast notification helper
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2.5">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ============================================================================
// 7. ZNAJOMI (Friends System)
// ============================================================================
let friendsList = [];

async function loadFriends() {
  try {
    friendsList = await window.api.getFriends();
    renderFriendsList(friendsList);
  } catch (err) {
    console.error('Błąd wczytywania znajomych:', err);
  }
}

function renderFriendsList(friends) {
  const container = document.getElementById('friends-list-container');
  const countEl = document.getElementById('friends-count');
  if (!container) return;

  const onlineCount = (friends || []).filter(f => f.online).length;
  if (countEl) {
    countEl.textContent = `${onlineCount} online`;
  }

  if (!friends || friends.length === 0) {
    container.innerHTML = `
      <div class="sidebar-empty-text">
        Brak znajomych w tej chwili.<br>
        <span style="font-size: 11.5px; color: #a855f7; cursor: pointer; text-decoration: underline;" id="btn-empty-add-friend">Kliknij +, aby dodać gracza</span>
      </div>
    `;
    document.getElementById('btn-empty-add-friend')?.addEventListener('click', openAddFriendModal);
    return;
  }

  container.innerHTML = '';
  const listEl = document.createElement('div');
  listEl.className = 'friends-list';

  friends.forEach(f => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    item.innerHTML = `
      <div class="friend-avatar-wrap">
        <img src="https://mc-heads.net/avatar/${encodeURIComponent(f.username)}/32" class="friend-avatar" alt="${f.username}" onerror="this.src='assets/default-skin.png'">
        <span class="friend-status-dot ${f.online ? 'online' : 'offline'}"></span>
      </div>
      <div class="friend-info">
        <div class="friend-name">${f.username}</div>
        <div class="friend-status">${f.status || (f.online ? 'Online' : 'Offline')}</div>
      </div>
      <button class="friend-delete-btn" title="Usuń ${f.username}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    item.querySelector('.friend-delete-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const updated = await window.api.removeFriend(f.username);
        friendsList = updated;
        renderFriendsList(friendsList);
        showToast(`Usunięto gracza ${f.username} z listy znajomych.`);
      } catch (err) {
        showToast(`Błąd: ${err.message}`);
      }
    });

    item.addEventListener('click', () => {
      navigator.clipboard.writeText(f.username);
      showToast(`Skopiowano nick znajomego: ${f.username}`);
    });

    listEl.appendChild(item);
  });

  container.appendChild(listEl);
}

function openAddFriendModal() {
  const modal = document.getElementById('add-friend-modal');
  const input = document.getElementById('friend-input-nick');
  const errEl = document.getElementById('friend-modal-error');
  if (errEl) errEl.textContent = '';
  if (input) input.value = '';
  if (modal) modal.classList.add('open');
  input?.focus();
}

function closeAddFriendModal() {
  const modal = document.getElementById('add-friend-modal');
  if (modal) modal.classList.remove('open');
}

function setupFriendsListeners() {
  const btnAdd = document.getElementById('btn-add-friend');
  const btnRefresh = document.getElementById('btn-friends-activity');
  const btnClose = document.getElementById('btn-close-friend-modal');
  const btnSubmit = document.getElementById('btn-submit-add-friend');
  const input = document.getElementById('friend-input-nick');
  const modal = document.getElementById('add-friend-modal');
  const errEl = document.getElementById('friend-modal-error');

  btnAdd?.addEventListener('click', openAddFriendModal);
  btnRefresh?.addEventListener('click', async () => {
    showToast('Odświeżanie listy znajomych...');
    await loadFriends();
  });
  btnClose?.addEventListener('click', closeAddFriendModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeAddFriendModal();
  });

  const submitFriend = async () => {
    const nick = input.value.trim();
    if (!nick) {
      if (errEl) errEl.textContent = 'Wpisz poprawny nick gracza.';
      return;
    }
    try {
      if (errEl) errEl.textContent = 'Pobieranie danych gracza...';
      const updated = await window.api.addFriend(nick);
      friendsList = updated;
      renderFriendsList(friendsList);
      closeAddFriendModal();
      showToast(`Dodano znajomego: ${nick}!`);
    } catch (err) {
      if (errEl) errEl.textContent = err.message || 'Nie udało się dodać znajomego.';
    }
  };

  btnSubmit?.addEventListener('click', submitFriend);
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitFriend();
  });
}

// ============================================================================
// 8. OFICJALNY SERWER KASTEUSZA (szkolnesmp.com.pl)
// ============================================================================
function initOfficialServerWidget() {
  const btnCopy = document.getElementById('btn-copy-server-ip');
  btnCopy?.addEventListener('click', () => {
    navigator.clipboard.writeText('szkolnesmp.com.pl');
    showToast('Skopiowano IP serwera: szkolnesmp.com.pl!');
  });

  checkOfficialServerStatus();
  setInterval(checkOfficialServerStatus, 30000);
}

async function checkOfficialServerStatus() {
  const badgePill = document.getElementById('server-status-pill');
  const labelText = document.getElementById('server-status-label');
  const playersText = document.getElementById('server-players-count');

  try {
    const res = await fetch('https://api.mcsrvstat.us/3/szkolnesmp.com.pl');
    if (res.ok) {
      const data = await res.json();
      if (data && data.online) {
        if (badgePill) {
          badgePill.className = 'server-status-pill online';
        }
        if (labelText) labelText.textContent = 'Online';
        if (playersText) {
          const online = data.players?.online ?? 0;
          const max = data.players?.max ?? 20;
          playersText.textContent = `Gracze: ${online} / ${max}`;
        }
        return;
      }
    }
  } catch (err) {
    // Offline lub błąd
  }

  if (badgePill) {
    badgePill.className = 'server-status-pill offline';
  }
  if (labelText) labelText.textContent = 'Offline';
  if (playersText) playersText.textContent = 'Serwer wyłączony';
}

// ============================================================================
// 9. HOSTOWANIE SERWERA Z PC (Minecraft Server Host)
// ============================================================================
let isServerRunning = false;

async function loadServerHosting() {
  try {
    const status = await window.api.getServerStatus();
    updateServerHostUI(status);
  } catch (err) {
    console.error('Błąd statusu serwera:', err);
  }
}

function updateServerHostUI(status) {
  isServerRunning = !!status.running;
  const btn = document.getElementById('btn-toggle-server');
  const statusText = document.getElementById('server-console-status-text');
  const statusDot = document.getElementById('server-console-dot');
  const ipDisplay = document.getElementById('server-local-ip-display');
  const cmdInput = document.getElementById('server-cmd-input');
  const btnSend = document.getElementById('btn-send-server-cmd');

  if (ipDisplay && status.localIp) {
    ipDisplay.textContent = `${status.localIp}:${status.port || 25565}`;
  }

  if (isServerRunning) {
    if (btn) {
      btn.style.background = '#ef4444';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
        <span>Zatrzymaj Serwer</span>
      `;
    }
    if (statusText) {
      statusText.textContent = 'Status: Serwer działa (Online)';
      statusText.style.color = '#4ade80';
    }
    if (statusDot) statusDot.style.display = 'inline-block';
    if (cmdInput) cmdInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
  } else {
    if (btn) {
      btn.style.background = '#22c55e';
      btn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Uruchom Serwer</span>
      `;
    }
    if (statusText) {
      statusText.textContent = status.starting ? 'Status: Uruchamianie...' : 'Status: Wyłączony';
      statusText.style.color = status.starting ? '#facc15' : '#94a3b8';
    }
    if (statusDot) statusDot.style.display = 'none';
    if (cmdInput) cmdInput.disabled = true;
    if (btnSend) btnSend.disabled = true;
  }

  // Populate config fields
  if (status.config) {
    const c = status.config;
    if (document.getElementById('server-cfg-ram')) document.getElementById('server-cfg-ram').value = c.ram || 4;
    if (document.getElementById('server-cfg-port')) document.getElementById('server-cfg-port').value = c.port || 25565;
    if (document.getElementById('server-cfg-online-mode')) document.getElementById('server-cfg-online-mode').value = String(!!c.onlineMode);
    if (document.getElementById('server-cfg-gamemode')) document.getElementById('server-cfg-gamemode').value = c.gamemode || 'survival';
    if (document.getElementById('server-cfg-difficulty')) document.getElementById('server-cfg-difficulty').value = c.difficulty || 'normal';
    if (document.getElementById('server-cfg-pvp')) document.getElementById('server-cfg-pvp').value = String(c.pvp !== false);
  }
}

function appendServerLog(line) {
  const consoleEl = document.getElementById('server-console-log');
  if (!consoleEl) return;
  const lineEl = document.createElement('div');
  lineEl.className = 'server-log-line';
  lineEl.textContent = line;
  consoleEl.appendChild(lineEl);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

function setupServerHostingListeners() {
  const btnToggle = document.getElementById('btn-toggle-server');
  const btnCopyLocal = document.getElementById('btn-copy-local-ip');
  const btnCopyLocalhost = document.getElementById('btn-copy-localhost-ip');
  const cmdInput = document.getElementById('server-cmd-input');
  const btnSend = document.getElementById('btn-send-server-cmd');

  btnCopyLocal?.addEventListener('click', () => {
    const ip = document.getElementById('server-local-ip-display')?.textContent || '172.20.10.4:25565';
    navigator.clipboard.writeText(ip);
    showToast(`Skopiowano IP serwera dla znajomych: ${ip}`);
  });

  btnCopyLocalhost?.addEventListener('click', () => {
    navigator.clipboard.writeText('localhost:25565');
    showToast('Skopiowano adres: localhost:25565');
  });

  // Settings change auto-save
  const cfgInputs = [
    'server-cfg-ram', 'server-cfg-port', 'server-cfg-online-mode',
    'server-cfg-gamemode', 'server-cfg-difficulty', 'server-cfg-pvp'
  ];
  cfgInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      const newCfg = {
        ram: parseInt(document.getElementById('server-cfg-ram')?.value || '4', 10),
        port: parseInt(document.getElementById('server-cfg-port')?.value || '25565', 10),
        onlineMode: document.getElementById('server-cfg-online-mode')?.value === 'true',
        gamemode: document.getElementById('server-cfg-gamemode')?.value || 'survival',
        difficulty: document.getElementById('server-cfg-difficulty')?.value || 'normal',
        pvp: document.getElementById('server-cfg-pvp')?.value === 'true'
      };
      window.api.saveServerConfig(newCfg);
      showToast('Zapisano ustawienia serwera.');
    });
  });

  btnToggle?.addEventListener('click', async () => {
    if (isServerRunning) {
      showToast('Zatrzymywanie serwera Minecraft...');
      try {
        await window.api.stopServer();
      } catch (err) {
        showToast(`Błąd zatrzymywania: ${err.message}`);
      }
    } else {
      showToast('Uruchamianie serwera Minecraft 1.21.11...');
      try {
        const newCfg = {
          ram: parseInt(document.getElementById('server-cfg-ram')?.value || '4', 10),
          port: parseInt(document.getElementById('server-cfg-port')?.value || '25565', 10),
          onlineMode: document.getElementById('server-cfg-online-mode')?.value === 'true',
          gamemode: document.getElementById('server-cfg-gamemode')?.value || 'survival',
          difficulty: document.getElementById('server-cfg-difficulty')?.value || 'normal',
          pvp: document.getElementById('server-cfg-pvp')?.value === 'true'
        };
        await window.api.saveServerConfig(newCfg);
        await window.api.startServer();
      } catch (err) {
        showToast(`Błąd startu serwera: ${err.message}`);
      }
    }
  });

  const sendCommand = async () => {
    const cmd = cmdInput.value.trim();
    if (!cmd) return;
    try {
      await window.api.sendServerCommand(cmd);
      cmdInput.value = '';
    } catch (err) {
      showToast(`Błąd komendy: ${err.message}`);
    }
  };

  btnSend?.addEventListener('click', sendCommand);
  cmdInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendCommand();
  });

  // Events from backend
  window.api.onServerLog((line) => {
    appendServerLog(line);
  });

  window.api.onServerStatus((data) => {
    if (data.status === 'running') {
      showToast('Twój serwer Minecraft 1.21.11 został pomyślnie uruchomiony!');
      updateServerHostUI({ running: true, localIp: data.ip, port: data.port });
    } else if (data.status === 'stopped') {
      showToast('Serwer został zatrzymany.');
      updateServerHostUI({ running: false });
    } else if (data.status === 'downloading' || data.status === 'preparing' || data.status === 'starting') {
      updateServerHostUI({ running: false, starting: true });
      if (data.message) appendServerLog(`[SYSTEM] ${data.message}`);
    } else if (data.status === 'error') {
      updateServerHostUI({ running: false });
      showToast(`Błąd serwera: ${data.message}`);
    }
  });

  window.api.onServerDownloadProgress((data) => {
    const statusText = document.getElementById('server-console-status-text');
    if (statusText) statusText.textContent = `Pobieranie server.jar 1.21.11: ${data.pct}%`;
  });
}

// Run init
window.addEventListener('DOMContentLoaded', initApp);
