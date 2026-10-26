// KasteuszLauncher Renderer Controller
let skinViewer = null;
let pendingSkinUrl = null;
let pendingCapeIdOrUrl = null;
let currentAccount = null;
let currentConfig = null;
let availableVersions = [];
let isGameLaunching = false;
let currentCosmetics = {
  backEquipment: 'cape',
  ears: false,
  halo: false
};
let haloMeshGroup = null;

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
  settingDiscordRpc: document.getElementById('setting-discord-rpc'),
  settingDiscordClientId: document.getElementById('setting-discord-client-id'),
  btnOpenDiscordDev: document.getElementById('btn-open-discord-dev'),
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

  // Wardrobe & Capes
  btnOpenWardrobe: document.getElementById('btn-open-wardrobe'),
  btnRotatePlayer: document.getElementById('btn-rotate-player'),
  heroPlaytimePill: document.getElementById('hero-playtime-pill'),
  heroPlaytimeText: document.getElementById('hero-playtime-text'),
  wardrobeModal: document.getElementById('wardrobe-modal'),
  btnCloseWardrobeModal: document.getElementById('btn-close-wardrobe-modal'),
  tabBtnCapes: document.getElementById('tab-btn-capes'),
  tabBtnSkins: document.getElementById('tab-btn-skins'),
  wardrobeContentCapes: document.getElementById('wardrobe-content-capes'),
  wardrobeContentSkins: document.getElementById('wardrobe-content-skins'),
  capesGrid: document.getElementById('capes-grid'),
  accountCapesContainer: document.getElementById('account-capes-container'),
  btnCustomCapeFile: document.getElementById('btn-custom-cape-file'),
  btnRemoveCape: document.getElementById('btn-remove-cape'),
  btnPresetMcqueen: document.getElementById('btn-preset-mcqueen'),
  btnPresetSteve: document.getElementById('btn-preset-steve'),
  btnPresetAlex: document.getElementById('btn-preset-alex'),
  wardrobeNickInput: document.getElementById('wardrobe-nick-input'),
  btnWardrobeFetchNick: document.getElementById('btn-wardrobe-fetch-nick'),
  btnWardrobeUploadSkin: document.getElementById('btn-wardrobe-upload-skin'),

  // Stats
  profileStatPlaytime: document.getElementById('profile-stat-playtime'),
  profileStatLaunches: document.getElementById('profile-stat-launches'),
  profileStatRank: document.getElementById('profile-stat-rank'),

  // Personalization
  settingAmbientGlow: document.getElementById('setting-ambient-glow'),
  settingAnimSpeed: document.getElementById('setting-anim-speed'),
  settingAnimVal: document.getElementById('setting-anim-val'),

  // Live Wallpapers & UI Sounds
  settingWallpaperOpacity: document.getElementById('setting-wallpaper-opacity'),
  settingWallpaperVal: document.getElementById('setting-wallpaper-val'),
  settingUiSounds: document.getElementById('setting-ui-sounds'),
  settingSoundsVolume: document.getElementById('setting-sounds-volume'),
  settingSoundsVal: document.getElementById('setting-sounds-val'),

  // 3D Cosmetics
  tabBtnCosmetics: document.getElementById('tab-btn-cosmetics'),
  wardrobeContentCosmetics: document.getElementById('wardrobe-content-cosmetics'),
  cosmeticBackCape: document.getElementById('cosmetic-back-cape'),
  cosmeticBackElytra: document.getElementById('cosmetic-back-elytra'),
  cosmeticEarsCard: document.getElementById('cosmetic-ears-card'),
  pillEarsStatus: document.getElementById('pill-ears-status'),
  cosmeticHaloCard: document.getElementById('cosmetic-halo-card'),
  pillHaloStatus: document.getElementById('pill-halo-status'),

  toastContainer: document.getElementById('toast-container')
};

// 1. Initialise App
async function initApp() {
  console.log('[RENDERER] Inicjalizacja KasteuszLauncher...');

  // Rejestracja globalnych dźwięków interfejsu (Web Audio API)
  try {
    window.uiSounds?.attachInteractiveListeners();
  } catch (soundErr) {
    console.error('Błąd attachInteractiveListeners:', soundErr);
  }

  // 1. Rejestracja wszystkich listenerów interfejsu synchronicznie (przyciski, garderoba, obracanie, motywy)
  try {
    setupWindowControls();
    setupNavigation();
    setupWardrobeListeners();
    setupThemesListeners();
    setupSettingsListeners();
    setupModsListeners();
    setupModBrowser();
    setupLauncherEventListeners();
    setupFriendsListeners();
    setupServerHostingListeners();
    setupSpotifyMusicListeners();
  } catch (listenerErr) {
    console.error('Błąd rejestracji listenerów UI:', listenerErr);
  }

  // 2. Inicjalizacja podglądu postaci 3D
  try {
    init3DSkinViewer();
  } catch (viewerErr) {
    console.error('Błąd startu podglądu 3D:', viewerErr);
  }

  // 3. Asynchroniczne ładowanie konfiguracji i danych z izolacją błędów
  try { await loadConfig(); } catch (e) { console.error('Błąd loadConfig:', e); }
  try { await loadAccount(); } catch (e) { console.error('Błąd loadAccount:', e); }
  try { await loadVersions(); } catch (e) { console.error('Błąd loadVersions:', e); }
  try { await loadMods(); } catch (e) { console.error('Błąd loadMods:', e); }
  try { await loadFriends(); } catch (e) { console.error('Błąd loadFriends:', e); }
  try { initOfficialServerWidget(); } catch (e) { console.error('Błąd initOfficialServerWidget:', e); }
  try { await loadServerHosting(); } catch (e) { console.error('Błąd loadServerHosting:', e); }
  try { await loadStats(); } catch (e) { console.error('Błąd loadStats:', e); }
  try { await checkSpotifyStatus(); } catch (e) { console.error('Błąd checkSpotifyStatus:', e); }

  // 4. Automatyczne otwieranie okna logowania jeśli użytkownik nie jest jeszcze zalogowany
  if (!currentAccount) {
    setTimeout(() => {
      openLoginModal();
    }, 400);
  }
}

// Window control buttons
function setupWindowControls() {
  elements.btnWinMinimize?.addEventListener('click', () => window.api.minimizeWindow());
  const btnWinMaximize = document.getElementById('btn-win-maximize');
  btnWinMaximize?.addEventListener('click', () => window.api.maximizeWindow());
  elements.btnWinClose?.addEventListener('click', () => window.api.closeWindow());
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

      // Cape natural billowing animation in wind
      if (player.cape && player.cape.visible) {
        player.cape.rotation.x = 0.20 + 0.08 * Math.sin(t * 1.3);
        player.cape.rotation.z = 0.03 * Math.cos(t * 0.9);
      }

      // Elytra wings subtle flight flutter when equipped
      if (player.elytra && (player.backEquipment === 'elytra' || player.elytra.visible)) {
        player.elytra.leftWing.rotation.x = 0.32 + 0.05 * Math.cos(t * 1.2);
        player.elytra.leftWing.rotation.z = 0.30 + 0.10 * Math.sin(t * 1.4);
        if (typeof player.elytra.updateRightWing === 'function') {
          player.elytra.updateRightWing();
        }
      }

      // Floating gold halo hovering above head
      const halo = player.skin?.head?.getObjectByName('playerHalo');
      if (halo) {
        halo.position.y = 7.2 + 0.35 * Math.sin(t * 1.5);
        halo.rotation.y = 0.12 * Math.sin(t * 0.8);
      }
    }
  };
}

function init3DSkinViewer() {
  if (skinViewer) return;
  if (!window.skinview3d) {
    console.warn('Biblioteka skinview3d nie załadowana.');
    return;
  }

  const container = elements.skinContainer || document.getElementById('skin-container');
  const canvas = elements.skinCanvas || document.getElementById('skin-canvas');
  if (!canvas) return;

  const width = (container && container.clientWidth > 50) ? container.clientWidth : 400;
  const height = (container && container.clientHeight > 50) ? container.clientHeight : 450;

  try {
    skinViewer = new window.skinview3d.SkinViewer({
      canvas: canvas,
      width: width,
      height: height,
      alpha: true
    });

    // Ustawienie przezroczystości WebGL, by motyw i poświata tła (Ambient Glow) były w 100% widoczne!
    if (skinViewer.renderer) {
      skinViewer.renderer.setClearColor(0x000000, 0);
    }
    if (skinViewer.fxaaPass) {
      skinViewer.fxaaPass.enabled = false;
    }
    if (skinViewer.renderPass) {
      skinViewer.renderPass.renderToScreen = true;
    }

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
    const targetObj = skinViewer.playerWrapper || skinViewer.playerObject;
    if (targetObj) {
      targetObj.rotation.y = isPlayerFlipped ? 2.72 : -0.42;
      targetObj.position.y = -2;
    }

    // Lighting with vibrant Minecraft colors matching screenshot
    if (skinViewer.globalLight) {
      skinViewer.globalLight.intensity = 1.05;
    }
    if (skinViewer.cameraLight) {
      skinViewer.cameraLight.intensity = 1.75;
    }

    window.addEventListener('resize', handleViewerResize);
    setTimeout(handleViewerResize, 100);
    setTimeout(handleViewerResize, 350);

    // Apply any pending cape
    if (pendingCapeIdOrUrl) {
      applyCape(pendingCapeIdOrUrl, false);
      pendingCapeIdOrUrl = null;
    }

    // Apply any pending or current skin
    const skinToLoad = pendingSkinUrl || 'assets/default-skin.png';
    pendingSkinUrl = null;
    updateSkinDisplay(skinToLoad);

    // Apply cosmetics
    if (currentCosmetics.backEquipment && skinViewer.playerObject) {
      skinViewer.playerObject.backEquipment = currentCosmetics.backEquipment;
    }
    if (currentCosmetics.ears) {
      applyEars(true, false);
    }
    if (currentCosmetics.halo) {
      applyHalo(true, false);
    }
  } catch (err) {
    console.error('Błąd inicjalizacji podglądu 3D:', err);
  }
}

function handleViewerResize() {
  const container = elements.skinContainer || document.getElementById('skin-container');
  if (!skinViewer || !container) return;
  const width = container.clientWidth;
  const height = container.clientHeight;
  if (width > 50 && height > 50) {
    skinViewer.width = width;
    skinViewer.height = height;
  }
}

function updateSkinDisplay(skinUrl) {
  let target = skinUrl || 'assets/default-skin.png';
  if (typeof target === 'string' && target.startsWith('http://')) {
    target = target.replace('http://', 'https://');
  }

  if (!skinViewer) {
    pendingSkinUrl = target;
    init3DSkinViewer();
    return;
  }

  try {
    skinViewer.loadSkin(target).then(() => {
      if (skinViewer.playerObject?.skin) {
        skinViewer.playerObject.skin.visible = true;
      }
    }).catch(err => {
      console.warn('Błąd ładowania skórki, używam fallbacku:', err);
      if (target !== 'assets/default-skin.png') {
        skinViewer.loadSkin('assets/default-skin.png').then(() => {
          if (skinViewer.playerObject?.skin) {
            skinViewer.playerObject.skin.visible = true;
          }
        }).catch(fallbackErr => {
          console.warn('Fallback skórki nie powiódł się:', fallbackErr);
        });
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

    // Discord RPC
    if (elements.settingDiscordRpc) {
      elements.settingDiscordRpc.checked = currentConfig.discordRpcEnabled !== false;
    }
    if (elements.settingDiscordClientId) {
      elements.settingDiscordClientId.value = currentConfig.discordClientId || '';
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

    // Themes & Personalization
    const theme = currentConfig.themeAccent || 'purple';
    applyTheme(theme, false);

    if (elements.settingAmbientGlow) {
      elements.settingAmbientGlow.checked = currentConfig.ambientGlow !== false;
      const glowEl = document.querySelector('.hero-ambient-glow');
      if (glowEl) glowEl.style.display = currentConfig.ambientGlow !== false ? 'block' : 'none';
    }

    if (elements.settingAnimSpeed) {
      const speed = currentConfig.animationSpeed || 0.6;
      elements.settingAnimSpeed.value = Math.round(speed * 100);
      if (elements.settingAnimVal) elements.settingAnimVal.textContent = `${speed.toFixed(1)}x`;
      if (skinViewer?.animation) skinViewer.animation.speed = speed;
    }

    // Live Wallpapers
    const savedWallpaper = currentConfig.liveWallpaper || 'matrix';
    const savedOpacity = (currentConfig.wallpaperOpacity !== undefined) ? currentConfig.wallpaperOpacity : 0.6;
    window.liveWallpapers?.init(savedWallpaper, savedOpacity);
    document.querySelectorAll('.wallpaper-opt-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === savedWallpaper);
    });
    if (elements.settingWallpaperOpacity) {
      elements.settingWallpaperOpacity.value = Math.round(savedOpacity * 100);
    }
    if (elements.settingWallpaperVal) {
      elements.settingWallpaperVal.textContent = `${Math.round(savedOpacity * 100)}%`;
    }

    // UI Sounds
    const soundsEnabled = currentConfig.uiSoundsEnabled !== false;
    const soundsVolume = (currentConfig.uiSoundsVolume !== undefined) ? currentConfig.uiSoundsVolume : 0.4;
    window.uiSounds?.init(soundsEnabled, soundsVolume);
    if (elements.settingUiSounds) {
      elements.settingUiSounds.checked = soundsEnabled;
    }
    if (elements.settingSoundsVolume) {
      elements.settingSoundsVolume.value = Math.round(soundsVolume * 100);
    }
    if (elements.settingSoundsVal) {
      elements.settingSoundsVal.textContent = `${Math.round(soundsVolume * 100)}%`;
    }

    // Music Player
    const musicStation = currentConfig.musicPlayerStation || 'lofi';
    const musicVolume = (currentConfig.musicPlayerVolume !== undefined) ? currentConfig.musicPlayerVolume : 0.35;
    window.musicPlayer?.init(musicStation, musicVolume);

    // 3D Cosmetics
    if (currentConfig.cosmetics) {
      currentCosmetics = {
        backEquipment: currentConfig.cosmetics.backEquipment || 'cape',
        ears: !!currentConfig.cosmetics.ears,
        halo: !!currentConfig.cosmetics.halo
      };
    }
    updateCosmeticsUI();

    // Selected Cape (default to none so no unwanted cape is forced)
    const savedCape = currentConfig.selectedCape || 'none';
    setTimeout(() => {
      applyCape(savedCape, false);
    }, 250);
  } catch (err) {
    console.error('Błąd ładowania konfiguracji:', err);
  }
}

function setupSettingsListeners() {
  // Live Wallpapers Settings
  document.querySelectorAll('.wallpaper-opt-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wallpaper-opt-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const style = btn.dataset.style;
      window.liveWallpapers?.setStyle(style);
      window.api.saveConfig({ liveWallpaper: style });
      showToast(`Zmieniono tło: ${btn.textContent.trim()}`);
    });
  });

  elements.settingWallpaperOpacity?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (elements.settingWallpaperVal) elements.settingWallpaperVal.textContent = `${val}%`;
    window.liveWallpapers?.setOpacity(val / 100);
    window.api.saveConfig({ wallpaperOpacity: val / 100 });
  });

  // UI Sounds Settings
  elements.settingUiSounds?.addEventListener('change', (e) => {
    window.uiSounds?.setEnabled(e.target.checked);
    window.api.saveConfig({ uiSoundsEnabled: e.target.checked });
    showToast(e.target.checked ? '🔊 Włączono dźwięki interfejsu' : 'Wyciszono dźwięki interfejsu');
  });

  elements.settingSoundsVolume?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (elements.settingSoundsVal) elements.settingSoundsVal.textContent = `${val}%`;
    window.uiSounds?.setVolume(val / 100);
    window.api.saveConfig({ uiSoundsVolume: val / 100 });
  });

  // FPS Boost Toggle
  elements.settingFpsBoost?.addEventListener('change', (e) => {
    window.api.saveConfig({ fpsBoostMode: e.target.checked });
    showToast(e.target.checked ? '⚡ Włączono tryb FPS Boost!' : 'Wyłączono tryb FPS Boost');
  });

  // Optimize Options Toggle
  elements.settingOptimizeOptions?.addEventListener('change', (e) => {
    window.api.saveConfig({ optimizeGameOptions: e.target.checked });
  });

  // Discord RPC Settings
  elements.settingDiscordRpc?.addEventListener('change', (e) => {
    window.api.saveConfig({ discordRpcEnabled: e.target.checked });
    showToast(e.target.checked ? '👾 Włączono Discord RPC!' : 'Wyłączono Discord RPC.');
  });

  elements.settingDiscordClientId?.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    window.api.saveConfig({ discordClientId: val });
    showToast(val ? 'Zaktualizowano Client ID dla Discord RPC!' : 'Wyczyszczono Client ID.');
  });

  elements.btnOpenDiscordDev?.addEventListener('click', () => {
    window.api.openExternal('https://discord.com/developers/applications');
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

    // Prioritize custom skin (e.g. Zygzak McQueen #95) over generic Mojang skin
    let skinToUse = account.customSkinUrl || account.skinUrl || 'assets/default-skin.png';

    if (skinToUse) {
      updateSkinDisplay(skinToUse);
      if (elements.userAvatarHead) elements.userAvatarHead.src = `https://mc-heads.net/avatar/${encodeURIComponent(account.username)}/32`;
    } else {
      updateSkinDisplay('assets/default-skin.png');
      if (elements.userAvatarHead) elements.userAvatarHead.src = 'assets/default-skin.png';
    }

    renderAccountCapes(account);
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
    closeWardrobeModal();
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

  try {
    window.uiSounds?.playLaunch();
  } catch (_) {}

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
    try {
      window.liveWallpapers?.pause(true);
      window.musicPlayer?.onGameLaunch();
    } catch (_) {}
    // FPS Boost: wyłączamy animację 3D dla 0% obciążenia GPU podczas grania
    if (skinViewer) {
      skinViewer.animation = null;
    }
  });

  window.api.onLauncherClosed((data) => {
    setLaunchingState(false);
    showToast(`Gra została zamknięta (kod: ${data.code}).`);
    appendLog(`[KasteuszLauncher] Proces gry zakończony z kodem ${data.code}.`);
    try {
      window.liveWallpapers?.pause(false);
      window.musicPlayer?.onGameClose();
    } catch (_) {}
    // Wznawiamy animację 3D po wyjściu z gry
    if (skinViewer && window.skinview3d) {
      const StanceAnim = createStanceAnimationClass();
      if (StanceAnim) {
        skinViewer.animation = new StanceAnim();
        skinViewer.animation.speed = currentConfig?.animationSpeed || 0.6;
      }
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
  try {
    window.uiSounds?.playToast();
  } catch (_) {}
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


// ========================================================
// FEATURE 4: WARDROBE & CAPES
// ========================================================
const BUILTIN_CAPES = {
  kasteusz: { name: "Kasteusz Studio", url: "assets/capes/kasteusz.png" },
  mcqueen95: { name: "Zygzak McQueen #95", url: "assets/capes/mcqueen95.png" },
  szkolnesmp: { name: "Szkolne SMP", url: "assets/capes/szkolnesmp.png" },
  fire_dragon: { name: "Ognisty Płomień", url: "assets/capes/fire_dragon.png" }
};

let currentCapeId = "kasteusz";
let isPlayerFlipped = false;

function openWardrobeModal() {
  const modal = elements.wardrobeModal || document.getElementById('wardrobe-modal');
  if (modal) modal.classList.add("open");
}

function closeWardrobeModal() {
  const modal = elements.wardrobeModal || document.getElementById('wardrobe-modal');
  if (modal) modal.classList.remove("open");
}

function applyCape(capeIdOrUrl, save = true) {
  currentCapeId = capeIdOrUrl;

  document.querySelectorAll(".cape-item-card").forEach(card => {
    card.classList.toggle("active", card.dataset.capeId === capeIdOrUrl);
  });

  if (!skinViewer) {
    pendingCapeIdOrUrl = capeIdOrUrl;
    if (save) window.api.saveConfig({ selectedCape: capeIdOrUrl || "none" });
    return;
  }

  if (capeIdOrUrl === "none" || !capeIdOrUrl) {
    skinViewer.loadCape(null);
    if (skinViewer.playerObject?.cape) skinViewer.playerObject.cape.visible = false;
    if (skinViewer.playerObject?.elytra) skinViewer.playerObject.elytra.visible = false;
    if (save) window.api.saveConfig({ selectedCape: "none" });
    return;
  }

  const capeEntry = BUILTIN_CAPES[capeIdOrUrl];
  let urlToLoad = capeEntry ? capeEntry.url : capeIdOrUrl;
  if (urlToLoad && typeof urlToLoad === 'string' && urlToLoad.startsWith('http://')) {
    urlToLoad = urlToLoad.replace('http://', 'https://');
  }

  try {
    skinViewer.loadCape(urlToLoad).then(() => {
      if (skinViewer.playerObject) {
        skinViewer.playerObject.backEquipment = currentCosmetics.backEquipment || 'cape';
      }
    }).catch(err => {
      console.warn("Błąd ładowania pelerynki:", err);
    });
    if (save) window.api.saveConfig({ selectedCape: capeIdOrUrl });
  } catch (err) {
    console.warn("Wyjątek ładowania pelerynki:", err);
  }
}

// 3D Cosmetics Logic: Back Equipment (Cape/Elytra), Ears, and Floating Halo
function applyBackEquipment(type, save = true) {
  currentCosmetics.backEquipment = type;
  if (skinViewer?.playerObject) {
    skinViewer.playerObject.backEquipment = type;
  }
  updateCosmeticsUI();
  if (save) {
    window.api.saveConfig({ cosmetics: currentCosmetics });
  }
}

function applyEars(enabled, save = true) {
  currentCosmetics.ears = !!enabled;
  if (skinViewer) {
    if (currentCosmetics.ears) {
      const skinUrl = currentAccount?.customSkinUrl || currentAccount?.skinUrl || 'assets/default-skin.png';
      try {
        skinViewer.loadEars(skinUrl, { textureType: 'skin' });
      } catch (e) {
        console.warn('Błąd ładowania uszu:', e);
      }
    } else {
      try {
        skinViewer.resetEars();
      } catch (e) {
        console.warn('Błąd resetu uszu:', e);
      }
    }
  }
  updateCosmeticsUI();
  if (save) {
    window.api.saveConfig({ cosmetics: currentCosmetics });
  }
}

function applyHalo(enabled, save = true) {
  currentCosmetics.halo = !!enabled;
  if (skinViewer?.playerObject?.skin?.head) {
    const head = skinViewer.playerObject.skin.head;
    const existing = head.getObjectByName('playerHalo');
    if (existing) {
      head.remove(existing);
      existing.traverse?.(child => {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      });
    }

    if (currentCosmetics.halo) {
      const anyMesh = head.children.find(c => c.isMesh);
      if (anyMesh) {
        const MeshConstructor = anyMesh.constructor;
        const BoxGeoConstructor = anyMesh.geometry.constructor;
        const MatConstructor = anyMesh.material.constructor;
        const GroupConstructor = head.constructor;

        const haloGroup = new GroupConstructor();
        haloGroup.name = 'playerHalo';

        const haloMat = new MatConstructor({
          color: 0xffd700,
          emissive: 0xffaa00,
          emissiveIntensity: 0.9,
          roughness: 0.2,
          metalness: 0.85
        });

        const barThickness = 1.0;
        const ringSize = 9.5;

        const barGeoFB = new BoxGeoConstructor(ringSize, barThickness, barThickness);
        const barGeoLR = new BoxGeoConstructor(barThickness, barThickness, ringSize - barThickness * 2);

        const frontBar = new MeshConstructor(barGeoFB, haloMat);
        frontBar.position.set(0, 0, ringSize / 2 - barThickness / 2);

        const backBar = new MeshConstructor(barGeoFB, haloMat);
        backBar.position.set(0, 0, -ringSize / 2 + barThickness / 2);

        const leftBar = new MeshConstructor(barGeoLR, haloMat);
        leftBar.position.set(-ringSize / 2 + barThickness / 2, 0, 0);

        const rightBar = new MeshConstructor(barGeoLR, haloMat);
        rightBar.position.set(ringSize / 2 - barThickness / 2, 0, 0);

        haloGroup.add(frontBar);
        haloGroup.add(backBar);
        haloGroup.add(leftBar);
        haloGroup.add(rightBar);

        haloGroup.position.set(0, 7.2, 0);
        haloGroup.rotation.x = -0.15;
        haloGroup.rotation.z = 0.05;

        head.add(haloGroup);
      }
    }
  }
  updateCosmeticsUI();
  if (save) {
    window.api.saveConfig({ cosmetics: currentCosmetics });
  }
}

function updateCosmeticsUI() {
  const cardCape = document.getElementById('cosmetic-back-cape');
  const cardElytra = document.getElementById('cosmetic-back-elytra');
  const cardEars = document.getElementById('cosmetic-ears-card');
  const cardHalo = document.getElementById('cosmetic-halo-card');
  const pillEars = document.getElementById('pill-ears-status');
  const pillHalo = document.getElementById('pill-halo-status');

  if (cardCape && cardElytra) {
    const isElytra = currentCosmetics.backEquipment === 'elytra';
    cardCape.classList.toggle('active', !isElytra);
    cardElytra.classList.toggle('active', isElytra);
    const pillCape = cardCape.querySelector('.cosmetic-status-pill');
    const pillEly = cardElytra.querySelector('.cosmetic-status-pill');
    if (pillCape) pillCape.textContent = !isElytra ? 'Aktywna' : 'Wybierz';
    if (pillEly) pillEly.textContent = isElytra ? 'Aktywne' : 'Wybierz';
  }

  if (cardEars && pillEars) {
    cardEars.classList.toggle('active', !!currentCosmetics.ears);
    pillEars.textContent = currentCosmetics.ears ? 'Aktywne' : 'Wyłączone';
  }

  if (cardHalo && pillHalo) {
    cardHalo.classList.toggle('active', !!currentCosmetics.halo);
    pillHalo.textContent = currentCosmetics.halo ? 'Aktywna' : 'Wyłączone';
  }
}

function renderCapeCanvasPreview(wrapperEl, capeSrc) {
  if (!wrapperEl || !capeSrc) return;
  const canvas = document.createElement("canvas");
  canvas.width = 44;
  canvas.height = 70;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.imageRendering = "pixelated";
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    const scale = img.width / 64;
    ctx.drawImage(img, 12 * scale, 1 * scale, 10 * scale, 16 * scale, 0, 0, 44, 70);
  };
  img.src = capeSrc;
  wrapperEl.innerHTML = "";
  wrapperEl.appendChild(canvas);
}

function renderAccountCapes(account) {
  const container = elements.accountCapesContainer;
  if (!container) return;
  container.innerHTML = "";

  if (!account || !Array.isArray(account.capes) || account.capes.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; font-size: 12px; color: var(--text-dim); text-align: center; padding: 12px;">Brak dodatkowych pelerynek na koncie Minecraft.</div>';
    return;
  }

  account.capes.forEach((c) => {
    const capeUrl = (c.url || '').replace('http://', 'https://');
    const card = document.createElement("div");
    card.className = "cape-item-card";
    card.dataset.capeId = capeUrl;

    const preview = document.createElement("div");
    preview.className = "cape-preview-wrapper";
    renderCapeCanvasPreview(preview, capeUrl);

    const info = document.createElement("div");
    info.className = "cape-item-info";
    info.innerHTML = `
      <span class="cape-item-title">${c.alias || "Pelerynka"}</span>
      <span class="cape-item-badge blue">Oficjalna</span>
    `;

    card.appendChild(preview);
    card.appendChild(info);

    card.addEventListener("click", () => {
      applyCape(capeUrl, true);
      showToast(`Założono Twoją oficjalną pelerynkę: ${c.alias || "Mojang"}!`);
    });

    if (currentCapeId === capeUrl) card.classList.add("active");
    container.appendChild(card);
  });
}

function setupWardrobeListeners() {
  // Render canvas previews for built-in capes
  document.querySelectorAll(".cape-item-card[data-cape-id]").forEach(card => {
    const id = card.dataset.capeId;
    const cape = BUILTIN_CAPES[id];
    if (cape) {
      const preview = card.querySelector(".cape-preview-wrapper");
      if (preview) renderCapeCanvasPreview(preview, cape.url);
    }
  });

  const btnWardrobe = elements.btnOpenWardrobe || document.getElementById('btn-open-wardrobe');
  btnWardrobe?.addEventListener("click", openWardrobeModal);

  const btnCloseModal = elements.btnCloseWardrobeModal || document.getElementById('btn-close-wardrobe-modal');
  btnCloseModal?.addEventListener("click", closeWardrobeModal);

  const wardrobeModal = elements.wardrobeModal || document.getElementById('wardrobe-modal');
  wardrobeModal?.addEventListener("click", (e) => {
    if (e.target === wardrobeModal) closeWardrobeModal();
  });

  // Rotate player 180 deg to inspect cape/skin
  const btnRotate = elements.btnRotatePlayer || document.getElementById('btn-rotate-player');
  btnRotate?.addEventListener("click", () => {
    if (!skinViewer) {
      init3DSkinViewer();
      if (!skinViewer) return;
    }
    isPlayerFlipped = !isPlayerFlipped;
    const targetObj = skinViewer.playerWrapper || skinViewer.playerObject;
    if (targetObj) {
      targetObj.rotation.y = isPlayerFlipped ? 2.72 : -0.42;
    }
    btnRotate.classList.toggle("active", isPlayerFlipped);
  });

  // Wardrobe tabs (Capes vs Skins vs Cosmetics)
  const tabBtnCapes = elements.tabBtnCapes || document.getElementById('tab-btn-capes');
  const tabBtnSkins = elements.tabBtnSkins || document.getElementById('tab-btn-skins');
  const tabBtnCosmetics = elements.tabBtnCosmetics || document.getElementById('tab-btn-cosmetics');
  const contentCapes = elements.wardrobeContentCapes || document.getElementById('wardrobe-content-capes');
  const contentSkins = elements.wardrobeContentSkins || document.getElementById('wardrobe-content-skins');
  const contentCosmetics = elements.wardrobeContentCosmetics || document.getElementById('wardrobe-content-cosmetics');

  function switchWardrobeTab(tab) {
    [tabBtnCapes, tabBtnSkins, tabBtnCosmetics].forEach(b => b?.classList.remove('active'));
    [contentCapes, contentSkins, contentCosmetics].forEach(c => c?.classList.remove('active'));

    if (tab === 'capes') {
      tabBtnCapes?.classList.add('active');
      contentCapes?.classList.add('active');
    } else if (tab === 'skins') {
      tabBtnSkins?.classList.add('active');
      contentSkins?.classList.add('active');
    } else if (tab === 'cosmetics') {
      tabBtnCosmetics?.classList.add('active');
      contentCosmetics?.classList.add('active');
    }
  }

  tabBtnCapes?.addEventListener('click', () => switchWardrobeTab('capes'));
  tabBtnSkins?.addEventListener('click', () => switchWardrobeTab('skins'));
  tabBtnCosmetics?.addEventListener('click', () => switchWardrobeTab('cosmetics'));

  // 3D Cosmetics Selection Handlers
  document.getElementById('cosmetic-back-cape')?.addEventListener('click', () => {
    applyBackEquipment('cape', true);
    showToast('Wyposażono klasyczną pelerynkę!');
  });

  document.getElementById('cosmetic-back-elytra')?.addEventListener('click', () => {
    applyBackEquipment('elytra', true);
    showToast('Wyposażono skrzydła Elytra z Twoją pelerynką!');
  });

  document.getElementById('cosmetic-ears-card')?.addEventListener('click', () => {
    const newState = !currentCosmetics.ears;
    applyEars(newState, true);
    showToast(newState ? 'Włączono uszy Deadmau5!' : 'Zdjęto uszy Deadmau5.');
  });

  document.getElementById('cosmetic-halo-card')?.addEventListener('click', () => {
    const newState = !currentCosmetics.halo;
    applyHalo(newState, true);
    showToast(newState ? 'Aktywowano złotą Aureolę Światła!' : 'Zdjęto Aureolę.');
  });

  // Built-in cape selection
  document.querySelectorAll("#capes-grid .cape-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.capeId;
      applyCape(id, true);
      const name = BUILTIN_CAPES[id]?.name || "Pelerynka";
      showToast(`Założono pelerynkę: ${name}!`);
    });
  });

  // Custom cape file upload (.png)
  elements.btnCustomCapeFile?.addEventListener("click", async () => {
    try {
      const dataUrl = await window.api.selectCapeFile();
      if (dataUrl) {
        applyCape(dataUrl, true);
        showToast("Własna pelerynka została pomyślnie załadowana!");
      }
    } catch (err) {
      showToast(`Błąd ładowania pelerynki: ${err.message}`);
    }
  });

  // Remove cape
  elements.btnRemoveCape?.addEventListener("click", () => {
    applyCape("none", true);
    showToast("Pelerynka została zdjęta.");
  });

  // Preset Skins
  elements.btnPresetMcqueen?.addEventListener("click", async () => {
    updateSkinDisplay("assets/default-skin.png");
    try {
      await window.api.setCustomSkin("assets/default-skin.png");
    } catch (e) {}
    showToast("Założono skin: Zygzak McQueen #95!");
  });

  elements.btnPresetSteve?.addEventListener("click", async () => {
    const url = "https://textures.minecraft.net/texture/1a406e897914457613d760ab577a34d35388b73d263f9d4ca4570b5f816b3fb9";
    updateSkinDisplay(url);
    try {
      await window.api.setCustomSkin(url);
    } catch (e) {}
    showToast("Założono skin: Steve!");
  });

  elements.btnPresetAlex?.addEventListener("click", async () => {
    const url = "https://textures.minecraft.net/texture/e5585b88c7dd884ec71b83d693eeab61a5867ff4691bc9dbb2eb5420a32194b6";
    updateSkinDisplay(url);
    try {
      await window.api.setCustomSkin(url);
    } catch (e) {}
    showToast("Założono skin: Alex!");
  });

  // Fetch skin by nickname
  elements.btnWardrobeFetchNick?.addEventListener("click", async () => {
    const nick = elements.wardrobeNickInput?.value.trim();
    if (!nick) return;
    try {
      const url = await window.api.getSkinUrl(nick);
      if (url) {
        updateSkinDisplay(url);
        await window.api.setCustomSkin(url);
        showToast(`Pobrano skórkę dla gracza ${nick}!`);
      }
    } catch (err) {
      showToast(`Błąd pobierania skórki: ${err.message}`);
    }
  });

  // Upload skin file
  elements.btnWardrobeUploadSkin?.addEventListener("click", async () => {
    try {
      const newSkinUrl = await window.api.selectSkinFile();
      if (newSkinUrl) {
        updateSkinDisplay(newSkinUrl);
        await window.api.setCustomSkin(newSkinUrl);
        showToast("Załadowano własną skórkę z pliku!");
      }
    } catch (err) {
      showToast(`Błąd ładowania skórki: ${err.message}`);
    }
  });
}

// ========================================================
// FEATURE 5: PLAYER STATS & PLAYTIME
// ========================================================
function formatPlaytime(totalMinutes) {
  const m = Math.max(0, parseInt(totalMinutes, 10) || 0);
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return `${hours}h ${mins}m`;
}

function updateStatsUI(statsData) {
  if (!statsData) return;
  const timeFormatted = formatPlaytime(statsData.totalPlaytimeMinutes);

  if (elements.heroPlaytimeText) {
    elements.heroPlaytimeText.textContent = `Czas: ${timeFormatted}`;
  }

  if (elements.profileStatPlaytime) {
    elements.profileStatPlaytime.textContent = timeFormatted;
  }

  if (elements.profileStatLaunches) {
    elements.profileStatLaunches.textContent = statsData.totalLaunches || 0;
  }

  if (elements.profileStatRank) {
    elements.profileStatRank.textContent = statsData.rankTitle || "Zygzak #95 ⚡";
  }
}

async function loadStats() {
  try {
    const s = await window.api.getStats();
    updateStatsUI(s);

    window.api.onStatsUpdated((updated) => {
      updateStatsUI(updated);
    });
  } catch (err) {
    console.warn("Błąd pobierania statystyk:", err);
  }
}

// ========================================================
// FEATURE 7: THEMES & PERSONALIZATION
// ========================================================
const THEME_NAMES = {
  purple: "Kasteusz Purple",
  red: "McQueen #95 Red",
  emerald: "Szkolne SMP",
  cyan: "Cyber Cyan",
  gold: "Złoto Kasteusza",
  ruby: "Krwawy Rubin"
};

function applyTheme(themeName, save = true) {
  const allowed = ["purple", "red", "emerald", "cyan", "gold", "ruby"];
  const theme = allowed.includes(themeName) ? themeName : "purple";

  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);

  document.querySelectorAll(".theme-card").forEach(card => {
    card.classList.toggle("active", card.dataset.theme === theme);
  });

  const logoEl = document.querySelector(".logo-icon");
  if (logoEl) {
    logoEl.style.filter = "drop-shadow(0 0 10px var(--accent-glow))";
  }

  // Active pill highlight
  const activeNav = document.querySelector(".nav-pill.active");
  if (activeNav) {
    activeNav.style.borderColor = "var(--accent-primary)";
    activeNav.style.boxShadow = "0 0 14px var(--accent-glow)";
  }

  try {
    window.liveWallpapers?.updateThemeColors();
  } catch (_) {}

  if (save) {
    window.api.saveConfig({ themeAccent: theme });
    showToast(`Aktywowano motyw: ${THEME_NAMES[theme] || theme}!`);
  }
}

function setupThemesListeners() {
  document.querySelectorAll(".theme-card").forEach(card => {
    card.addEventListener("click", () => {
      const theme = card.dataset.theme;
      applyTheme(theme, true);
    });
  });

  elements.settingAmbientGlow?.addEventListener("change", (e) => {
    const glowEl = document.querySelector(".hero-ambient-glow");
    if (glowEl) glowEl.style.display = e.target.checked ? "block" : "none";
    window.api.saveConfig({ ambientGlow: e.target.checked });
  });

  elements.settingAnimSpeed?.addEventListener("input", (e) => {
    const rawVal = parseInt(e.target.value, 10);
    const speed = rawVal / 100;
    if (elements.settingAnimVal) elements.settingAnimVal.textContent = `${speed.toFixed(1)}x`;
    if (skinViewer?.animation) {
      skinViewer.animation.speed = speed;
    }
  });

  elements.settingAnimSpeed?.addEventListener("change", (e) => {
    const speed = parseInt(e.target.value, 10) / 100;
    window.api.saveConfig({ animationSpeed: speed });
  });
}


// ==========================================================================
// SPOTIFY & MUSIC HUB INTEGRATION
// ==========================================================================
let spotifyUser = null;
let spotifyPlaylists = [];
let currentSpotifyPlaylistId = null;

function openMusicModal() {
  const modal = document.getElementById('music-modal');
  if (modal) {
    modal.classList.add('open');
    checkSpotifyStatus();
  }
}

function closeMusicModal() {
  const modal = document.getElementById('music-modal');
  if (modal) modal.classList.remove('open');
}

async function checkSpotifyStatus() {
  if (!window.api?.spotifyGetStatus) return;
  try {
    const status = await window.api.spotifyGetStatus();
    updateSpotifyUI(status);
    if (status && status.isLoggedIn) {
      loadSpotifyPlaylists();
    }
  } catch (err) {
    console.warn('[Spotify] Błąd sprawdzania statusu:', err);
  }
}

function updateSpotifyUI(status) {
  const cardDisconnected = document.getElementById('spotify-card-disconnected');
  const cardConnected = document.getElementById('spotify-card-connected');
  const avatarEl = document.getElementById('spotify-user-avatar');
  const nameEl = document.getElementById('spotify-user-name');
  const planEl = document.getElementById('spotify-user-plan');

  if (status && status.isLoggedIn && status.user) {
    spotifyUser = status.user;
    if (cardDisconnected) cardDisconnected.style.display = 'none';
    if (cardConnected) cardConnected.style.display = 'flex';
    if (avatarEl && status.user.avatar) avatarEl.src = status.user.avatar;
    if (nameEl) nameEl.textContent = status.user.displayName || 'Użytkownik Spotify';
    if (planEl) planEl.textContent = `Konto Spotify (${status.user.product === 'premium' ? 'Premium ⚡' : 'Free'})`;
  } else {
    spotifyUser = null;
    if (cardDisconnected) cardDisconnected.style.display = 'flex';
    if (cardConnected) cardConnected.style.display = 'none';
  }
}

async function loadSpotifyPlaylists() {
  const grid = document.getElementById('spotify-playlists-grid');
  const countLabel = document.getElementById('spotify-playlists-count-label');
  if (!grid) return;

  grid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 12px; grid-column: 1 / -1;">Pobieranie Twoich playlist ze Spotify...</div>';

  try {
    const playlists = await window.api.spotifyGetPlaylists();
    spotifyPlaylists = playlists || [];
    if (countLabel) countLabel.textContent = `${spotifyPlaylists.length} playlist`;

    if (spotifyPlaylists.length === 0) {
      grid.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim); font-size: 12px; grid-column: 1 / -1;">Brak playlist na Twoim koncie Spotify. Utwórz playlistę w Spotify lub wklej jej link poniżej.</div>';
      return;
    }

    grid.innerHTML = '';
    spotifyPlaylists.forEach(pl => {
      const card = document.createElement('div');
      card.className = `spotify-playlist-card ${currentSpotifyPlaylistId === pl.id ? 'active' : ''}`;
      card.innerHTML = `
        <img src="${pl.image || 'assets/icon-256.png'}" class="spotify-playlist-img" alt="${pl.name}" onerror="this.src='assets/icon-256.png'">
        <div class="spotify-playlist-details">
          <span class="spotify-playlist-name" title="${pl.name}">${pl.name}</span>
          <span class="spotify-playlist-count">${pl.tracksCount} utworów</span>
        </div>
      `;

      card.addEventListener('click', () => {
        playSpotifyPlaylist(pl);
      });

      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div style="padding: 20px; text-align: center; color: #f87171; font-size: 12px; grid-column: 1 / -1;">Błąd: ${err.message}</div>`;
  }
}

async function syncMprisStatus() {
  if (!window.api?.spotifyGetMprisStatus) return;
  try {
    const data = await window.api.spotifyGetMprisStatus();

    const titleEl = document.getElementById('spotify-now-playing-title');
    const artistEl = document.getElementById('spotify-now-playing-artist');
    const artEl = document.getElementById('spotify-now-playing-art');
    const playBtn = document.getElementById('btn-spotify-modal-play');
    const badgeText = document.getElementById('spotify-playback-badge-text');

    const footerTitle = document.getElementById('music-title');
    const footerGenre = document.getElementById('music-genre');
    const footerToggle = document.getElementById('btn-music-toggle');
    const visualizer = document.getElementById('music-visualizer');

    if (data && data.running && data.title) {
      if (titleEl) titleEl.textContent = data.title;
      if (artistEl) artistEl.textContent = data.artist || (data.album ? `Album: ${data.album}` : 'Spotify Desktop');
      if (artEl && data.artUrl) {
        artEl.src = data.artUrl;
      }
      const isPlaying = (data.status === 'Playing');
      if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
      if (badgeText) badgeText.textContent = isPlaying ? 'Spotify Desktop • Odtwarzanie w tle w Minecraft' : 'Spotify Desktop • Wstrzymano';

      // Zaktualizuj dolny pasek odtwarzacza, jeśli nie gra radio
      if (window.musicPlayer && !window.musicPlayer.isRadioPlaying?.()) {
        if (footerTitle) footerTitle.textContent = data.title;
        if (footerGenre) footerGenre.textContent = `🟢 Spotify • ${data.artist || 'Desktop'}`;
        if (footerToggle) {
          footerToggle.innerHTML = isPlaying ? '⏸' : '▶';
          footerToggle.title = isPlaying ? 'Pauza' : 'Odtwarzaj';
        }
        if (visualizer) visualizer.classList.toggle('animating', isPlaying);
      }
    } else {
      if (playBtn) playBtn.textContent = '▶';
    }
  } catch (err) {
    // Ignoruj chwilowy błąd DBus podczas startu
  }
}
window.syncMprisStatus = syncMprisStatus;

async function playSpotifyPlaylist(playlist) {
  currentSpotifyPlaylistId = playlist.id;

  // Podświetlenie aktywnej karty
  document.querySelectorAll('.spotify-playlist-card').forEach(c => c.classList.remove('active'));

  // Zatrzymaj wbudowane radio, by nie nakładało się na Spotify
  window.musicPlayer?.stopRadio?.();

  showToast(`Uruchamianie Spotify: ${playlist.name}...`);
  try {
    await window.api?.spotifyControl('play', playlist.uri);
    setTimeout(syncMprisStatus, 500);
    setTimeout(syncMprisStatus, 1500);
    showToast(`▶ Pełna playlista gra w tle (steruj z gry Ctrl+Alt+Spacja)!`);
  } catch (err) {
    showToast(`Błąd odtwarzania: ${err.message}`);
  }
}

function setupSpotifyMusicListeners() {
  const btnOpenHub = document.getElementById('btn-open-spotify-hub');
  const musicInfoClick = document.getElementById('music-info-click');
  const btnCloseModal = document.getElementById('btn-close-music-modal');
  const musicModal = document.getElementById('music-modal');
  const btnLogin = document.getElementById('btn-spotify-login');
  const btnLogout = document.getElementById('btn-spotify-logout');
  const btnRefresh = document.getElementById('btn-spotify-refresh-playlists');
  const btnLoadUrl = document.getElementById('btn-load-spotify-url');
  const urlInput = document.getElementById('spotify-playlist-url-input');

  const btnModalPlay = document.getElementById('btn-spotify-modal-play');
  const btnModalNext = document.getElementById('btn-spotify-modal-next');
  const btnModalPrev = document.getElementById('btn-spotify-modal-prev');

  btnOpenHub?.addEventListener('click', (e) => {
    e.stopPropagation();
    openMusicModal();
    syncMprisStatus();
  });

  musicInfoClick?.addEventListener('click', () => {
    openMusicModal();
    syncMprisStatus();
  });

  btnCloseModal?.addEventListener('click', closeMusicModal);
  musicModal?.addEventListener('click', (e) => {
    if (e.target === musicModal) closeMusicModal();
  });

  // Kontrolki odtwarzania Spotify w modalu
  btnModalPlay?.addEventListener('click', async () => {
    window.musicPlayer?.stopRadio?.();
    await window.api?.spotifyControl('toggle');
    setTimeout(syncMprisStatus, 300);
  });

  btnModalNext?.addEventListener('click', async () => {
    await window.api?.spotifyControl('next');
    setTimeout(syncMprisStatus, 300);
  });

  btnModalPrev?.addEventListener('click', async () => {
    await window.api?.spotifyControl('prev');
    setTimeout(syncMprisStatus, 300);
  });

  btnLogin?.addEventListener('click', async () => {
    try {
      showToast('Otwieranie logowania do Spotify...');
      const auth = await window.api.spotifyLogin();
      if (auth && auth.accessToken) {
        showToast('Pomyślnie połączono z kontem Spotify! 🎉');
        await checkSpotifyStatus();
      }
    } catch (err) {
      showToast(`Błąd logowania Spotify: ${err.message}`);
    }
  });

  btnLogout?.addEventListener('click', async () => {
    await window.api.spotifyLogout();
    currentSpotifyPlaylistId = null;
    showToast('Odłączono konto Spotify.');
    checkSpotifyStatus();
  });

  btnRefresh?.addEventListener('click', () => {
    loadSpotifyPlaylists();
  });

  btnLoadUrl?.addEventListener('click', async () => {
    const url = urlInput?.value?.trim();
    if (!url) {
      showToast('Wklej link do playlisty Spotify (np. https://open.spotify.com/playlist/...)');
      return;
    }

    const match = url.match(/(playlist|album|track|artist)[\/:]([a-zA-Z0-9]+)/);
    if (!match) {
      showToast('Nie rozpoznano formatu linku Spotify.');
      return;
    }

    const type = match[1];
    const id = match[2];
    const uri = `spotify:${type}:${id}`;

    // Zatrzymaj radio i puść pełny utwór w Spotify Desktop
    window.musicPlayer?.stopRadio?.();
    showToast('Wysyłanie playlisty do Spotify Desktop...');

    try {
      await window.api?.spotifyControl('play', uri);
      setTimeout(syncMprisStatus, 500);
      setTimeout(syncMprisStatus, 1500);
      showToast('▶ Piosenka/Playlista leci w tle w pełnej wersji (bez ucięć)!');
    } catch (err) {
      showToast(`Błąd odtwarzacza: ${err.message}`);
    }
  });

  // Stacje radiowe wbudowane w launcher
  document.getElementById('btn-station-lofi')?.addEventListener('click', () => {
    window.api?.spotifyControl('pause').catch(() => {});
    window.musicPlayer.playStation('lofi');
    showToast('Przełączono na stację: Lofi Chill Beats');
  });

  document.getElementById('btn-station-synthwave')?.addEventListener('click', () => {
    window.api?.spotifyControl('pause').catch(() => {});
    window.musicPlayer.playStation('synthwave');
    showToast('Przełączono na stację: Synthwave & Cyberpunk');
  });

  document.getElementById('btn-station-ambient')?.addEventListener('click', () => {
    window.api?.spotifyControl('pause').catch(() => {});
    window.musicPlayer.playStation('ambient');
    showToast('Przełączono na stację: Minecraft Ambient');
  });

  // Cykliczna synchronizacja stanu odtwarzacza w tle
  syncMprisStatus();
  setInterval(syncMprisStatus, 2500);
}

// Run init
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
