let skinViewer = null;
let pendingSkinUrl = null;
let pendingSkinVariant = null;
let pendingCapeIdOrUrl = null;
let currentAccount = null;
let currentSkinVariant = 'CLASSIC';
let currentAvatarHeadDataUrl = null;
let currentConfig = null;
let availableVersions = [];
let isGameLaunching = false;
let currentCosmetics = {
  backEquipment: 'cape',
  ears: false,
  halo: false
};
let haloMeshGroup = null;

function isOwnerAccount(account = currentAccount) {
  if (!account) return false;
  const name = String(account.username || account.name || '').trim().toLowerCase();
  const uuid = String(account.uuid || account.id || '').replace(/-/g, '').toLowerCase();
  return (
    name === 'mcqueen420_' ||
    name === 'mcqueen420' ||
    name === 'kasteusz' ||
    uuid === 'c78190c60bda425e9feea980e541479'
  );
}

function getDefaultSkinForAccount(account = currentAccount) {
  return isOwnerAccount(account) ? 'assets/mcqueen-skin.png' : 'assets/default-skin.png';
}

const elements = {
  navPills: document.querySelectorAll('.nav-pill'),
  tabViews: document.querySelectorAll('.tab-view'),
  userProfileBtn: document.getElementById('user-profile-btn'),
  userAvatarHead: document.getElementById('user-avatar-head'),
  userNicknameText: document.getElementById('user-nickname-text'),
  userStatusDot: document.getElementById('user-status-dot'),
  btnWinMinimize: document.getElementById('btn-win-minimize'),
  btnWinClose: document.getElementById('btn-win-close'),

  skinContainer: document.getElementById('skin-container'),
  skinCanvas: document.getElementById('skin-canvas'),
  currentVersionDisplay: document.getElementById('current-version-display'),
  playBtnGroup: document.getElementById('play-btn-group'),
  btnPlayGame: document.getElementById('btn-play-game'),
  playBtnText: document.getElementById('play-btn-text'),
  btnVersionDropdown: document.getElementById('btn-version-dropdown'),
  versionQuickMenu: document.getElementById('version-quick-menu'),

  versionsFullGrid: document.getElementById('versions-full-grid'),

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

  modsListContainer: document.getElementById('mods-list-container'),
  btnAddMods: document.getElementById('btn-add-mods'),
  btnOpenModsFolder: document.getElementById('btn-open-mods-folder'),
  btnInstallFabric: document.getElementById('btn-install-fabric'),
  btnInstallSodium: document.getElementById('btn-install-sodium'),

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

  profileStatPlaytime: document.getElementById('profile-stat-playtime'),
  profileStatLaunches: document.getElementById('profile-stat-launches'),
  profileStatRank: document.getElementById('profile-stat-rank'),

  settingAmbientGlow: document.getElementById('setting-ambient-glow'),
  settingAnimSpeed: document.getElementById('setting-anim-speed'),
  settingAnimVal: document.getElementById('setting-anim-val'),

  settingWallpaperOpacity: document.getElementById('setting-wallpaper-opacity'),
  settingWallpaperVal: document.getElementById('setting-wallpaper-val'),
  settingUiSounds: document.getElementById('setting-ui-sounds'),
  settingSoundsVolume: document.getElementById('setting-sounds-volume'),
  settingSoundsVal: document.getElementById('setting-sounds-val'),

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

async function initApp() {
  console.log('[RENDERER] Inicjalizacja KasteuszLauncher...');

  try {
    window.uiSounds?.attachInteractiveListeners();
  } catch (soundErr) {
    console.error('Błąd attachInteractiveListeners:', soundErr);
  }

  const setupTasks = [
    ['WindowControls', setupWindowControls],
    ['Navigation', setupNavigation],
    ['WardrobeListeners', setupWardrobeListeners],
    ['ThemesListeners', setupThemesListeners],
    ['LauncherStylesListeners', setupLauncherStylesListeners],
    ['SettingsListeners', setupSettingsListeners],
    ['ModsListeners', setupModsListeners],
    ['ProfilesListeners', setupProfilesListeners],
    ['ModBrowser', setupModBrowser],
    ['LauncherEventListeners', setupLauncherEventListeners],
    ['FriendsListeners', setupFriendsListeners],
    ['ServerHostingListeners', setupServerHostingListeners],
    ['SpotifyMusicListeners', setupSpotifyMusicListeners],
    ['PacksListeners', setupPacksListeners],
    ['ScreenshotsListeners', setupScreenshotsListeners],
    ['CrashDoctorListeners', setupCrashDoctorListeners],
    ['BenchmarkListeners', setupBenchmarkListeners],
    ['UpdaterUI', setupUpdaterUI],
    ['AdminDashboard', setupAdminDashboard]
  ];

  for (const [name, fn] of setupTasks) {
    try {
      if (typeof fn === 'function') fn();
    } catch (listenerErr) {
      console.error(`[INIT] Błąd rejestracji modułu ${name}:`, listenerErr);
    }
  }

  try {
    init3DSkinViewer();
  } catch (viewerErr) {
    console.error('Błąd startu podglądu 3D:', viewerErr);
  }

  try { await loadConfig(); } catch (e) { console.error('Błąd loadConfig:', e); }
  try { await loadAccount(); } catch (e) { console.error('Błąd loadAccount:', e); }
  try { await loadVersions(); } catch (e) { console.error('Błąd loadVersions:', e); }
  try { await loadProfiles(); } catch (e) { console.error('Błąd loadProfiles:', e); }
  try { await loadMods(); } catch (e) { console.error('Błąd loadMods:', e); }
  try { await loadPacks('resourcepacks'); } catch (e) { console.error('Błąd loadPacks:', e); }
  try { await loadFriends(); } catch (e) { console.error('Błąd loadFriends:', e); }
  try { initOfficialServerWidget(); } catch (e) { console.error('Błąd initOfficialServerWidget:', e); }
  try { await loadServerHosting(); } catch (e) { console.error('Błąd loadServerHosting:', e); }
  try { await loadStats(); } catch (e) { console.error('Błąd loadStats:', e); }
  try { await loadScreenshots(); } catch (e) { console.error('Błąd loadScreenshots:', e); }
  try { await loadBenchmarkHardwareSpecs(); } catch (e) { console.error('Błąd loadBenchmarkHardwareSpecs:', e); }
  try {
    await checkSpotifyStatus();
  } catch (e) {
    console.error('Błąd checkSpotifyStatus:', e);
  }

  if (!currentAccount) {
    setTimeout(() => {
      openLoginModal();
    }, 400);
  }
}

function setupWindowControls() {
  elements.btnWinMinimize?.addEventListener('click', () => window.api.minimizeWindow());
  const btnWinMaximize = document.getElementById('btn-win-maximize');
  btnWinMaximize?.addEventListener('click', () => window.api.maximizeWindow());
  elements.btnWinClose?.addEventListener('click', () => window.api.closeWindow());

  document.addEventListener('click', (e) => {
    const target = e.target;
    if (target && target.closest('.search-box') && !target.classList.contains('search-clear-btn')) {
      const input = target.closest('.search-box')?.querySelector('input');
      if (input && document.activeElement !== input) {
        input.focus();
      }
    }
  });
}

function switchToTab(targetTab) {
  elements.navPills.forEach(p => {
    p.classList.toggle('active', p.getAttribute('data-tab') === targetTab);
  });

  elements.tabViews.forEach(view => {
    const isTarget = view.id === `view-${targetTab}`;
    view.classList.toggle('active', isTarget);
    if (isTarget) {
      view.scrollTop = 0;
    }
  });

  if (targetTab === 'mods') {
    loadMods();
    setTimeout(() => {
      const modrinthView = document.getElementById('mods-subtab-view-modrinth');
      const isModrinth = modrinthView && modrinthView.style.display !== 'none';
      const targetInput = isModrinth
        ? document.getElementById('mod-browse-search-input')
        : document.getElementById('mods-local-search');
      targetInput?.focus();
    }, 80);
  }

  if (targetTab === 'packs') {
    loadPacks(currentPackType);
  }

  if (targetTab === 'music') {
    syncMprisStatus();
  }

  if (targetTab === 'screenshots') {
    loadScreenshots();
  }

  if (targetTab === 'benchmark') {
    loadBenchmarkHardwareSpecs();
  }

  if (targetTab === 'server') {
    loadServerHosting();
  }

  if (targetTab === 'admin') {
    if (!isOwnerAccount(currentAccount)) {
      switchToTab('play');
      return;
    }
    loadAdminDashboard();
  }

  if (targetTab === 'play' && skinViewer) {
    setTimeout(handleViewerResize, 50);
  }
}

function setupNavigation() {
  elements.navPills.forEach(pill => {
    pill.addEventListener('click', () => {
      const targetTab = pill.getAttribute('data-tab');
      switchToTab(targetTab);
    });
  });

  document.getElementById('quick-card-ram')?.addEventListener('click', () => switchToTab('settings'));
  document.getElementById('quick-card-mods')?.addEventListener('click', () => {
    switchToTab('mods');
    if (typeof window.switchModsSubtab === 'function') {
      window.switchModsSubtab('installed');
    }
  });
  document.getElementById('quick-card-account')?.addEventListener('click', () => {
    if (!currentAccount) openLoginModal();
    else openProfileModal();
  });

  elements.userProfileBtn?.addEventListener('click', () => {
    if (!currentAccount) {
      openLoginModal();
    } else {
      openProfileModal();
    }
  });

  elements.btnVersionDropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.versionQuickMenu?.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (elements.versionQuickMenu && elements.btnVersionDropdown) {
      if (!elements.versionQuickMenu.contains(e.target) && !elements.btnVersionDropdown.contains(e.target)) {
        elements.versionQuickMenu.classList.remove('open');
      }
    }
  });

  const subtabBtnProfiles = document.getElementById('subtab-btn-profiles');
  const subtabBtnVersions = document.getElementById('subtab-btn-versions');
  const subtabBtnModsLegacy = document.getElementById('subtab-btn-mods');
  const subtabViewProfiles = document.getElementById('subtab-view-profiles');
  const subtabViewVersions = document.getElementById('subtab-view-versions');

  function activateInstanceSubtab(btn, view) {
    [subtabBtnProfiles, subtabBtnVersions].forEach(b => b?.classList.remove('active'));
    [subtabViewProfiles, subtabViewVersions].forEach(v => {
      if (v) v.style.display = 'none';
    });
    btn?.classList.add('active');
    if (view) view.style.display = 'block';
  }

  subtabBtnProfiles?.addEventListener('click', () => activateInstanceSubtab(subtabBtnProfiles, subtabViewProfiles));
  subtabBtnVersions?.addEventListener('click', () => activateInstanceSubtab(subtabBtnVersions, subtabViewVersions));
  subtabBtnModsLegacy?.addEventListener('click', () => {
    switchToTab('mods');
    if (typeof window.switchModsSubtab === 'function') {
      window.switchModsSubtab('installed');
    }
  });

  const modsSubtabBtnInstalled = document.getElementById('mods-subtab-btn-installed');
  const modsSubtabBtnModrinth = document.getElementById('mods-subtab-btn-modrinth');
  const modsSubtabViewInstalled = document.getElementById('mods-subtab-view-installed');
  const modsSubtabViewModrinth = document.getElementById('mods-subtab-view-modrinth');

  window.switchModsSubtab = function(tabName) {
    if (tabName === 'modrinth') {
      modsSubtabBtnInstalled?.classList.remove('active');
      modsSubtabBtnModrinth?.classList.add('active');
      if (modsSubtabViewInstalled) modsSubtabViewInstalled.style.display = 'none';
      if (modsSubtabViewModrinth) modsSubtabViewModrinth.style.display = 'block';
      if (!hasLoadedModBrowseOnce) {
        hasLoadedModBrowseOnce = true;
        loadModrinthMods();
      }
      setTimeout(() => {
        const input = document.getElementById('mod-browse-search-input');
        if (input) {
          input.focus();
        }
      }, 60);
    } else {
      modsSubtabBtnModrinth?.classList.remove('active');
      modsSubtabBtnInstalled?.classList.add('active');
      if (modsSubtabViewModrinth) modsSubtabViewModrinth.style.display = 'none';
      if (modsSubtabViewInstalled) modsSubtabViewInstalled.style.display = 'block';
      loadMods();
      setTimeout(() => {
        const input = document.getElementById('mods-local-search');
        if (input) {
          input.focus();
        }
      }, 60);
    }
  };

  modsSubtabBtnInstalled?.addEventListener('click', () => window.switchModsSubtab('installed'));
  modsSubtabBtnModrinth?.addEventListener('click', () => window.switchModsSubtab('modrinth'));

  elements.btnPlayGame.addEventListener('click', handlePlayClick);
}

function createStanceAnimationClass() {
  if (!window.skinview3d?.PlayerAnimation) return null;
  return class extends window.skinview3d.PlayerAnimation {
    animate(player) {
      const t = 1.4 * this.progress;
      player.skin.leftArm.rotation.x = -0.18 + 0.03 * Math.sin(t);
      player.skin.leftArm.rotation.z = 0.12 + 0.015 * Math.cos(t);

      player.skin.rightArm.rotation.x = 0.18 - 0.03 * Math.sin(t);
      player.skin.rightArm.rotation.z = -0.12 - 0.015 * Math.cos(t);

      player.skin.leftLeg.rotation.x = 0.14;
      player.skin.leftLeg.rotation.z = -0.03;

      player.skin.rightLeg.rotation.x = -0.14;
      player.skin.rightLeg.rotation.z = 0.03;

      player.skin.head.rotation.y = 0.30 + 0.02 * Math.sin(t * 0.5);
      player.skin.head.rotation.x = -0.02 + 0.01 * Math.cos(t * 0.5);

      if (player.cape && player.cape.visible) {
        player.cape.rotation.y = 0;
        player.cape.rotation.x = 0.20 + 0.08 * Math.sin(t * 1.3);
        player.cape.rotation.z = 0.03 * Math.cos(t * 0.9);
      }

      if (player.elytra && (player.backEquipment === 'elytra' || player.elytra.visible)) {
        player.elytra.leftWing.rotation.x = 0.32 + 0.05 * Math.cos(t * 1.2);
        player.elytra.leftWing.rotation.z = 0.30 + 0.10 * Math.sin(t * 1.4);
        if (typeof player.elytra.updateRightWing === 'function') {
          player.elytra.updateRightWing();
        }
      }

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

    if (skinViewer.renderer) {
      skinViewer.renderer.setClearColor(0x000000, 0);
    }
    if (skinViewer.fxaaPass) {
      skinViewer.fxaaPass.enabled = false;
    }
    if (skinViewer.renderPass) {
      skinViewer.renderPass.renderToScreen = true;
    }

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

    const targetObj = skinViewer.playerWrapper || skinViewer.playerObject;
    if (targetObj) {
      targetObj.rotation.y = isPlayerFlipped ? 2.72 : -0.42;
      targetObj.position.y = -2;
    }

    if (skinViewer.globalLight) {
      skinViewer.globalLight.intensity = 1.05;
    }
    if (skinViewer.cameraLight) {
      skinViewer.cameraLight.intensity = 1.75;
    }

    window.addEventListener('resize', handleViewerResize);
    setTimeout(handleViewerResize, 100);
    setTimeout(handleViewerResize, 350);

    if (pendingCapeIdOrUrl) {
      applyCape(pendingCapeIdOrUrl, false);
      pendingCapeIdOrUrl = null;
    }

    const skinToLoad = pendingSkinUrl || 'assets/default-skin.png';
    const variantToLoad = pendingSkinVariant || currentSkinVariant;
    pendingSkinUrl = null;
    pendingSkinVariant = null;
    updateSkinDisplay(skinToLoad, variantToLoad);

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

const DEFAULT_HEAD_SVG_DATA_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">' +
  '<rect width="8" height="8" fill="#B57B5A"/>' +
  '<rect width="8" height="2" fill="#3B2518"/>' +
  '<rect x="0" y="2" width="1" height="1" fill="#3B2518"/>' +
  '<rect x="7" y="2" width="1" height="1" fill="#3B2518"/>' +
  '<rect x="1" y="4" width="1" height="1" fill="#FFFFFF"/>' +
  '<rect x="2" y="4" width="1" height="1" fill="#493B7F"/>' +
  '<rect x="5" y="4" width="1" height="1" fill="#493B7F"/>' +
  '<rect x="6" y="4" width="1" height="1" fill="#FFFFFF"/>' +
  '<rect x="3" y="5" width="2" height="1" fill="#8E563B"/>' +
  '<rect x="2" y="6" width="4" height="1" fill="#633A27"/>' +
  '</svg>'
);
let defaultHeadDataUrl = DEFAULT_HEAD_SVG_DATA_URL;

function attachPlayerHeadImg(imgEl, username, size = 32) {
  if (!imgEl) return;
  const clean = encodeURIComponent(String(username || 'Steve').trim() || 'Steve');
  const px = Math.max(24, Number(size) || 32);
  const candidates = [
    `https://minotar.net/helm/${clean}/${px}.png`,
    `https://mc-heads.net/avatar/${clean}/${px}`
  ];
  let idx = 0;
  imgEl.onerror = () => {
    idx++;
    if (idx < candidates.length) {
      imgEl.src = candidates[idx];
    } else {
      imgEl.onerror = null;
      imgEl.src = defaultHeadDataUrl;
    }
  };
  imgEl.src = candidates[0];
}

function renderSkinHeadDataUrl(skinSrc) {
  return new Promise((resolve) => {
    if (!skinSrc || typeof skinSrc !== 'string') return resolve(null);
    const img = new Image();
    if (!skinSrc.startsWith('data:') && !skinSrc.startsWith('assets/')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      try {
        if (img.width < 32 || img.height < 32) return resolve(null);
        const scale = img.width / 64;
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 8 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
        ctx.drawImage(img, 40 * scale, 8 * scale, 8 * scale, 8 * scale, 0, 0, 64, 64);
        resolve(c.toDataURL('image/png'));
      } catch (_) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = skinSrc.startsWith('http://') ? skinSrc.replace('http://', 'https://') : skinSrc;
  });
}

renderSkinHeadDataUrl('assets/default-skin.png').then((cropped) => {
  if (!cropped) return;
  defaultHeadDataUrl = cropped;
  ['user-avatar-head', 's2-avatar-img', 'modal-account-avatar'].forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.getAttribute('src') === 'assets/default-skin.png') {
      el.src = cropped;
    }
  });
});

function updateSkinDisplay(skinUrl, variant = null) {
  let target = skinUrl || 'assets/default-skin.png';
  if (typeof target === 'string' && target.startsWith('http://')) {
    target = target.replace('http://', 'https://');
  }
  const effectiveVariant = (variant || currentSkinVariant || 'CLASSIC').toUpperCase();
  const modelOpt = effectiveVariant === 'SLIM' ? 'slim' : 'default';

  if (!skinViewer) {
    pendingSkinUrl = target;
    pendingSkinVariant = effectiveVariant;
    init3DSkinViewer();
    return;
  }

  try {
    skinViewer.loadSkin(target, { model: modelOpt }).then(() => {
      if (skinViewer.playerObject?.skin) {
        skinViewer.playerObject.skin.visible = true;
      }
    }).catch(err => {
      console.warn('Błąd ładowania skórki, używam fallbacku:', err);
      if (target !== 'assets/default-skin.png') {
        skinViewer.loadSkin('assets/default-skin.png', { model: 'default' }).then(() => {
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

async function loadConfig() {
  try {
    currentConfig = await window.api.getConfig();
    
    if (elements.settingFpsBoost) {
      elements.settingFpsBoost.checked = currentConfig.fpsBoostMode !== false;
    }
    if (elements.settingOptimizeOptions) {
      elements.settingOptimizeOptions.checked = currentConfig.optimizeGameOptions !== false;
    }

    if (elements.settingDiscordRpc) {
      elements.settingDiscordRpc.checked = currentConfig.discordRpcEnabled !== false;
    }
    if (elements.settingDiscordClientId) {
      elements.settingDiscordClientId.value = currentConfig.discordClientId || '';
    }

    const memGb = currentConfig.memoryMax || 4;
    elements.settingRamMax.value = memGb;
    updateRamIndicators(memGb);

    const jvmPreset = currentConfig.jvmPreset || 'ultra';
    document.querySelectorAll('#jvm-presets-grid .jvm-preset-card').forEach(c => {
      c.classList.toggle('active', c.dataset.preset === jvmPreset);
    });
    const customJvmInput = document.getElementById('setting-custom-jvm-args');
    if (customJvmInput) customJvmInput.value = currentConfig.customJvmArgs || '';

    elements.settingJavaPath.value = (currentConfig.javaPath && currentConfig.javaPath !== 'java' && currentConfig.javaPath !== 'java.exe') ? currentConfig.javaPath : '';
    elements.settingGameDir.value = currentConfig.gameDirectory || '~/.kasteuszlauncher/minecraft';
    elements.settingCloseOnLaunch.checked = !!currentConfig.closeOnLaunch;

    const version = currentConfig.selectedVersion || '1.21.4';
    updateSelectedVersion(version, false);

    const theme = currentConfig.themeAccent || 'purple';
    applyTheme(theme, false);

    const uiStyle = currentConfig.launcherStyle || 'style1';
    applyLauncherStyleUI(uiStyle);

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

    const savedWallpaper = currentConfig.liveWallpaper || 'matrix';
    const savedOpacity = (currentConfig.wallpaperOpacity !== undefined) ? currentConfig.wallpaperOpacity : 0.55;
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

    const musicStation = currentConfig.musicPlayerStation || 'lofi';
    const musicVolume = (currentConfig.musicPlayerVolume !== undefined) ? currentConfig.musicPlayerVolume : 0.35;
    window.musicPlayer?.init(musicStation, musicVolume);

    if (currentConfig.cosmetics) {
      currentCosmetics = {
        backEquipment: currentConfig.cosmetics.backEquipment || 'cape',
        ears: !!currentConfig.cosmetics.ears,
        halo: !!currentConfig.cosmetics.halo
      };
    }
    updateCosmeticsUI();

    const savedCape = currentConfig.selectedCape || 'none';
    setTimeout(() => {
      applyCape(savedCape, false);
    }, 250);
  } catch (err) {
    console.error('Błąd ładowania konfiguracji:', err);
  }
}

function updateRamIndicators(gbVal) {
  const gb = parseInt(gbVal, 10) || 4;
  if (elements.settingRamVal) elements.settingRamVal.textContent = `${gb} GB`;
  const quickRam = document.getElementById('quick-stat-ram');
  if (quickRam) quickRam.textContent = `${gb} GB przydzielone`;

  const hint = document.getElementById('ram-recommendation-hint');
  if (hint) {
    if (gb <= 3) {
      hint.style.color = '#94A3B8';
      hint.innerHTML = '<span>Podstawowy profil pamięci dla lekkiej rozgrywki (2 – 3 GB)</span>';
    } else if (gb <= 8) {
      hint.style.color = '#34D399';
      hint.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="20 6 9 17 4 12"/></svg><span>Optymalny zakres dla Minecraft z modami Fabric (4 – 8 GB)</span>';
    } else {
      hint.style.color = '#FBBF24';
      hint.innerHTML = '<span>Wysoki przydział dla ciężkich paczek modów i shaderów 4K (9 – 16 GB)</span>';
    }
  }
}

function setupSettingsListeners() {
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

  elements.settingUiSounds?.addEventListener('change', (e) => {
    window.uiSounds?.setEnabled(e.target.checked);
    window.api.saveConfig({ uiSoundsEnabled: e.target.checked });
    showToast(e.target.checked ? 'Włączono dźwięki interfejsu' : 'Wyciszono dźwięki interfejsu');
  });

  elements.settingSoundsVolume?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (elements.settingSoundsVal) elements.settingSoundsVal.textContent = `${val}%`;
    window.uiSounds?.setVolume(val / 100);
    window.api.saveConfig({ uiSoundsVolume: val / 100 });
  });

  elements.settingFpsBoost?.addEventListener('change', (e) => {
    window.api.saveConfig({ fpsBoostMode: e.target.checked });
    showToast(e.target.checked ? 'Włączono tryb optymalizacji FPS' : 'Wyłączono optymalizator FPS');
  });

  const jvmCards = document.querySelectorAll('#jvm-presets-grid .jvm-preset-card');
  const customJvmInput = document.getElementById('setting-custom-jvm-args');
  const btn1ClickTune = document.getElementById('btn-1click-auto-tune');

  function applyJvmPresetUI(presetKey) {
    jvmCards.forEach(card => {
      card.classList.toggle('active', card.dataset.preset === presetKey);
    });
  }

  jvmCards.forEach(card => {
    card.addEventListener('click', () => {
      const preset = card.dataset.preset;
      applyJvmPresetUI(preset);
      window.api.saveConfig({ jvmPreset: preset });
      const names = {
        ultra: 'Ultra FPS (Generational ZGC Java 21)',
        g1gc: 'Stabilny (G1GC Aikar Tuned)',
        lowend: 'Low-End PC (Oszczędny Parallel)'
      };
      showToast(`Wybrano profil: ${names[preset] || preset}`);
    });
  });

  customJvmInput?.addEventListener('change', (e) => {
    window.api.saveConfig({ customJvmArgs: e.target.value.trim() });
    showToast('Zapisano dodatkowe parametry JVM.');
  });

  btn1ClickTune?.addEventListener('click', async () => {
    btn1ClickTune.classList.add('rotating');
    try {
      const specs = await window.api.getSystemSpecs?.().catch(() => ({ totalRamGb: 16 }));
      const totalRam = specs?.totalRamGb || 16;
      let recRam = 8;
      let recPreset = 'ultra';

      if (totalRam >= 16) {
        recRam = 8;
        recPreset = 'ultra';
      } else if (totalRam >= 12) {
        recRam = 6;
        recPreset = 'ultra';
      } else if (totalRam >= 8) {
        recRam = 4;
        recPreset = 'g1gc';
      } else {
        recRam = 3;
        recPreset = 'lowend';
      }

      elements.settingRamMax.value = recRam;
      updateRamIndicators(recRam);
      applyJvmPresetUI(recPreset);
      if (elements.settingFpsBoost) elements.settingFpsBoost.checked = true;

      window.api.saveConfig({
        memoryMax: recRam,
        jvmPreset: recPreset,
        fpsBoostMode: true
      });

      const presetNames = {
        ultra: 'Ultra FPS (ZGC Java 21)',
        g1gc: 'Stabilny (G1GC Aikar)',
        lowend: 'Low-End PC'
      };

      showToast(`⚡ 1-Click Tuning: Wykryto ${totalRam} GB RAM. Zastosowano ${recRam} GB RAM + ${presetNames[recPreset]}!`);
    } finally {
      setTimeout(() => btn1ClickTune.classList.remove('rotating'), 650);
    }
  });

  elements.settingOptimizeOptions?.addEventListener('change', (e) => {
    window.api.saveConfig({ optimizeGameOptions: e.target.checked });
  });

  elements.settingDiscordRpc?.addEventListener('change', (e) => {
    window.api.saveConfig({ discordRpcEnabled: e.target.checked });
    showToast(e.target.checked ? 'Włączono status Discord Rich Presence' : 'Wyłączono Discord Rich Presence');
  });

  elements.settingDiscordClientId?.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    window.api.saveConfig({ discordClientId: val });
    showToast(val ? 'Zaktualizowano Client ID dla Discord RPC' : 'Przywrócono domyślne Client ID');
  });

  elements.btnOpenDiscordDev?.addEventListener('click', () => {
    window.api.openExternal('https://discord.com/developers/applications');
  });

  elements.settingRamMax.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10) || 4;
    updateRamIndicators(val);
    window.api.saveConfig({ memoryMax: val });
  });

  elements.btnBrowseJava.addEventListener('click', async () => {
    const chosen = await window.api.selectJava();
    if (chosen) {
      elements.settingJavaPath.value = chosen;
      window.api.saveConfig({ javaPath: chosen });
      showToast('Zaktualizowano ścieżkę Java.');
    }
  });

  elements.btnBrowseDir.addEventListener('click', async () => {
    const chosen = await window.api.selectDirectory();
    if (chosen) {
      elements.settingGameDir.value = chosen;
      window.api.saveConfig({ gameDirectory: chosen });
      showToast('Zaktualizowano katalog gry.');
    }
  });

  elements.settingCloseOnLaunch.addEventListener('change', (e) => {
    window.api.saveConfig({ closeOnLaunch: e.target.checked });
  });

  elements.btnClearLogs.addEventListener('click', () => {
    elements.logsConsole.innerHTML = '<div class="log-line">[SYSTEM] Konsola wyczyszczona.</div>';
  });
}

function setupUpdaterUI() {
  const topbarPill = document.getElementById('topbar-update-pill');
  const topbarText = document.getElementById('topbar-update-text');
  const topbarBtn = document.getElementById('btn-topbar-update-action');

  const globalBanner = document.getElementById('global-update-banner');
  const bannerHeadline = document.getElementById('update-banner-headline');
  const bannerSubline = document.getElementById('update-banner-subline');
  const btnBannerDownload = document.getElementById('btn-banner-download-update');
  const btnBannerInstall = document.getElementById('btn-banner-install-update');
  const btnBannerDismiss = document.getElementById('btn-banner-dismiss-update');
  const bannerProgressBar = document.getElementById('update-download-progress-bar');
  const bannerProgressFill = document.getElementById('update-progress-bar-fill');

  const settingsStatusPill = document.getElementById('settings-update-status-pill');
  const settingsCurrentVer = document.getElementById('settings-current-version');
  const settingsMsg = document.getElementById('settings-update-message');
  const btnSettingsCheck = document.getElementById('btn-settings-check-update');
  const btnSettingsDownload = document.getElementById('btn-settings-download-update');
  const btnSettingsInstall = document.getElementById('btn-settings-install-update');
  const settingsProgressRow = document.getElementById('settings-update-progress-row');
  const settingsProgressLabel = document.getElementById('settings-update-progress-label');
  const settingsProgressPct = document.getElementById('settings-update-progress-pct');
  const settingsProgressBar = document.getElementById('settings-update-progress-bar');
  const settingGithubRepo = document.getElementById('setting-github-repo');
  const btnSaveGithubRepo = document.getElementById('btn-save-github-repo');

  let bannerDismissed = false;

  function renderStatus(status) {
    if (!status) return;

    if (settingsCurrentVer && status.currentVersion) {
      settingsCurrentVer.textContent = `v${status.currentVersion}`;
    }
    const topbarVer = document.getElementById('topbar-app-version') || document.querySelector('.topbar-version-tag');
    if (topbarVer && status.currentVersion) {
      topbarVer.textContent = `v${status.currentVersion}`;
    }
    if (settingGithubRepo && status.repo && !settingGithubRepo.matches(':focus')) {
      settingGithubRepo.value = status.repo;
    }

    if (status.state === 'checking') {
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill checking';
        settingsStatusPill.textContent = 'Sprawdzanie...';
      }
      if (settingsMsg) settingsMsg.textContent = 'Łączenie z GitHub Releases...';
      if (btnSettingsCheck) btnSettingsCheck.disabled = true;
    } else if (status.state === 'available') {
      const ver = status.availableVersion ? `v${status.availableVersion}` : 'Nowa wersja';
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill update-ready';
        settingsStatusPill.textContent = `Dostępna ${ver}`;
      }
      if (settingsMsg) {
        settingsMsg.textContent = `Wykryto wydanie ${ver}! Kliknij poniżej, aby zaktualizować.`;
      }
      if (btnSettingsCheck) btnSettingsCheck.disabled = false;
      if (btnSettingsDownload) btnSettingsDownload.style.display = 'inline-block';
      if (btnSettingsInstall) btnSettingsInstall.style.display = 'none';

      if (topbarPill) {
        topbarPill.style.display = 'inline-flex';
        if (topbarText) topbarText.textContent = `Aktualizacja ${ver}`;
      }

      if (!bannerDismissed && globalBanner) {
        globalBanner.style.display = 'block';
        if (bannerHeadline) bannerHeadline.textContent = `Dostępna nowa wersja Kasteusz Launcher ${ver}!`;
        if (bannerSubline) bannerSubline.textContent = status.releaseNotes || 'Pobierz najnowszą wersję w kilka sekund bez utraty ustawień i światów.';
        if (btnBannerDownload) btnBannerDownload.style.display = 'inline-block';
        if (btnBannerInstall) btnBannerInstall.style.display = 'none';
      }
    } else if (status.state === 'downloading') {
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill checking';
        settingsStatusPill.textContent = 'Pobieranie...';
      }
      if (settingsProgressRow) settingsProgressRow.style.display = 'block';
      if (btnSettingsDownload) btnSettingsDownload.style.display = 'none';
      if (bannerProgressBar) bannerProgressBar.style.display = 'block';
      if (btnBannerDownload) btnBannerDownload.style.display = 'none';
    } else if (status.state === 'downloaded') {
      const ver = status.availableVersion ? `v${status.availableVersion}` : '';
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill up-to-date';
        settingsStatusPill.textContent = `Gotowa do restartu`;
      }
      if (settingsMsg) {
        settingsMsg.textContent = `Pobrano aktualizację ${ver}! Zrestartuj launcher, aby zastosować.`;
      }
      if (settingsProgressRow) settingsProgressRow.style.display = 'none';
      if (btnSettingsDownload) btnSettingsDownload.style.display = 'none';
      if (btnSettingsInstall) btnSettingsInstall.style.display = 'inline-block';

      if (globalBanner) {
        globalBanner.style.display = 'block';
        if (bannerHeadline) bannerHeadline.textContent = `Aktualizacja ${ver} pobrana pomyślnie!`;
        if (bannerSubline) bannerSubline.textContent = 'Kliknij przycisk poniżej, aby zrestartować launcher z najnowszą wersją.';
        if (btnBannerDownload) btnBannerDownload.style.display = 'none';
        if (btnBannerInstall) btnBannerInstall.style.display = 'inline-block';
        if (bannerProgressBar) bannerProgressBar.style.display = 'none';
      }
      if (topbarBtn) {
        topbarBtn.textContent = 'Zrestartuj';
      }
    } else if (status.state === 'not-available') {
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill up-to-date';
        settingsStatusPill.textContent = 'Najnowsza wersja';
      }
      if (settingsMsg) settingsMsg.textContent = 'Posiadasz najbardziej aktualną wersję Kasteusz Launcher.';
      if (btnSettingsCheck) btnSettingsCheck.disabled = false;
      if (btnSettingsDownload) btnSettingsDownload.style.display = 'none';
      if (btnSettingsInstall) btnSettingsInstall.style.display = 'none';
      if (topbarPill) topbarPill.style.display = 'none';
      if (globalBanner) globalBanner.style.display = 'none';
    } else if (status.state === 'error') {
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill checking';
        settingsStatusPill.textContent = 'Brak połączenia';
      }
      if (settingsMsg) settingsMsg.textContent = `Błąd: ${status.error || 'Nie udało się połączyć z serwerem aktualizacji.'}`;
      if (btnSettingsCheck) btnSettingsCheck.disabled = false;
    }
  }

  function renderProgress(prog) {
    if (!prog) return;
    const pct = `${prog.percent || 0}%`;
    const speedMb = prog.bytesPerSecond ? (prog.bytesPerSecond / (1024 * 1024)).toFixed(1) : '0.0';
    const mbTotal = prog.total ? (prog.total / (1024 * 1024)).toFixed(1) : '?';
    const mbTrans = prog.transferred ? (prog.transferred / (1024 * 1024)).toFixed(1) : '0';

    if (settingsProgressRow) settingsProgressRow.style.display = 'block';
    if (settingsProgressPct) settingsProgressPct.textContent = pct;
    if (settingsProgressBar) settingsProgressBar.style.width = pct;
    if (settingsProgressLabel) settingsProgressLabel.textContent = `Pobieranie: ${mbTrans} MB / ${mbTotal} MB (${speedMb} MB/s)`;

    if (bannerProgressBar) bannerProgressBar.style.display = 'block';
    if (bannerProgressFill) bannerProgressFill.style.width = pct;
    if (bannerSubline) bannerSubline.textContent = `Pobieranie aktualizacji: ${pct} (${speedMb} MB/s)`;
  }

  btnBannerDismiss?.addEventListener('click', () => {
    bannerDismissed = true;
    if (globalBanner) globalBanner.style.display = 'none';
  });

  const triggerDownload = async () => {
    try {
      showToast('Rozpoczęto pobieranie aktualizacji...');
      await window.api.downloadUpdate();
    } catch (err) {
      showToast(`Błąd pobierania: ${err.message}`);
    }
  };

  const triggerInstall = async () => {
    try {
      showToast('Restartowanie launchera...');
      await window.api.installUpdate();
    } catch (err) {
      showToast(`Błąd instalacji: ${err.message}`);
    }
  };

  btnBannerDownload?.addEventListener('click', triggerDownload);
  btnSettingsDownload?.addEventListener('click', triggerDownload);
  btnBannerInstall?.addEventListener('click', triggerInstall);
  btnSettingsInstall?.addEventListener('click', triggerInstall);

  topbarBtn?.addEventListener('click', () => {
    const status = window.api.getUpdateStatus ? window.api.getUpdateStatus() : null;
    if (status && status.state === 'downloaded') triggerInstall();
    else triggerDownload();
  });

  btnSettingsCheck?.addEventListener('click', async () => {
    try {
      btnSettingsCheck.disabled = true;
      if (settingsStatusPill) {
        settingsStatusPill.className = 'update-status-pill checking';
        settingsStatusPill.textContent = 'Sprawdzanie...';
      }
      showToast('Sprawdzanie dostępności aktualizacji na GitHubie...');
      const res = await window.api.checkForUpdates();
      renderStatus(res);
      if (res?.state === 'not-available') {
        showToast('Posiadasz najnowszą wersję launchera!');
      }
    } catch (err) {
      showToast(`Błąd sprawdzania aktualizacji: ${err.message}`);
    } finally {
      btnSettingsCheck.disabled = false;
    }
  });

  btnSaveGithubRepo?.addEventListener('click', async () => {
    const val = settingGithubRepo?.value.trim();
    if (!val || !val.includes('/')) {
      showToast('Wpisz repozytorium w formacie: właściciel/nazwa (np. LiLKasteusz/KasteuszLauncher)');
      return;
    }
    try {
      await window.api.saveUpdateRepo(val);
      showToast(`Zapisano źródło aktualizacji: ${val}`);
      await window.api.checkForUpdates();
    } catch (err) {
      showToast(`Błąd: ${err.message}`);
    }
  });

  if (window.api?.onUpdateStatusChanged) {
    window.api.onUpdateStatusChanged((status) => {
      renderStatus(status);
    });
  }

  if (window.api?.onUpdateProgress) {
    window.api.onUpdateProgress((prog) => {
      renderProgress(prog);
    });
  }

  if (window.api?.getUpdateStatus) {
    window.api.getUpdateStatus().then(status => renderStatus(status)).catch(() => {});
  }
}

// ============================================================================
// ADMIN / OWNER PANEL CONTROLLER (#view-admin)
// ============================================================================
let adminAutoRefreshTimer = null;

function setupAdminDashboard() {
  const btnRefresh = document.getElementById('btn-admin-refresh');
  const btnSendBroadcast = document.getElementById('btn-admin-send-broadcast');
  const broadcastInput = document.getElementById('admin-broadcast-msg');
  const broadcastFeedback = document.getElementById('admin-broadcast-feedback');
  const btnDismissAnnounce = document.getElementById('btn-banner-dismiss-announcement');
  const announceBanner = document.getElementById('global-announcement-banner');
  const announceTitle = document.getElementById('announcement-banner-title');
  const announceText = document.getElementById('announcement-banner-text');

  btnRefresh?.addEventListener('click', async () => {
    btnRefresh.disabled = true;
    try {
      await loadAdminDashboard(true);
      showToast('Zaktualizowano listę graczy i serwer!');
    } catch (err) {
      showToast(`Błąd odświeżania: ${err.message}`);
    } finally {
      btnRefresh.disabled = false;
    }
  });

  btnSendBroadcast?.addEventListener('click', async () => {
    const text = (broadcastInput?.value || '').trim();
    if (!text) {
      if (broadcastFeedback) {
        broadcastFeedback.textContent = 'Wpisz treść ogłoszenia!';
        broadcastFeedback.style.color = '#EF4444';
      }
      return;
    }

    btnSendBroadcast.disabled = true;
    if (broadcastFeedback) {
      broadcastFeedback.textContent = 'Wysyłanie ogłoszenia...';
      broadcastFeedback.style.color = '#F59E0B';
    }

    try {
      await window.api.broadcastAnnouncement(text);
      if (broadcastInput) broadcastInput.value = '';
      if (broadcastFeedback) {
        broadcastFeedback.textContent = '✅ Ogłoszenie wysłane do wszystkich launcherów!';
        broadcastFeedback.style.color = '#34D399';
        setTimeout(() => { if (broadcastFeedback) broadcastFeedback.textContent = ''; }, 4500);
      }
      showToast('Ogłoszenie zostało rozesłane!');
    } catch (err) {
      if (broadcastFeedback) {
        broadcastFeedback.textContent = `Błąd: ${err.message}`;
        broadcastFeedback.style.color = '#EF4444';
      }
    } finally {
      btnSendBroadcast.disabled = false;
    }
  });

  btnDismissAnnounce?.addEventListener('click', () => {
    if (announceBanner) announceBanner.style.display = 'none';
  });

  // Global Announcement Listener
  if (window.api?.onAnnouncementReceived) {
    window.api.onAnnouncementReceived((data) => {
      if (!data || !data.message) return;
      if (announceBanner && announceText) {
        if (announceTitle) announceTitle.textContent = data.title || '👑 Ogłoszenie Właściciela (Kasteusz)';
        announceText.textContent = data.message;
        announceBanner.style.display = 'block';
      }
    });
  }

  // Auto-refresh interval (every 15s if admin tab is visible, or update badge)
  if (adminAutoRefreshTimer) clearInterval(adminAutoRefreshTimer);
  adminAutoRefreshTimer = setInterval(() => {
    const adminView = document.getElementById('view-admin');
    if (adminView && adminView.classList.contains('active') && isOwnerAccount(currentAccount)) {
      loadAdminDashboard(false).catch(() => {});
    }
  }, 15000);
}

async function loadAdminDashboard(isManual = false) {
  if (!isOwnerAccount(currentAccount)) return;

  const launcherContainer = document.getElementById('admin-launcher-players-container');
  const serverContainer = document.getElementById('admin-server-players-container');
  const statLauncherCount = document.getElementById('admin-stat-launcher-count');
  const statServerCount = document.getElementById('admin-stat-server-count');
  const smpStatusPill = document.getElementById('admin-smp-status-pill');
  const smpDetails = document.getElementById('admin-smp-details');
  const sidebarAdminBadge = document.getElementById('sidebar-admin-online-badge');

  try {
    const res = await window.api.getAdminPresenceData();
    if (!res || !res.success) {
      if (launcherContainer) {
        launcherContainer.innerHTML = `<div class="admin-empty-state" style="color: #EF4444;">${res?.error || 'Nie udało się pobrać danych panelu.'}</div>`;
      }
      return;
    }

    const launcherPlayers = Array.isArray(res.launcherPlayers) ? res.launcherPlayers : [];
    const serverData = res.serverData || {};

    // 1. KPI Counts
    if (statLauncherCount) statLauncherCount.textContent = `${launcherPlayers.length} online`;
    if (sidebarAdminBadge) sidebarAdminBadge.textContent = String(launcherPlayers.length);

    const sOnline = serverData.playersCount ?? 0;
    const sMax = serverData.maxPlayers ?? 20;
    if (statServerCount) statServerCount.textContent = `${sOnline} / ${sMax}`;

    if (smpStatusPill) {
      smpStatusPill.className = `server-status-pill ${serverData.online ? 'online' : 'offline'}`;
      smpStatusPill.textContent = serverData.online ? 'Online' : 'Offline';
    }
    if (smpDetails) {
      const pingText = serverData.pingMs ? ` • ${serverData.pingMs} ms` : '';
      smpDetails.textContent = `mc.szkolnesmp.com.pl:23008 • ${serverData.version || 'Paper 1.21.11'}${pingText}`;
    }

    // 2. Render Launcher Players
    if (launcherContainer) {
      if (!launcherPlayers.length) {
        launcherContainer.innerHTML = `<div class="admin-empty-state">Brak innych aktywnych graczy w launcherze w tej chwili.</div>`;
      } else {
        launcherContainer.innerHTML = launcherPlayers.map(p => {
          const isOwner = !!p.isOwner;
          const nick = escapeHtml(p.user || 'Gracz');
          const status = escapeHtml(p.status || 'W menu głównym');
          const os = escapeHtml(p.os || 'Windows');
          const ver = escapeHtml(p.ver || 'v2.5.1');
          const ram = p.ramGb ? `${p.ramGb} GB RAM` : '4 GB RAM';
          const dtSec = Math.max(0, Math.round((Date.now() - (p.ts || Date.now())) / 1000));
          const timeAgo = dtSec < 20 ? '🟢 Aktywny teraz' : (dtSec < 60 ? `🟢 ${dtSec}s temu` : `🟡 ${Math.round(dtSec / 60)}m temu`);
          const osIcon = os.toLowerCase().includes('win') ? '🪟' : (os.toLowerCase().includes('mac') ? '🍎' : '🐧');

          return `
            <div class="admin-player-card ${isOwner ? 'is-owner' : ''}">
              <div class="admin-player-avatar-wrap">
                <img src="https://mc-heads.net/avatar/${encodeURIComponent(nick)}/48" alt="${nick}" onerror="this.src='assets/default-skin.png'">
              </div>
              <div class="admin-player-info">
                <div class="admin-player-top-row">
                  <span class="admin-player-nick" title="${nick}">${nick}</span>
                  <span class="admin-rank-tag ${isOwner ? 'owner' : 'player'}">${isOwner ? '👑 WŁAŚCICIEL' : 'GRACZ'}</span>
                </div>
                <div class="admin-player-status" title="${status}">
                  <span class="live-dot-pulse" style="width: 6px; height: 6px;"></span>
                  <span>${status}</span>
                </div>
                <div class="admin-player-meta">
                  <span>${osIcon} ${os}</span>
                  <span>•</span>
                  <span>${ver}</span>
                  <span>•</span>
                  <span>${ram}</span>
                  <span>•</span>
                  <span>${timeAgo}</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 3. Render Server Players
    if (serverContainer) {
      const serverPlayers = serverData.sample || [];
      if (!serverData.online) {
        serverContainer.innerHTML = `<div class="admin-empty-state">Serwer Szkolne SMP jest aktualnie wyłączony lub restartowany.</div>`;
      } else if (!serverPlayers.length) {
        serverContainer.innerHTML = `<div class="admin-empty-state">Brak zalogowanych graczy na serwerze Szkolne SMP (0/${sMax}).</div>`;
      } else {
        serverContainer.innerHTML = serverPlayers.map(nick => {
          const cleanNick = escapeHtml(nick);
          return `
            <div class="admin-player-card">
              <div class="admin-player-avatar-wrap">
                <img src="https://mc-heads.net/avatar/${encodeURIComponent(cleanNick)}/48" alt="${cleanNick}" onerror="this.src='assets/default-skin.png'">
              </div>
              <div class="admin-player-info">
                <div class="admin-player-top-row">
                  <span class="admin-player-nick" title="${cleanNick}">${cleanNick}</span>
                  <span class="admin-rank-tag player">SERWER SMP</span>
                </div>
                <div class="admin-player-status" style="color: #38BDF8;">
                  <span>🌐 Zalogowany na mc.szkolnesmp.com.pl</span>
                </div>
                <div class="admin-player-meta">
                  <span>W świecie gry</span>
                  <span>•</span>
                  <span>Online</span>
                </div>
              </div>
            </div>
          `;
        }).join('');
      }
    }

  } catch (err) {
    if (launcherContainer) {
      launcherContainer.innerHTML = `<div class="admin-empty-state" style="color: #EF4444;">Błąd połączenia: ${escapeHtml(err.message)}</div>`;
    }
  }
}

async function loadAccount() {
  try {
    currentAccount = await window.api.getActiveAccount();
    await applyAccountToUI(currentAccount);
  } catch (err) {
    console.error('Błąd odczytu konta:', err);
    await applyAccountToUI(null);
  }
}

function syncSkinVariantButtons() {
  const btnClassic = document.getElementById('skin-variant-classic');
  const btnSlim = document.getElementById('skin-variant-slim');
  btnClassic?.classList.toggle('active', currentSkinVariant !== 'SLIM');
  btnSlim?.classList.toggle('active', currentSkinVariant === 'SLIM');
}

function updateWardrobeSkinSyncBanner() {
  const titleEl = document.getElementById('wardrobe-skin-sync-title');
  const descEl = document.getElementById('wardrobe-skin-sync-desc');
  const btnCsl = document.getElementById('btn-wardrobe-install-csl');
  if (!titleEl || !descEl) return;

  if (currentAccount?.isPremium) {
    titleEl.textContent = 'Konto Microsoft Premium — zapis prosto do Minecraft';
    descEl.textContent = 'Każda zmiana skórki, modelu ramion (4px/3px) lub oficjalnej pelerynki jest wysyłana prosto na serwery Mojang i od razu widoczna w grze.';
    if (btnCsl) btnCsl.style.display = 'none';
    return;
  }

  const activeProf = typeof getActiveProfileObj === 'function' ? getActiveProfileObj() : null;
  const loader = activeProf?.loader || 'fabric';
  const isModded = loader === 'fabric' || loader === 'quilt' || loader === 'forge';
  const hasCsl = Array.isArray(installedMods) && installedMods.some(
    m => m.enabled && /customskinloader/i.test(`${m.filename || ''} ${m.name || ''} ${m.displayName || ''}`)
  );

  if (!currentAccount) {
    titleEl.textContent = 'Zaloguj się, aby zapisywać skórkę w grze';
    descEl.textContent = 'Po zalogowaniu (Microsoft lub Offline) każda zmiana skórki w Garderobie trafi bezpośrednio do gry.';
    if (btnCsl) btnCsl.style.display = 'none';
  } else if (isModded && hasCsl) {
    titleEl.textContent = 'Tryb Offline + CustomSkinLoader gotowy';
    descEl.textContent = 'Twoja skórka z Garderoby zapisuje się w folderze CustomSkinLoader i ładuje w grze na Twoim nicku.';
    if (btnCsl) btnCsl.style.display = 'none';
  } else if (isModded) {
    titleEl.textContent = 'Tryb Offline — zapis lokalny w profilu gry';
    descEl.textContent = 'Skórka zapisuje się w plikach gry. Dograj mod CustomSkinLoader obok, żeby widzieć ją na dowolnym nicku i serwerach.';
    if (btnCsl) btnCsl.style.display = 'inline-flex';
  } else {
    titleEl.textContent = 'Tryb Offline (Vanilla) — automatyczna paczka skórki';
    descEl.textContent = 'Przed uruchomieniem gry launcher automatycznie tworzy i włącza lokalną paczkę zasobów z Twoją skórką.';
    if (btnCsl) btnCsl.style.display = 'none';
  }
}

async function applyAccountToUI(account) {
  currentAccount = account;
  currentAvatarHeadDataUrl = null;
  const subTypeEl = document.getElementById('user-account-type-label');
  const quickAccEl = document.getElementById('quick-stat-account');

  if (account) {
    currentSkinVariant = (account.skinVariant || 'CLASSIC').toUpperCase() === 'SLIM' ? 'SLIM' : 'CLASSIC';
    syncSkinVariantButtons();

    elements.userNicknameText.textContent = account.username;
    if (elements.userStatusDot) {
      elements.userStatusDot.classList.add('online');
      elements.userStatusDot.style.background = '';
    }
    const isOwner = isOwnerAccount(account);
    const adminNavSec = document.getElementById('nav-section-admin');
    if (adminNavSec) {
      adminNavSec.style.display = isOwner ? 'block' : 'none';
    }
    if (!isOwner) {
      const activeNav = document.querySelector('.nav-pill.active');
      if (activeNav && activeNav.getAttribute('data-tab') === 'admin') {
        switchToTab('play');
      }
    }
    const typeLabel = isOwner ? '👑 Właściciel' : (account.isPremium ? 'Microsoft Premium' : 'Sesja Offline');
    if (subTypeEl) {
      subTypeEl.textContent = typeLabel;
      if (isOwner) {
        subTypeEl.style.color = '#F59E0B';
        subTypeEl.style.fontWeight = '700';
      } else {
        subTypeEl.style.color = '';
        subTypeEl.style.fontWeight = '';
      }
    }
    if (quickAccEl) {
      quickAccEl.textContent = typeLabel;
      if (isOwner) {
        quickAccEl.style.color = '#F59E0B';
        quickAccEl.style.fontWeight = '700';
      } else {
        quickAccEl.style.color = '';
        quickAccEl.style.fontWeight = '';
      }
    }

    const defaultSkin = getDefaultSkinForAccount(account);
    const skinToUse = account.skinUrl || account.customSkinUrl || defaultSkin;

    if (skinToUse) {
      updateSkinDisplay(skinToUse, currentSkinVariant);
      if (elements.userAvatarHead) attachPlayerHeadImg(elements.userAvatarHead, account.username, 48);
      renderSkinHeadDataUrl(skinToUse).then((headDataUrl) => {
        if (headDataUrl && currentAccount && currentAccount.username === account.username) {
          currentAvatarHeadDataUrl = headDataUrl;
          if (elements.userAvatarHead) {
            elements.userAvatarHead.onerror = null;
            elements.userAvatarHead.src = headDataUrl;
          }
          if (elements.modalAccountAvatar && elements.profileModal?.classList.contains('open')) {
            elements.modalAccountAvatar.onerror = null;
            elements.modalAccountAvatar.src = headDataUrl;
          }
          const s2Img = document.getElementById('s2-avatar-img');
          if (s2Img) {
            s2Img.onerror = null;
            s2Img.src = headDataUrl;
          }
        }
      });
    } else {
      updateSkinDisplay(defaultSkin, currentSkinVariant);
      if (elements.userAvatarHead) elements.userAvatarHead.src = defaultHeadDataUrl;
    }

    renderAccountCapes(account);
  } else {
    currentSkinVariant = 'CLASSIC';
    syncSkinVariantButtons();
    elements.userNicknameText.textContent = 'Zaloguj się';
    if (elements.userStatusDot) {
      elements.userStatusDot.classList.remove('online');
      elements.userStatusDot.style.background = '#F59E0B';
    }
    if (subTypeEl) subTypeEl.textContent = 'Kliknij, aby połączyć';
    if (quickAccEl) quickAccEl.textContent = 'Wymagane logowanie';
    if (elements.userAvatarHead) elements.userAvatarHead.src = defaultHeadDataUrl;
    updateSkinDisplay('assets/default-skin.png', 'CLASSIC');
  }
  updateWardrobeSkinSyncBanner();
  syncS2ProfileWidget();
}

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

elements.btnCloseProfileModal.addEventListener('click', closeProfileModal);

elements.btnProfileChangeNick.addEventListener('click', async () => {
  const newNick = elements.profileNewUsernameInput.value.trim();
  if (!newNick) {
    showToast('Wpisz nick gracza Minecraft.');
    return;
  }
  showToast(currentAccount?.isPremium
    ? `Pobieranie skórki gracza ${newNick} i wysyłanie na konto Microsoft...`
    : `Pobieranie skórki Minecraft dla ${newNick}...`);
  try {
    const updated = await window.api.setUsername(newNick);
    await applyAccountToUI(updated);
    elements.modalAccountName.textContent = updated.username;
    elements.modalAccountUuid.textContent = `UUID: ${updated.uuid}`;
    if (currentAvatarHeadDataUrl) {
      elements.modalAccountAvatar.onerror = null;
      elements.modalAccountAvatar.src = currentAvatarHeadDataUrl;
    } else {
      attachPlayerHeadImg(elements.modalAccountAvatar, updated.username, 48);
    }
    showToast(updated.isPremium
      ? `Wgrano skórkę gracza ${newNick} na Twoje konto Microsoft!`
      : `Ustawiono nick ${updated.username} i zapisano skórkę w grze!`);
  } catch (err) {
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    showToast(`Błąd: ${cleanErr}`);
  }
});

elements.profileNewUsernameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    elements.btnProfileChangeNick.click();
  }
});

elements.btnUploadSkinFile.addEventListener('click', async () => {
  try {
    const updated = await window.api.selectSkinFile(currentSkinVariant);
    if (updated) {
      await applyAccountToUI(updated);
      showToast(updated.isPremium
        ? 'Wysłano własną skórkę .png na konto Microsoft!'
        : 'Zapisano własną skórkę .png w plikach gry!');
    }
  } catch (err) {
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    showToast(`Błąd wczytywania skórki: ${cleanErr}`);
  }
});

elements.btnResetDefaultSkin.addEventListener('click', async () => {
  try {
    currentSkinVariant = 'CLASSIC';
    syncSkinVariantButtons();
    const defaultSkin = getDefaultSkinForAccount(currentAccount);
    const updated = await window.api.setCustomSkin(defaultSkin, 'CLASSIC');
    await applyAccountToUI(updated);
    showToast(updated?.isPremium
      ? 'Wysłano domyślną skórkę na konto Microsoft.'
      : 'Przywrócono domyślną skórkę w grze.');
  } catch (err) {
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    showToast(`Błąd: ${cleanErr}`);
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
    closeProfileEditorModal();
    document.getElementById('mod-version-modal')?.classList.remove('open', 'active');
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
  if (currentAvatarHeadDataUrl) {
    elements.modalAccountAvatar.onerror = null;
    elements.modalAccountAvatar.src = currentAvatarHeadDataUrl;
  } else {
    attachPlayerHeadImg(elements.modalAccountAvatar, currentAccount.username, 48);
  }
  elements.profileNewUsernameInput.value = currentAccount.username;

  if (isOwnerAccount(currentAccount)) {
    elements.modalAccountBadge.innerHTML = `
      <span style="color: #F59E0B; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">👑 Właściciel</span>
      <span style="color: var(--text-muted); font-size: 11px;">• ${currentAccount.isPremium ? 'Microsoft Premium' : 'Offline'}</span>
    `;
    elements.modalAccountBadge.style.color = '#F59E0B';
    if (elements.profileStatRank) {
      elements.profileStatRank.innerHTML = '<span style="color: #F59E0B; font-weight: 700;">👑 Właściciel</span>';
    }
  } else if (currentAccount.isPremium) {
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

  if (window.api?.getStats) {
    window.api.getStats().then(s => updateStatsUI(s)).catch(() => {});
  }

  if (elements.profileModal) elements.profileModal.classList.add('open');
}

function closeProfileModal() {
  if (elements.profileModal) elements.profileModal.classList.remove('open');
}

let installedMods = [];
let localModFilterQuery = '';
let currentPackType = 'resourcepacks';
let installedPacks = [];

function updateModCounters(mods) {
  const list = Array.isArray(mods) ? mods : [];
  const activeCount = list.filter(m => m.enabled).length;
  const sidebarBadge = document.getElementById('sidebar-mods-badge');
  const subtabBadge = document.getElementById('mods-subtab-badge');
  const quickMods = document.getElementById('quick-stat-mods');
  const summaryTag = document.getElementById('mods-summary-counter');

  if (sidebarBadge) sidebarBadge.textContent = String(activeCount);
  if (subtabBadge) subtabBadge.textContent = String(activeCount);
  if (quickMods) quickMods.textContent = `${activeCount} aktywnych`;
  if (summaryTag) summaryTag.textContent = `${activeCount} / ${list.length} aktywnych`;
}

async function loadMods() {
  try {
    installedMods = await window.api.getModsList();
    renderModsList(installedMods);
    updateWardrobeSkinSyncBanner();
  } catch (err) {
    console.error('Błąd ładowania modów:', err);
  }
}

function renderModsList(mods) {
  updateModCounters(mods);
  renderS2QuickModsWidget(mods);
  if (!elements.modsListContainer) return;
  elements.modsListContainer.innerHTML = '';

  const allMods = Array.isArray(mods) ? mods : [];
  const q = localModFilterQuery.trim().toLowerCase();
  const filtered = q
    ? allMods.filter(m =>
        (m.displayName || m.name || '').toLowerCase().includes(q) ||
        (m.filename || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q)
      )
    : allMods;

  if (allMods.length === 0) {
    elements.modsListContainer.innerHTML = `
      <div class="empty-state-box">
        <div class="friends-empty-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        </div>
        <div class="setting-title" style="font-size: 14px;">Brak zainstalowanych modów</div>
        <div class="setting-desc" style="max-width: 400px;">Dodaj pliki .jar z dysku, przeciągnij je na okno lub pobierz gotowe mody z zakładki Modrinth.</div>
        <button class="btn-primary" id="btn-empty-add-mods" style="margin-top: 6px;">Dodaj mody (.jar)</button>
      </div>
    `;
    document.getElementById('btn-empty-add-mods')?.addEventListener('click', () => {
      elements.btnAddMods?.click();
    });
    return;
  }

  if (filtered.length === 0) {
    const safeQuery = (typeof escapeHtml === 'function' ? escapeHtml(localModFilterQuery) : localModFilterQuery);
    elements.modsListContainer.innerHTML = `
      <div class="empty-state-box">
        <div class="setting-title">Brak wyników filtrowania</div>
        <div class="setting-desc">Żaden mod zainstalowany lokalnie nie pasuje do frazy „${safeQuery}”.</div>
        <button class="btn-primary" id="btn-search-modrinth-fallback" style="margin-top: 10px; display: inline-flex; align-items: center; gap: 6px;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <span>Wyszukaj „${safeQuery}” w katalogu Modrinth</span>
        </button>
      </div>
    `;
    document.getElementById('btn-search-modrinth-fallback')?.addEventListener('click', () => {
      if (typeof window.switchModsSubtab === 'function') {
        window.switchModsSubtab('modrinth');
      }
      const searchInput = document.getElementById('mod-browse-search-input');
      if (searchInput) {
        searchInput.value = localModFilterQuery;
        const clearBtn = document.getElementById('mod-browse-search-clear');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
      }
      loadModrinthMods(false);
    });
    return;
  }

  filtered.forEach(mod => {
    const card = document.createElement('div');
    card.className = `mod-row-card ${mod.enabled ? '' : 'is-disabled'}`;

    const thumbHtml = mod.iconDataUrl
      ? `<img src="${mod.iconDataUrl}" alt="">`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`;

    const titleText = mod.displayName || mod.name;
    const versionBadge = mod.version ? `<span class="mod-tag tnum">v${String(mod.version).replace(/^v/i, '')}</span>` : '';
    const statusBadge = mod.enabled
      ? `<span class="mod-tag status-on">Aktywny</span>`
      : `<span class="mod-tag status-off">Wyłączony</span>`;
    const subLine = mod.description
      ? `${mod.description} • ${mod.size}`
      : `${mod.filename} • ${mod.size}`;

    card.innerHTML = `
      <div class="mod-row-left">
        <div class="mod-row-thumb">${thumbHtml}</div>
        <div class="mod-row-info">
          <div class="mod-row-title-line">
            <span class="mod-row-name">${titleText}</span>
            ${versionBadge}
            ${statusBadge}
          </div>
          <span class="mod-row-sub tnum">${subLine}</span>
        </div>
      </div>

      <div class="mod-row-actions">
        <input type="checkbox" class="ui-switch mod-toggle" data-filename="${mod.filename}" ${mod.enabled ? 'checked' : ''} title="Włącz / Wyłącz mod">
        <button class="btn-icon-only mod-delete-btn" data-filename="${mod.filename}" title="Usuń mod">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>
    `;

    const toggle = card.querySelector('.mod-toggle');
    toggle?.addEventListener('change', async () => {
      try {
        const updated = await window.api.toggleMod(mod.filename);
        installedMods = updated;
        renderModsList(installedMods);
        loadProfiles();
        showToast(toggle.checked ? `Włączono mod: ${titleText}` : `Wyłączono mod: ${titleText}`);
      } catch (err) {
        showToast(`Błąd: ${err.message}`);
      }
    });

    const deleteBtn = card.querySelector('.mod-delete-btn');
    deleteBtn?.addEventListener('click', async () => {
      if (confirm(`Czy na pewno chcesz usunąć mod "${titleText}"?`)) {
        try {
          const updated = await window.api.deleteMod(mod.filename);
          installedMods = updated;
          renderModsList(installedMods);
          loadProfiles();
          showToast(`Usunięto mod: ${titleText}`);
        } catch (err) {
          showToast(`Błąd: ${err.message}`);
        }
      }
    });

    elements.modsListContainer.appendChild(card);
  });
}

function setupModsListeners() {
  const localSearch = document.getElementById('mods-local-search');
  const localClear = document.getElementById('mods-local-search-clear');
  const modsDropBanner = document.getElementById('mods-dropzone-banner');

  const localSearchBox = localSearch?.closest('.search-box');
  localSearchBox?.addEventListener('click', (e) => {
    if (e.target.id === 'mods-local-search-clear') return;
    localSearch?.focus();
  });

  localSearch?.addEventListener('input', () => {
    localModFilterQuery = localSearch.value || '';
    if (localClear) localClear.style.display = localModFilterQuery.trim() ? 'inline-flex' : 'none';
    renderModsList(installedMods);
  });

  localClear?.addEventListener('click', () => {
    localModFilterQuery = '';
    if (localSearch) localSearch.value = '';
    localClear.style.display = 'none';
    renderModsList(installedMods);
  });

  elements.btnAddMods?.addEventListener('click', async () => {
    try {
      const res = await window.api.addModFiles();
      if (res && res.added > 0) {
        installedMods = res.mods;
        renderModsList(installedMods);
        loadProfiles();
        showToast(`Pomyślnie dodano ${res.added} mod(ów)`);
      }
    } catch (err) {
      showToast(`Błąd dodawania modów: ${err.message}`);
    }
  });

  elements.btnOpenModsFolder?.addEventListener('click', async () => {
    try {
      await window.api.openModsFolder();
      showToast('Otwarto folder mods');
    } catch (err) {
      showToast(`Błąd: ${err.message}`);
    }
  });

  elements.btnInstallFabric?.addEventListener('click', async () => {
    const activeProf = getActiveProfileObj();
    const baseVer = activeProf?.mcVersion || (currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
    showToast(`Instalacja Fabric Loader dla Minecraft ${baseVer}...`);

    try {
      const res = await window.api.installFabric(baseVer);
      if (activeProf && activeProf.loader !== 'fabric') {
        await window.api.updateProfile?.(activeProf.id, { loader: 'fabric' });
      }
      await loadProfiles();
      showToast(`Zainstalowano Fabric Loader ${res.loaderVersion} (${res.minecraftVersion})`);
      appendLog(`[Fabric] Zainstalowano pomyślnie wersję ${res.versionId}.`);
    } catch (err) {
      showToast(`Błąd instalacji Fabric: ${err.message}`);
    }
  });

  elements.btnInstallSodium?.addEventListener('click', async () => {
    const activeProf = getActiveProfileObj();
    const baseVer = activeProf?.mcVersion || (currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
    showToast(`Pobieranie modu Sodium dla Minecraft ${baseVer}...`);
    try {
      const res = await window.api.installSodium(baseVer);
      installedMods = res.mods;
      renderModsList(installedMods);
      if (activeProf && activeProf.loader === 'vanilla') {
        await window.api.updateProfile?.(activeProf.id, { loader: 'fabric' });
      }
      await loadProfiles();
      showToast(`Zainstalowano Sodium w profilu ${activeProf?.name || baseVer}`);
    } catch (err) {
      showToast(`Błąd instalacji Sodium: ${err.message}`);
    }
  });

  const btnUpdateAllMods = document.getElementById('btn-update-all-mods');
  btnUpdateAllMods?.addEventListener('click', async () => {
    const activeProf = getActiveProfileObj();
    if (activeProf?.loader === 'vanilla') {
      showToast('Profil Vanilla nie używa modów .jar.');
      return;
    }
    const baseVer = activeProf?.mcVersion || (currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
    const loader = activeProf?.loader === 'quilt' ? 'quilt' : (activeProf?.loader === 'forge' ? 'forge' : 'fabric');
    const origHtml = btnUpdateAllMods.innerHTML;
    btnUpdateAllMods.disabled = true;
    btnUpdateAllMods.innerHTML = `<span class="spinner-ring" style="width: 13px; height: 13px;"></span><span>Sprawdzanie...</span>`;
    try {
      const res = await window.api.updateInstalledMods({ gameVersion: baseVer, loader });
      installedMods = res.mods || installedMods;
      renderModsList(installedMods);
      updateWardrobeSkinSyncBanner();
      await loadProfiles();
      if (res.updatedCount > 0) {
        showToast(`Zaktualizowano ${res.updatedCount} z ${res.checkedCount} modów do najnowszej wersji!`);
      } else if (res.checkedCount > 0) {
        showToast(`Wszystkie wgrane mody (${res.checkedCount}) są już aktualne.`);
      } else {
        showToast('Brak zainstalowanych modów .jar w tym profilu.');
      }
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd aktualizacji modów: ${cleanErr}`);
    } finally {
      btnUpdateAllMods.disabled = false;
      btnUpdateAllMods.innerHTML = origHtml;
    }
  });

  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    modsDropBanner?.classList.add('dragover');
    document.getElementById('packs-dropzone')?.classList.add('dragover');
  });

  window.addEventListener('dragleave', () => {
    modsDropBanner?.classList.remove('dragover');
    document.getElementById('packs-dropzone')?.classList.remove('dragover');
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    modsDropBanner?.classList.remove('dragover');
    document.getElementById('packs-dropzone')?.classList.remove('dragover');

    if (!e.dataTransfer || e.dataTransfer.files.length === 0) return;
    const files = Array.from(e.dataTransfer.files);

    const mrpackPaths = files.filter(f => f.name.toLowerCase().endsWith('.mrpack')).map(f => f.path);
    if (mrpackPaths.length > 0) {
      await handleImportMrpack(mrpackPaths[0]);
      return;
    }

    const jarPaths = files.filter(f => f.name.toLowerCase().endsWith('.jar')).map(f => f.path);
    const zipPaths = files.filter(f => f.name.toLowerCase().endsWith('.zip')).map(f => f.path);

    if (jarPaths.length > 0) {
      try {
        const res = await window.api.copyModFiles(jarPaths);
        if (res && res.added > 0) {
          installedMods = res.mods;
          renderModsList(installedMods);
          updateWardrobeSkinSyncBanner();
          loadProfiles();
          showToast(`Zaimportowano ${res.added} mod(ów) .jar`);
        }
      } catch (err) {
        showToast(`Błąd importu .jar: ${err.message}`);
      }
    }

    if (zipPaths.length > 0 && window.api?.copyPackFiles) {
      try {
        const res = await window.api.copyPackFiles(currentPackType, zipPaths);
        if (res && res.added > 0) {
          installedPacks = res.packs;
          renderPacksList(installedPacks);
          const label = currentPackType === 'shaderpacks' ? 'shaderów' : 'pakietów zasobów';
          showToast(`Zaimportowano ${res.added} ${label} (.zip)`);
        }
      } catch (err) {
        showToast(`Błąd importu .zip: ${err.message}`);
      }
    }
  });
}

// ============================================================================
// ============================================================================
async function loadPacks(type = currentPackType) {
  currentPackType = type;
  if (!window.api?.getPacksList) return;
  try {
    installedPacks = await window.api.getPacksList(currentPackType);
    renderPacksList(installedPacks);
  } catch (err) {
    console.warn('Błąd ładowania paczek:', err);
  }
}

function renderPacksList(packs) {
  const container = document.getElementById('packs-list-container');
  if (!container) return;
  container.innerHTML = '';

  const isShader = currentPackType === 'shaderpacks';
  if (!packs || packs.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box" style="grid-column: 1 / -1;">
        <div class="friends-empty-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
        </div>
        <div class="setting-title" style="font-size: 14px;">Brak zainstalowanych ${isShader ? 'shaderów' : 'pakietów zasobów'}</div>
        <div class="setting-desc" style="max-width: 420px;">Przeciągnij archiwa .zip w strefę powyżej lub kliknij „Dodaj paczkę .zip”, aby zainstalować ${isShader ? 'shadery Iris' : 'paczki tekstur'}.</div>
      </div>
    `;
    return;
  }

  packs.forEach(pack => {
    const card = document.createElement('div');
    card.className = `pack-card ${pack.enabled ? '' : 'is-disabled'}`;

    const thumbHtml = pack.iconDataUrl
      ? `<img src="${pack.iconDataUrl}" alt="">`
      : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;

    const formatTag = pack.packFormat ? `<span class="mod-tag tnum">Format ${pack.packFormat}</span>` : '';
    const statusTag = pack.enabled
      ? `<span class="mod-tag status-on">Włączony</span>`
      : `<span class="mod-tag status-off">Wyłączony</span>`;

    card.innerHTML = `
      <div class="pack-thumb">${thumbHtml}</div>
      <div class="pack-body">
        <div class="pack-title" title="${pack.name}">${pack.name}</div>
        <div class="pack-desc" title="${pack.description || ''}">${pack.description || ''}</div>
        <div class="pack-meta-row">
          ${statusTag}
          ${formatTag}
          <span class="mod-tag tnum">${pack.size}</span>
        </div>
      </div>
      <div class="mod-row-actions">
        <input type="checkbox" class="ui-switch pack-toggle" ${pack.enabled ? 'checked' : ''} title="Włącz / Wyłącz paczkę">
        <button class="btn-icon-only pack-delete-btn" title="Usuń paczkę">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;

    card.querySelector('.pack-toggle')?.addEventListener('change', async (e) => {
      try {
        installedPacks = await window.api.togglePack(currentPackType, pack.filename);
        renderPacksList(installedPacks);
        showToast(e.target.checked ? `Włączono: ${pack.name}` : `Wyłączono: ${pack.name}`);
      } catch (err) {
        showToast(`Błąd: ${err.message}`);
      }
    });

    card.querySelector('.pack-delete-btn')?.addEventListener('click', async () => {
      if (confirm(`Usunąć paczkę "${pack.name}"?`)) {
        try {
          installedPacks = await window.api.deletePack(currentPackType, pack.filename);
          renderPacksList(installedPacks);
          showToast(`Usunięto: ${pack.name}`);
        } catch (err) {
          showToast(`Błąd: ${err.message}`);
        }
      }
    });

    container.appendChild(card);
  });
}

let currentPacksMode = 'installed';
let currentPacksModrinthOffset = 0;
const PACKS_MODRINTH_PAGE_SIZE = 30;
let currentPacksModrinthTotalHits = 0;
let currentPacksModrinthHits = [];
let packsSearchTimeout = null;

function isPackAlreadyInstalled(hit) {
  if (!Array.isArray(installedPacks) || installedPacks.length === 0) return false;
  const slugClean = String(hit.slug || '').toLowerCase().replace(/[-_\s]/g, '');
  const titleClean = String(hit.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return installedPacks.some((p) => {
    const fn = String(p.filename || '').toLowerCase().replace(/[-_\s]/g, '');
    const nm = String(p.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return (slugClean && slugClean.length > 2 && fn.includes(slugClean))
      || (titleClean && titleClean.length > 3 && (fn.includes(titleClean) || nm.includes(titleClean)));
  });
}

async function loadModrinthPacks(append = false) {
  const searchInput = document.getElementById('packs-modrinth-search-input');
  const sortSelect = document.getElementById('packs-modrinth-sort-select');
  const verLock = document.getElementById('packs-modrinth-ver-lock');
  const resultsContainer = document.getElementById('packs-modrinth-results');
  const loadingEl = document.getElementById('packs-modrinth-loading');
  const hitsCountEl = document.getElementById('packs-modrinth-hits-count');
  const loadMoreBtn = document.getElementById('btn-packs-modrinth-load-more');
  const paginationWrap = document.getElementById('packs-modrinth-pagination-wrap');

  if (!resultsContainer) return;

  if (!append) {
    currentPacksModrinthOffset = 0;
    currentPacksModrinthHits = [];
    if (loadingEl) loadingEl.style.display = 'flex';
    resultsContainer.style.opacity = '0.35';
    if (paginationWrap) paginationWrap.style.display = 'none';
  } else if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = `<span class="spinner-ring" style="width: 14px; height: 14px;"></span><span>Ładowanie kolejnych...</span>`;
  }

  const query = searchInput?.value.trim() || '';
  const sort = sortSelect?.value || 'downloads';
  const activeMcVer = (getActiveProfileObj()?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
  const onlyCurrent = verLock ? verLock.checked : true;

  const verLockLabel = verLock?.parentElement?.querySelector('span');
  if (verLockLabel) {
    verLockLabel.textContent = `Tylko wersja profilu (${activeMcVer})`;
  }
  const projectType = currentPackType === 'shaderpacks' ? 'shader' : 'resourcepack';

  try {
    const res = await window.api.searchModrinth({
      query,
      projectType,
      gameVersion: activeMcVer,
      sort,
      onlyCurrentVersion: onlyCurrent,
      limit: PACKS_MODRINTH_PAGE_SIZE,
      offset: currentPacksModrinthOffset
    });

    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';

    currentPacksModrinthTotalHits = res.total_hits || 0;
    const incomingHits = res.hits || [];
    currentPacksModrinthHits = append ? currentPacksModrinthHits.concat(incomingHits) : incomingHits;

    if (hitsCountEl) {
      const label = currentPackType === 'shaderpacks' ? 'shaderów' : 'paczek zasobów';
      hitsCountEl.textContent = `Znaleziono: ${currentPacksModrinthTotalHits.toLocaleString('pl-PL')} ${label} (wyświetlono: ${currentPacksModrinthHits.length})`;
    }

    renderModrinthPacksResults(incomingHits, append);

    if (paginationWrap) {
      if (currentPacksModrinthHits.length < currentPacksModrinthTotalHits) {
        paginationWrap.style.display = 'flex';
        if (loadMoreBtn) {
          loadMoreBtn.disabled = false;
          loadMoreBtn.innerHTML = `<span>Załaduj więcej (+${PACKS_MODRINTH_PAGE_SIZE})</span>`;
        }
      } else {
        paginationWrap.style.display = 'none';
      }
    }
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';
    if (!append) {
      resultsContainer.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <div class="setting-title" style="color: #F87171;">Błąd pobierania z Modrinth</div>
          <div class="setting-desc">${err.message || 'Nie udało się załadować katalogu.'}</div>
        </div>
      `;
    } else {
      showToast(`Błąd ładowania: ${err.message}`);
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = `<span>Spróbuj ponownie</span>`;
      }
    }
  }
}

function renderModrinthPacksResults(hitsToRender, append = false) {
  const resultsContainer = document.getElementById('packs-modrinth-results');
  if (!resultsContainer) return;
  if (!append) resultsContainer.innerHTML = '';

  const isShader = currentPackType === 'shaderpacks';
  if ((!hitsToRender || hitsToRender.length === 0) && !append) {
    resultsContainer.innerHTML = `
      <div class="empty-state-box" style="grid-column: 1 / -1;">
        <div class="setting-title">Brak wyników</div>
        <div class="setting-desc">Nie znaleziono ${isShader ? 'shaderów' : 'pakietów zasobów'} dla wybranych filtrów. Spróbuj zmienić frazę lub wyłączyć filtr wersji profilu.</div>
      </div>
    `;
    return;
  }

  const activeMcVer = (getActiveProfileObj()?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');

  hitsToRender.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'modrinth-card';
    const installed = isPackAlreadyInstalled(item);
    const iconUrl = item.icon_url || 'assets/logo.svg';
    const downloadsFmt = formatDownloads(item.downloads);
    const badgeLabel = isShader ? 'Shader' : 'Tekstury';

    card.innerHTML = `
      <div class="modrinth-card-top">
        <img src="${iconUrl}" class="modrinth-card-icon" alt="${item.title}" onerror="this.src='assets/logo.svg'">
        <div class="modrinth-card-head">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
            <div class="modrinth-card-title" title="${item.title}">${item.title}</div>
            <span class="mod-tag">${badgeLabel}</span>
          </div>
          <div class="modrinth-card-author">Autor: ${item.author || 'Społeczność'}</div>
          <div class="modrinth-card-desc" title="${item.description || ''}">${item.description || ''}</div>
        </div>
      </div>

      <div class="modrinth-card-footer">
        <div class="modrinth-stats tnum">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${downloadsFmt}</span>
          ${item.versions && item.versions.length > 0 ? `<span class="mod-tag">MC ${item.versions[item.versions.length - 1]}</span>` : ''}
        </div>

        ${installed ? `
          <button class="btn-modrinth-install installed" disabled>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Wgrano</span>
          </button>
        ` : `
          <button class="btn-modrinth-install btn-pack-download">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Pobierz</span>
          </button>
        `}
      </div>
    `;

    const dlBtn = card.querySelector('.btn-pack-download');
    dlBtn?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      dlBtn.disabled = true;
      dlBtn.classList.add('installing');
      dlBtn.innerHTML = `<span class="spinner-ring" style="width: 13px; height: 13px;"></span><span>Pobieranie...</span>`;

      try {
        const activeProf = getActiveProfileObj();
        const res = await window.api.installModrinthPack({
          projectId: item.project_id || item.id,
          slug: item.slug,
          packType: currentPackType,
          gameVersion: activeMcVer,
          loader: activeProf?.loader || 'fabric'
        });
        if (res?.packs) {
          installedPacks = res.packs;
          renderPacksList(installedPacks);
        }
        if (Array.isArray(res?.autoInstalledMods) && res.autoInstalledMods.length > 0) {
          await loadMods();
          await loadProfiles();
          showToast(`Pobrano ${item.title} oraz automatycznie dograno: ${res.autoInstalledMods.join(', ')}!`);
        } else {
          showToast(`Pobrano i włączono: ${item.title}!`);
        }
        dlBtn.className = 'btn-modrinth-install installed';
        dlBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg><span>Wgrano</span>`;
      } catch (dlErr) {
        const cleanErr = (dlErr.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
        showToast(`Błąd pobierania paczki: ${cleanErr}`);
        dlBtn.disabled = false;
        dlBtn.className = 'btn-modrinth-install btn-pack-download';
        dlBtn.innerHTML = `<span>Ponów</span>`;
      }
    });

    resultsContainer.appendChild(card);
  });
}

function setupPacksListeners() {
  const btnRes = document.getElementById('packs-subtab-resourcepacks');
  const btnSha = document.getElementById('packs-subtab-shaderpacks');
  const btnModeInstalled = document.getElementById('packs-mode-installed');
  const btnModeModrinth = document.getElementById('packs-mode-modrinth');
  const wrapInstalled = document.getElementById('packs-view-installed-wrap');
  const wrapModrinth = document.getElementById('packs-view-modrinth-wrap');
  const dropTitle = document.getElementById('packs-dropzone-title');
  const btnAdd = document.getElementById('btn-add-packs');
  const btnOpen = document.getElementById('btn-open-packs-folder');

  const searchInput = document.getElementById('packs-modrinth-search-input');
  const clearBtn = document.getElementById('packs-modrinth-search-clear');
  const searchBtn = document.getElementById('btn-packs-modrinth-search');
  const sortSelect = document.getElementById('packs-modrinth-sort-select');
  const verLock = document.getElementById('packs-modrinth-ver-lock');
  const loadMoreBtn = document.getElementById('btn-packs-modrinth-load-more');
  const modrinthHint = document.getElementById('packs-modrinth-hint');

  const syncModrinthLabels = () => {
    const isShader = currentPackType === 'shaderpacks';
    if (searchInput) {
      searchInput.placeholder = isShader
        ? 'Szukaj shaderów (np. Complementary, BSL, MakeUp Ultra Fast, Rethinking Voxels)...'
        : 'Szukaj paczek zasobów (np. Faithful, Bare Bones, Fresh Animations)...';
    }
    if (modrinthHint) {
      modrinthHint.textContent = isShader
        ? 'Przeglądasz shadery z Modrinth. Na profilu Fabric/Quilt launcher sam dogra Sodium + Iris, jeśli ich brakuje.'
        : 'Przeglądasz pakiety zasobów (tekstury) z Modrinth. Pobrana paczka od razu włącza się w grze.';
    }
  };

  const switchPacksMode = (mode) => {
    currentPacksMode = mode;
    btnModeInstalled?.classList.toggle('active', mode === 'installed');
    btnModeModrinth?.classList.toggle('active', mode === 'modrinth');
    if (wrapInstalled) wrapInstalled.style.display = mode === 'installed' ? 'block' : 'none';
    if (wrapModrinth) wrapModrinth.style.display = mode === 'modrinth' ? 'block' : 'none';
    syncModrinthLabels();
    if (mode === 'modrinth') {
      loadPacks(currentPackType).then(() => loadModrinthPacks(false));
    } else {
      loadPacks(currentPackType);
    }
  };

  const switchPackTab = (type) => {
    currentPackType = type;
    btnRes?.classList.toggle('active', type === 'resourcepacks');
    btnSha?.classList.toggle('active', type === 'shaderpacks');
    if (dropTitle) {
      dropTitle.textContent = type === 'shaderpacks'
        ? 'Przeciągnij i upuść paczki shaderów Iris (.zip)'
        : 'Przeciągnij i upuść pakiety zasobów (.zip)';
    }
    syncModrinthLabels();
    if (currentPacksMode === 'modrinth') {
      loadPacks(type).then(() => loadModrinthPacks(false));
    } else {
      loadPacks(type);
    }
  };

  btnRes?.addEventListener('click', () => switchPackTab('resourcepacks'));
  btnSha?.addEventListener('click', () => switchPackTab('shaderpacks'));
  btnModeInstalled?.addEventListener('click', () => switchPacksMode('installed'));
  btnModeModrinth?.addEventListener('click', () => switchPacksMode('modrinth'));

  searchInput?.closest('.search-box')?.addEventListener('click', (e) => {
    if (e.target.id === 'packs-modrinth-search-clear') return;
    searchInput?.focus();
  });

  searchInput?.addEventListener('input', () => {
    const val = searchInput.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
    clearTimeout(packsSearchTimeout);
    packsSearchTimeout = setTimeout(() => loadModrinthPacks(false), 350);
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(packsSearchTimeout);
      loadModrinthPacks(false);
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    clearBtn.style.display = 'none';
    loadModrinthPacks(false);
  });

  searchBtn?.addEventListener('click', () => {
    clearTimeout(packsSearchTimeout);
    loadModrinthPacks(false);
  });

  sortSelect?.addEventListener('change', () => loadModrinthPacks(false));
  verLock?.addEventListener('change', () => loadModrinthPacks(false));
  loadMoreBtn?.addEventListener('click', () => {
    currentPacksModrinthOffset += PACKS_MODRINTH_PAGE_SIZE;
    loadModrinthPacks(true);
  });

  btnAdd?.addEventListener('click', async () => {
    try {
      const res = await window.api.addPackFiles(currentPackType);
      if (res && res.added > 0) {
        installedPacks = res.packs;
        renderPacksList(installedPacks);
        showToast(`Dodano ${res.added} paczkę/paczek (.zip)`);
      }
    } catch (err) {
      showToast(`Błąd: ${err.message}`);
    }
  });

  btnOpen?.addEventListener('click', async () => {
    try {
      await window.api.openPacksFolder(currentPackType);
      showToast(`Otwarto katalog ${currentPackType}`);
    } catch (err) {
      showToast(`Błąd: ${err.message}`);
    }
  });
}

// ============================================================================
// ============================================================================

let hasLoadedModBrowseOnce = false;
let currentModBrowseType = 'all';
let currentModCategory = 'all';
let currentModBrowseLoader = 'all';
let currentModBrowseOffset = 0;
const MOD_BROWSE_PAGE_SIZE = 30;
let currentModBrowseTotalHits = 0;
let currentModBrowseHits = [];
let modSearchTimeout = null;
let currentModpackModalData = null;

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
  const searchBtn = document.getElementById('btn-mod-browse-search');
  const sortSelect = document.getElementById('mod-browse-sort-select');
  const loaderSelect = document.getElementById('mod-browse-loader-select');
  const verLock = document.getElementById('mod-browse-ver-lock');
  const chipsContainer = document.getElementById('mod-categories-chips');
  const loadMoreBtn = document.getElementById('btn-mod-browse-load-more');
  const typeSwitchAll = document.getElementById('modrinth-type-all');
  const typeSwitchMod = document.getElementById('modrinth-type-mod');
  const typeSwitchModpack = document.getElementById('modrinth-type-modpack');

  const searchBox = searchInput?.closest('.search-box');
  searchBox?.addEventListener('click', (e) => {
    if (e.target.id === 'mod-browse-search-clear') return;
    searchInput?.focus();
  });

  typeSwitchAll?.addEventListener('click', () => {
    if (currentModBrowseType === 'all') return;
    currentModBrowseType = 'all';
    typeSwitchAll.classList.add('active');
    typeSwitchMod?.classList.remove('active');
    typeSwitchModpack?.classList.remove('active');
    if (chipsContainer) chipsContainer.style.display = 'flex';
    if (searchInput) searchInput.placeholder = 'Szukaj modów i modpacków (np. Sodium, Fabulously Optimized, Zombie Invade)...';
    loadModrinthMods(false);
  });

  typeSwitchMod?.addEventListener('click', () => {
    if (currentModBrowseType === 'mod') return;
    currentModBrowseType = 'mod';
    typeSwitchMod.classList.add('active');
    typeSwitchAll?.classList.remove('active');
    typeSwitchModpack?.classList.remove('active');
    if (chipsContainer) chipsContainer.style.display = 'flex';
    if (searchInput) searchInput.placeholder = 'Szukaj modów na Modrinth (np. Sodium, Iris, Zoomify, ReplayMod)...';
    loadModrinthMods(false);
  });

  typeSwitchModpack?.addEventListener('click', () => {
    if (currentModBrowseType === 'modpack') return;
    currentModBrowseType = 'modpack';
    typeSwitchModpack.classList.add('active');
    typeSwitchAll?.classList.remove('active');
    typeSwitchMod?.classList.remove('active');
    if (chipsContainer) chipsContainer.style.display = 'none';
    if (searchInput) searchInput.placeholder = 'Szukaj modpacków na Modrinth (np. Fabulously Optimized, Cobblemon, Better MC)...';
    loadModrinthMods(false);
  });

  searchInput?.addEventListener('input', () => {
    const val = searchInput.value.trim();
    if (clearBtn) clearBtn.style.display = val ? 'inline-flex' : 'none';
    clearTimeout(modSearchTimeout);
    modSearchTimeout = setTimeout(() => {
      loadModrinthMods(false);
    }, 350);
  });

  searchBtn?.addEventListener('click', () => {
    clearTimeout(modSearchTimeout);
    loadModrinthMods(false);
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      clearTimeout(modSearchTimeout);
      loadModrinthMods(false);
      searchInput?.focus();
    }
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }
    if (clearBtn) clearBtn.style.display = 'none';
    loadModrinthMods(false);
  });

  sortSelect?.addEventListener('change', () => loadModrinthMods(false));
  loaderSelect?.addEventListener('change', () => {
    currentModBrowseLoader = loaderSelect.value || 'all';
    loadModrinthMods(false);
  });
  verLock?.addEventListener('change', () => loadModrinthMods(false));

  chipsContainer?.querySelectorAll('.mod-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsContainer.querySelectorAll('.mod-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentModCategory = chip.getAttribute('data-category') || 'all';
      loadModrinthMods(false);
    });
  });

  loadMoreBtn?.addEventListener('click', () => {
    currentModBrowseOffset += MOD_BROWSE_PAGE_SIZE;
    loadModrinthMods(true);
  });

  setupModpackModalEvents();
  setupModVersionModalEvents();
}

let modBrowseSearchSeq = 0;

async function loadModrinthMods(append = false) {
  const searchInput = document.getElementById('mod-browse-search-input');
  const sortSelect = document.getElementById('mod-browse-sort-select');
  const loaderSelect = document.getElementById('mod-browse-loader-select');
  const verLock = document.getElementById('mod-browse-ver-lock');
  const resultsContainer = document.getElementById('mod-browse-results');
  const loadingEl = document.getElementById('mod-browse-loading');
  const hitsCountEl = document.getElementById('mod-browse-hits-count');
  const loadMoreBtn = document.getElementById('btn-mod-browse-load-more');
  const paginationWrap = document.getElementById('mod-browse-pagination-wrap');

  if (!resultsContainer) return;

  const mySeq = ++modBrowseSearchSeq;
  const wasInputFocused = document.activeElement === searchInput;

  if (!append) {
    currentModBrowseOffset = 0;
    currentModBrowseHits = [];
    if (loadingEl) loadingEl.style.display = 'flex';
    resultsContainer.style.opacity = '0.35';
    if (paginationWrap) paginationWrap.style.display = 'none';
  } else {
    if (loadMoreBtn) {
      loadMoreBtn.disabled = true;
      loadMoreBtn.innerHTML = `<span class="spinner-ring" style="width: 14px; height: 14px;"></span><span>Ładowanie kolejnych...</span>`;
    }
  }

  const query = searchInput?.value.trim() || '';
  const sort = sortSelect?.value || 'downloads';
  const loader = loaderSelect?.value || currentModBrowseLoader || 'all';
  const activeMcVer = (getActiveProfileObj()?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
  const onlyCurrent = verLock ? verLock.checked : true;

  const verLockLabel = verLock?.parentElement?.querySelector('span');
  if (verLockLabel) {
    verLockLabel.textContent = `Tylko wersja profilu (${activeMcVer})`;
  }

  try {
    const res = await window.api.searchModrinth({
      query,
      projectType: currentModBrowseType,
      category: currentModBrowseType === 'mod' ? currentModCategory : '',
      loader,
      gameVersion: activeMcVer,
      sort,
      onlyCurrentVersion: onlyCurrent,
      limit: MOD_BROWSE_PAGE_SIZE,
      offset: currentModBrowseOffset
    });

    if (mySeq !== modBrowseSearchSeq && !append) {
      return;
    }

    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';

    currentModBrowseTotalHits = res.total_hits || 0;
    const incomingHits = res.hits || [];

    if (!append) {
      currentModBrowseHits = incomingHits;
    } else {
      currentModBrowseHits = currentModBrowseHits.concat(incomingHits);
    }

    if (hitsCountEl) {
      const typeLabel = currentModBrowseType === 'modpack' ? 'modpacków' : (currentModBrowseType === 'all' ? 'pozycji' : 'modów');
      hitsCountEl.textContent = `Znaleziono: ${currentModBrowseTotalHits.toLocaleString('pl-PL')} ${typeLabel} (wyświetlono: ${currentModBrowseHits.length})`;
    }

    renderModBrowseResults(incomingHits, append);

    if (wasInputFocused && document.activeElement !== searchInput) {
      searchInput?.focus();
    }

    if (paginationWrap) {
      if (currentModBrowseHits.length < currentModBrowseTotalHits) {
        paginationWrap.style.display = 'flex';
        if (loadMoreBtn) {
          loadMoreBtn.disabled = false;
          loadMoreBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            <span>Załaduj więcej (+${MOD_BROWSE_PAGE_SIZE})</span>
          `;
        }
      } else {
        paginationWrap.style.display = 'none';
      }
    }
  } catch (err) {
    if (loadingEl) loadingEl.style.display = 'none';
    resultsContainer.style.opacity = '1';
    if (!append) {
      resultsContainer.innerHTML = `
        <div class="empty-state-box" style="grid-column: 1 / -1;">
          <div class="setting-title" style="color: #F87171;">Błąd połączenia z bazą Modrinth</div>
          <div class="setting-desc">${err.message || 'Nie udało się pobrać katalogu.'}</div>
          <button class="btn-secondary" id="btn-retry-browse" style="margin-top: 8px;">Spróbuj ponownie</button>
        </div>
      `;
      document.getElementById('btn-retry-browse')?.addEventListener('click', () => loadModrinthMods(false));
    } else {
      showToast(`Błąd ładowania kolejnych wyników: ${err.message}`);
      if (loadMoreBtn) {
        loadMoreBtn.disabled = false;
        loadMoreBtn.innerHTML = `<span>Spróbuj ponownie</span>`;
      }
    }
  }
}

function renderModBrowseResults(hitsToRender, append = false) {
  const resultsContainer = document.getElementById('mod-browse-results');
  if (!resultsContainer) return;

  if (!append) {
    resultsContainer.innerHTML = '';
  }

  if ((!hitsToRender || hitsToRender.length === 0) && !append) {
    const isPack = currentModBrowseType === 'modpack';
    const emptyDesc = currentModBrowseType === 'all'
      ? 'Nie znaleziono modów ani modpacków dla zadanych filtrów. Spróbuj zmienić frazę lub odznaczyć filtr „Tylko wersja profilu”.'
      : `Nie znaleziono ${isPack ? 'modpacków' : 'modów'} dla zadanych filtrów. Spróbuj zmienić frazę lub wyłączyć filtr „Tylko wersja profilu”.`;
    resultsContainer.innerHTML = `
      <div class="empty-state-box" style="grid-column: 1 / -1;">
        <div class="setting-title">Brak wyników</div>
        <div class="setting-desc">${emptyDesc}</div>
      </div>
    `;
    return;
  }

  const activeMcVer = (getActiveProfileObj()?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');

  hitsToRender.forEach(item => {
    const card = document.createElement('div');
    card.className = 'modrinth-card';

    const isPack = item.project_type === 'modpack' || currentModBrowseType === 'modpack';
    const installed = !isPack && isModInstalled(item);
    const iconUrl = item.icon_url || 'assets/logo.svg';
    const downloadsFmt = formatDownloads(item.downloads);

    const detectedLoaders = (item.categories || item.loaders || []).filter(c => ['fabric', 'quilt', 'forge', 'neoforge'].includes(c.toLowerCase()));
    const activeProfLoader = (getActiveProfileObj()?.loader || 'fabric').toLowerCase();
    detectedLoaders.sort((a, b) => {
      const aIs = a.toLowerCase() === activeProfLoader ? -1 : 0;
      const bIs = b.toLowerCase() === activeProfLoader ? -1 : 0;
      return aIs - bIs;
    });

    let loaderBadgesHtml = '';
    if (detectedLoaders.length > 2) {
      const firstTwo = detectedLoaders.slice(0, 2).map(l => {
        const cls = l.toLowerCase();
        const label = cls === 'neoforge' ? 'NeoForge' : (cls.charAt(0).toUpperCase() + cls.slice(1));
        return `<span class="mod-tag tag-${cls}">${label}</span>`;
      }).join(' ');
      const extra = detectedLoaders.length - 2;
      const allNames = detectedLoaders.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');
      loaderBadgesHtml = `${firstTwo} <span class="mod-tag" title="Obsługiwane silniki: ${allNames}">+${extra}</span>`;
    } else {
      loaderBadgesHtml = detectedLoaders.map(l => {
        const cls = l.toLowerCase();
        const label = cls === 'neoforge' ? 'NeoForge' : (cls.charAt(0).toUpperCase() + cls.slice(1));
        return `<span class="mod-tag tag-${cls}">${label}</span>`;
      }).join(' ');
    }

    const typeBadge = isPack
      ? `<span class="modpack-card-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> Modpack</span>`
      : `<span class="mod-tag">Mod</span>`;

    card.innerHTML = `
      <div class="modrinth-card-top">
        <img src="${iconUrl}" class="modrinth-card-icon" alt="${item.title}" onerror="this.src='assets/logo.svg'">
        <div class="modrinth-card-head">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-bottom: 2px;">
            <div class="modrinth-card-title" title="${item.title}">${item.title}</div>
            ${typeBadge}
          </div>
          <div class="modrinth-card-author">Autor: ${item.author || 'Społeczność'}</div>
          <div class="modrinth-card-desc" title="${item.description || ''}">${item.description || ''}</div>
        </div>
      </div>

      <div class="modrinth-card-footer">
        <div class="modrinth-stats tnum">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${downloadsFmt}</span>
          ${loaderBadgesHtml}
          ${item.versions && item.versions.length > 0 ? `<span class="mod-tag" title="Obsługiwane wersje">MC ${item.versions[item.versions.length - 1]}</span>` : ''}
        </div>

        ${isPack ? `
          <button class="btn-modpack-install btn-modpack-trigger" data-slug="${item.slug}" data-id="${item.project_id}" data-title="${encodeURIComponent(item.title)}" data-author="${encodeURIComponent(item.author || '')}" data-icon="${encodeURIComponent(iconUrl)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>Zainstaluj Modpack</span>
          </button>
        ` : (installed ? `
          <button class="btn-modrinth-install installed" disabled>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Zainstalowano</span>
          </button>
        ` : `
          <button class="btn-modrinth-install btn-mod-download" data-slug="${item.slug}" data-id="${item.project_id}" data-title="${encodeURIComponent(item.title)}">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Instaluj</span>
          </button>
        `)}
      </div>
    `;

    const downloadBtn = card.querySelector('.btn-mod-download');
    downloadBtn?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModVersionModal(item);
    });

    const modpackTrigger = card.querySelector('.btn-modpack-trigger');
    const openPackModal = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModpackInstallModal({
        id: item.project_id || item.id,
        slug: item.slug,
        title: item.title,
        author: item.author || '',
        iconUrl: item.icon_url || 'assets/logo.svg'
      });
    };

    modpackTrigger?.addEventListener('click', openPackModal);
    if (isPack) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openPackModal(e);
      });
    } else if (!installed) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        openModVersionModal(item);
      });
    }

    resultsContainer.appendChild(card);
  });
}

function formatSpeed(bps) {
  if (!bps || bps <= 0) return '0.0 MB/s';
  if (bps >= 1024 * 1024) return (bps / (1024 * 1024)).toFixed(1) + ' MB/s';
  if (bps >= 1024) return (bps / 1024).toFixed(0) + ' KB/s';
  return bps + ' B/s';
}

function formatByteSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes >= 1024 * 1024 * 1024) return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

function formatEtaTime(sec) {
  if (!sec || sec <= 0) return 'Obliczanie...';
  if (sec < 60) return `~${sec} sek.`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s > 0 ? `~${m}m ${s}s` : `~${m} min.`;
}

function compareMcVersions(a, b) {
  const pa = a.split('.').map(x => parseInt(x, 10) || 0);
  const pb = b.split('.').map(x => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return nb - na;
  }
  return b.localeCompare(a);
}

function setupModpackModalEvents() {
  const modal = document.getElementById('modpack-install-modal');
  const closeBtn = document.getElementById('btn-close-modpack-modal');
  const cancelBtn = document.getElementById('btn-cancel-modpack-install');
  const confirmBtn = document.getElementById('btn-confirm-modpack-install');
  const mcSelect = document.getElementById('modpack-modal-mc-select');
  const versionSelect = document.getElementById('modpack-modal-version-select');
  const nameInput = document.getElementById('modpack-modal-profile-name');

  function closeModal() {
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
    }
    currentModpackModalData = null;
  }

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  mcSelect?.addEventListener('change', () => {
    if (!currentModpackModalData || !currentModpackModalData.mcMap) return;
    const selectedMc = mcSelect.value;
    updateModpackReleasesForSelectedMc(selectedMc);
  });

  versionSelect?.addEventListener('change', () => {
    if (!currentModpackModalData || !currentModpackModalData.versions) return;
    const selectedVerId = versionSelect.value;
    const relObj = currentModpackModalData.versions.find(v => v.id === selectedVerId);
    if (relObj) {
      const releaseTypeEl = document.getElementById('modpack-modal-release-type');
      if (releaseTypeEl) {
        releaseTypeEl.textContent = relObj.version_type === 'release' ? 'Stabilne' : `Wydanie ${relObj.version_type}`;
        releaseTypeEl.style.color = relObj.version_type === 'release' ? 'var(--emerald)' : 'var(--accent)';
      }
    }
  });

  confirmBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentModpackModalData) return;
    const selectedVersionId = versionSelect?.value || null;
    const selectedMc = mcSelect?.value || '1.21.1';
    const profileName = nameInput?.value.trim() || `[Modpack] ${currentModpackModalData.title} (${selectedMc})`;

    const configSection = document.getElementById('modpack-install-config-section');
    const progressSection = document.getElementById('modpack-install-progress-section');
    const progressStatus = document.getElementById('modpack-progress-status');
    const progressPct = document.getElementById('modpack-progress-pct');
    const progressFill = document.getElementById('modpack-progress-fill');
    const progressFile = document.getElementById('modpack-progress-file');
    const statSpeed = document.getElementById('modpack-stat-speed');
    const statSize = document.getElementById('modpack-stat-size');
    const statEta = document.getElementById('modpack-stat-eta');
    const statFiles = document.getElementById('modpack-stat-files');

    if (configSection) configSection.style.display = 'none';
    if (progressSection) progressSection.style.display = 'flex';
    if (closeBtn) closeBtn.style.display = 'none';
    confirmBtn.disabled = true;

    if (progressFill) {
      progressFill.style.width = '0%';
      progressFill.style.background = 'linear-gradient(90deg, #8B5CF6, #EC4899, #06B6D4)';
    }
    if (progressPct) progressPct.textContent = '0%';
    if (progressStatus) progressStatus.textContent = 'Inicjalizacja pobierania paczki...';
    if (statSpeed) statSpeed.textContent = '0.0 MB/s';
    if (statSize) statSize.textContent = '0 B / 0 B';
    if (statEta) statEta.textContent = 'Obliczanie...';
    if (statFiles) statFiles.textContent = '0 / 0 plików';
    if (progressFile) progressFile.textContent = 'Przygotowywanie profilu gry...';

    const removeProgressListener = window.api.onModpackProgress((p) => {
      if (p.percent !== undefined) {
        if (progressFill) progressFill.style.width = `${p.percent}%`;
        if (progressPct) progressPct.textContent = `${p.percent}%`;
      }
      if (p.message && progressStatus) {
        progressStatus.textContent = p.message;
      }
      if (p.currentFile && progressFile) {
        progressFile.textContent = p.currentFile;
      }
      if (p.speedBytesPerSec !== undefined && statSpeed) {
        statSpeed.textContent = formatSpeed(p.speedBytesPerSec);
      }
      if (p.downloadedBytes !== undefined && p.totalBytes !== undefined && statSize) {
        statSize.textContent = `${formatByteSize(p.downloadedBytes)} / ${formatByteSize(p.totalBytes)}`;
      }
      if (p.etaSeconds !== undefined && statEta) {
        statEta.textContent = formatEtaTime(p.etaSeconds);
      }
      if (p.completedFiles !== undefined && p.totalFiles !== undefined && statFiles) {
        statFiles.textContent = `${p.completedFiles} / ${p.totalFiles} plików`;
      }
    });

    try {
      const res = await window.api.installModrinthModpack({
        projectId: currentModpackModalData.id,
        slug: currentModpackModalData.slug,
        versionId: selectedVersionId,
        profileName
      });

      removeProgressListener();
      closeModal();
      if (closeBtn) closeBtn.style.display = 'flex';

      await loadProfiles();
      showToast(`Pomyślnie zainstalowano paczkę: ${res.name} (${res.modCount} modów)! Profil aktywny.`);
    } catch (err) {
      removeProgressListener();
      if (closeBtn) closeBtn.style.display = 'flex';
      if (progressStatus) progressStatus.textContent = `Błąd: ${err.message}`;
      if (progressFill) progressFill.style.background = '#EF4444';
      showToast(`Błąd instalacji modpacka: ${err.message}`);

      setTimeout(() => {
        if (configSection) configSection.style.display = 'block';
        if (progressSection) progressSection.style.display = 'none';
        confirmBtn.disabled = false;
      }, 3500);
    }
  });
}

function updateModpackReleasesForSelectedMc(selectedMc) {
  if (!currentModpackModalData || !currentModpackModalData.mcMap) return;
  const versionSelect = document.getElementById('modpack-modal-version-select');
  const releaseTypeEl = document.getElementById('modpack-modal-release-type');
  const detailsEl = document.getElementById('modpack-modal-details');
  const nameInput = document.getElementById('modpack-modal-profile-name');
  const confirmBtn = document.getElementById('btn-confirm-modpack-install');

  const releases = currentModpackModalData.mcMap.get(selectedMc) || [];
  if (!versionSelect) return;

  versionSelect.innerHTML = '';
  releases.forEach((rel) => {
    const opt = document.createElement('option');
    opt.value = rel.id;
    const isRelease = rel.version_type === 'release';
    const typeLabel = isRelease ? 'Wydanie stabilne' : `Wydanie ${rel.version_type}`;
    const loaderStr = rel.loaders?.join(', ') || 'Fabric';
    opt.textContent = `${rel.name || rel.version_number} (${typeLabel} • ${loaderStr})`;
    versionSelect.appendChild(opt);
  });

  if (releases.length > 0) {
    versionSelect.selectedIndex = 0;
    const topRel = releases[0];
    if (releaseTypeEl) {
      releaseTypeEl.textContent = topRel.version_type === 'release' ? 'Wydanie stabilne' : `Wydanie ${topRel.version_type}`;
      releaseTypeEl.style.color = topRel.version_type === 'release' ? 'var(--emerald)' : 'var(--accent)';
    }
    if (detailsEl) {
      detailsEl.innerHTML = `<span>Minecraft <b>${selectedMc}</b></span> • <span>${topRel.loaders?.join(', ') || 'Fabric'} Loader</span> • <span style="color: var(--text-muted);">${releases.length} wydań</span>`;
    }
    if (confirmBtn) confirmBtn.disabled = false;
  } else {
    versionSelect.innerHTML = `<option value="">Brak dostępnych wydań pod ${selectedMc}</option>`;
    if (confirmBtn) confirmBtn.disabled = true;
  }

  if (nameInput) {
    nameInput.value = `[Modpack] ${currentModpackModalData.title} (${selectedMc})`;
  }
}

async function openModpackInstallModal({ id, slug, title, author, iconUrl }) {
  const modal = document.getElementById('modpack-install-modal');
  const iconEl = document.getElementById('modpack-modal-icon');
  const nameEl = document.getElementById('modpack-modal-name');
  const authorEl = document.getElementById('modpack-modal-author');
  const detailsEl = document.getElementById('modpack-modal-details');
  const mcSelect = document.getElementById('modpack-modal-mc-select');
  const versionSelect = document.getElementById('modpack-modal-version-select');
  const mcCountEl = document.getElementById('modpack-modal-mc-count');
  const releaseTypeEl = document.getElementById('modpack-modal-release-type');
  const nameInput = document.getElementById('modpack-modal-profile-name');
  const configSection = document.getElementById('modpack-install-config-section');
  const progressSection = document.getElementById('modpack-install-progress-section');
  const confirmBtn = document.getElementById('btn-confirm-modpack-install');

  currentModpackModalData = { id, slug, title, author, iconUrl, versions: [], mcMap: new Map() };

  if (iconEl) iconEl.src = iconUrl || 'assets/logo.svg';
  if (nameEl) nameEl.textContent = title;
  if (authorEl) authorEl.textContent = author ? `Autor: ${author}` : 'Modpack społeczności';
  if (detailsEl) detailsEl.textContent = 'Pobieranie dostępnych wersji z Modrinth...';
  if (nameInput) nameInput.value = `[Modpack] ${title}`;
  if (mcCountEl) mcCountEl.textContent = '';
  if (releaseTypeEl) releaseTypeEl.textContent = '';

  if (configSection) configSection.style.display = 'block';
  if (progressSection) progressSection.style.display = 'none';
  if (confirmBtn) confirmBtn.disabled = true;

  if (mcSelect) {
    mcSelect.innerHTML = `<option value="">Wczytywanie wersji gry Minecraft...</option>`;
  }
  if (versionSelect) {
    versionSelect.innerHTML = `<option value="">Wczytywanie wydań modpacka...</option>`;
  }

  if (modal) {
    modal.classList.add('open');
    modal.classList.add('active');
  }

  try {
    const versions = await window.api.getModrinthProjectVersions(slug || id);
    if (!versions || versions.length === 0) {
      if (detailsEl) detailsEl.textContent = 'Brak dostępnych wydań tego modpacka.';
      if (mcSelect) mcSelect.innerHTML = `<option value="">Brak wersji do pobrania</option>`;
      return;
    }

    currentModpackModalData.versions = versions;

    const mcMap = new Map();
    for (const v of versions) {
      const gvs = v.game_versions || [];
      for (const gv of gvs) {
        if (!mcMap.has(gv)) mcMap.set(gv, []);
        mcMap.get(gv).push(v);
      }
    }
    currentModpackModalData.mcMap = mcMap;

    const uniqueMcs = Array.from(mcMap.keys()).sort(compareMcVersions);
    if (mcCountEl) {
      mcCountEl.textContent = `${uniqueMcs.length} wersji gry`;
    }

    const activeMcVer = (getActiveProfileObj()?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');

    if (mcSelect) {
      mcSelect.innerHTML = '';
      uniqueMcs.forEach((mc) => {
        const opt = document.createElement('option');
        opt.value = mc;
        const count = mcMap.get(mc)?.length || 0;
        const isMatch = mc === activeMcVer;
        opt.textContent = `Minecraft ${mc}${isMatch ? ' (Twój profil)' : ''} [${count} wydań]`;
        mcSelect.appendChild(opt);
      });

      const bestMcIdx = uniqueMcs.findIndex(mc => mc === activeMcVer);
      mcSelect.selectedIndex = bestMcIdx >= 0 ? bestMcIdx : 0;
    }

    const initialMc = mcSelect ? mcSelect.value : uniqueMcs[0];
    updateModpackReleasesForSelectedMc(initialMc);

  } catch (err) {
    console.error('Błąd pobierania wersji modpacka:', err);
    if (detailsEl) detailsEl.textContent = 'Nie udało się wczytać listy wersji paczki.';
  }
}

// ========================================================
// MODAL WYBORU WERSJI MODA (#mod-version-modal)
// ========================================================
let currentModVersionModalData = null;
let currentSelectedModVersion = null;

function setupModVersionModalEvents() {
  const modal = document.getElementById('mod-version-modal');
  const closeBtn = document.getElementById('btn-close-mod-version-modal');
  const cancelBtn = document.getElementById('btn-cancel-mod-version');
  const confirmBtn = document.getElementById('btn-confirm-mod-version-install');
  const filterMc = document.getElementById('mod-version-filter-mc');
  const filterLoader = document.getElementById('mod-version-filter-loader');

  const closeModal = () => {
    if (modal) modal.classList.remove('open', 'active');
    currentModVersionModalData = null;
    currentSelectedModVersion = null;
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  filterMc?.addEventListener('change', () => {
    renderFilteredModVersions();
  });

  filterLoader?.addEventListener('change', () => {
    renderFilteredModVersions();
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!currentModVersionModalData || !currentSelectedModVersion) return;

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spinner-ring" style="width: 14px; height: 14px;"></span><span>Instalowanie...</span>`;

    const activeProfile = getActiveProfileObj();
    const pid = currentModVersionModalData.project_id || currentModVersionModalData.id;
    const slug = currentModVersionModalData.slug;
    const title = currentModVersionModalData.title;
    const versionId = currentSelectedModVersion.id;
    const gameVer = currentSelectedModVersion.game_versions?.[0] || (activeProfile?.mcVersion || '1.21.11').replace(/^(fabric|quilt)-/, '');
    const ldr = currentSelectedModVersion.loaders?.[0] || activeProfile?.loader || 'fabric';

    try {
      const res = await window.api.installModrinthMod({
        projectId: pid,
        slug,
        versionId,
        gameVersion: gameVer,
        loader: ldr
      });

      if (res && res.success) {
        installedMods = res.mods;
        renderModsList(installedMods);
        loadProfiles();
        showToast(`Zainstalowano mod: ${title} (${currentSelectedModVersion.version_number || currentSelectedModVersion.name || 'wybrana wersja'})`);
        if (res.dependencies && res.dependencies.length > 0) {
          showToast(`Pobrano zależności (${res.dependencies.length}): ${res.dependencies.join(', ')}`);
        }
        closeModal();

        const cardBtn = document.querySelector(`.btn-mod-download[data-id="${pid}"], .btn-mod-download[data-slug="${slug}"]`);
        if (cardBtn) {
          cardBtn.className = 'btn-modrinth-install installed';
          cardBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg><span>Zainstalowano</span>`;
        }
      } else {
        throw new Error(res?.error || 'Nieznany błąd instalacji');
      }
    } catch (err) {
      showToast(`Błąd instalacji moda: ${err.message}`);
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Zainstaluj wersję</span>`;
    }
  });
}

async function openModVersionModal(item) {
  if (!item) return;

  const modal = document.getElementById('mod-version-modal');
  const titleEl = document.getElementById('mod-version-modal-title');
  const iconEl = document.getElementById('mod-version-modal-icon');
  const nameEl = document.getElementById('mod-version-modal-name');
  const authorEl = document.getElementById('mod-version-modal-author');
  const targetHintEl = document.getElementById('mod-version-modal-target-hint');
  const filterMc = document.getElementById('mod-version-filter-mc');
  const filterLoader = document.getElementById('mod-version-filter-loader');
  const loadingEl = document.getElementById('mod-version-loading');
  const listEl = document.getElementById('mod-version-list');
  const selectedInfo = document.getElementById('mod-version-selected-info');
  const confirmBtn = document.getElementById('btn-confirm-mod-version-install');

  currentModVersionModalData = {
    ...item,
    versions: []
  };
  currentSelectedModVersion = null;

  if (titleEl) titleEl.textContent = `Wybierz wersję: ${item.title}`;
  if (nameEl) nameEl.textContent = item.title;
  if (authorEl) authorEl.textContent = `Autor: ${item.author || 'Nieznany'}`;
  if (iconEl) iconEl.src = item.icon_url || 'assets/logo.svg';

  const activeProf = getActiveProfileObj();
  const activeMcVer = (activeProf?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
  const activeLoader = (activeProf?.loader || 'fabric').toLowerCase();

  if (targetHintEl) {
    targetHintEl.innerHTML = `<span>Twój profil: <strong>${activeLoader.toUpperCase()} ${activeMcVer}</strong></span>`;
  }

  if (listEl) listEl.innerHTML = '';
  if (loadingEl) loadingEl.style.display = 'block';
  if (selectedInfo) selectedInfo.textContent = 'Ładowanie wydań z Modrinth...';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Zainstaluj wersję</span>`;
  }

  if (modal) modal.classList.add('open', 'active');

  try {
    const slugOrId = item.project_id || item.id || item.slug;
    const versions = await window.api.getModrinthProjectVersions(slugOrId);

    if (loadingEl) loadingEl.style.display = 'none';

    if (!Array.isArray(versions) || versions.length === 0) {
      if (listEl) {
        listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Brak dostępnych wydań na Modrinth.</div>';
      }
      if (selectedInfo) selectedInfo.textContent = 'Brak wydań.';
      return;
    }

    currentModVersionModalData.versions = versions;

    const mcSet = new Set();
    const loaderSet = new Set();

    versions.forEach(v => {
      (v.game_versions || []).forEach(gv => mcSet.add(gv));
      (v.loaders || []).forEach(l => loaderSet.add(l.toLowerCase()));
    });

    const uniqueMcs = Array.from(mcSet).sort(compareMcVersions);

    if (filterMc) {
      filterMc.innerHTML = '<option value="all">Wszystkie wersje gry</option>';
      uniqueMcs.forEach(mc => {
        const opt = document.createElement('option');
        opt.value = mc;
        const isCurrent = mc === activeMcVer;
        opt.textContent = `Minecraft ${mc}${isCurrent ? ' (Twój profil)' : ''}`;
        filterMc.appendChild(opt);
      });

      if (mcSet.has(activeMcVer)) {
        filterMc.value = activeMcVer;
      } else {
        filterMc.value = 'all';
      }
    }

    if (filterLoader) {
      filterLoader.innerHTML = '<option value="all">Wszystkie loadery</option>';
      ['fabric', 'quilt', 'neoforge', 'forge'].forEach(l => {
        if (loaderSet.has(l)) {
          const opt = document.createElement('option');
          opt.value = l;
          const isCurrent = l === activeLoader;
          opt.textContent = `${l.charAt(0).toUpperCase() + l.slice(1)}${isCurrent ? ' (Twój profil)' : ''}`;
          filterLoader.appendChild(opt);
        }
      });

      if (loaderSet.has(activeLoader)) {
        filterLoader.value = activeLoader;
      } else {
        filterLoader.value = 'all';
      }
    }

    renderFilteredModVersions();

  } catch (err) {
    console.error('Błąd pobierania wersji moda:', err);
    if (loadingEl) loadingEl.style.display = 'none';
    if (listEl) {
      listEl.innerHTML = `<div style="padding: 24px; text-align: center; color: #EF4444;">Błąd pobierania wydań: ${err.message}</div>`;
    }
  }
}

function renderFilteredModVersions() {
  if (!currentModVersionModalData || !Array.isArray(currentModVersionModalData.versions)) return;

  const listEl = document.getElementById('mod-version-list');
  const filterMc = document.getElementById('mod-version-filter-mc');
  const filterLoader = document.getElementById('mod-version-filter-loader');
  const selectedInfo = document.getElementById('mod-version-selected-info');
  const confirmBtn = document.getElementById('btn-confirm-mod-version-install');

  const selectedMc = filterMc?.value || 'all';
  const selectedLoader = (filterLoader?.value || 'all').toLowerCase();

  const activeProf = getActiveProfileObj();
  const activeMcVer = (activeProf?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
  const activeLoader = (activeProf?.loader || 'fabric').toLowerCase();

  const filtered = currentModVersionModalData.versions.filter(v => {
    if (selectedMc !== 'all') {
      if (!v.game_versions || !v.game_versions.includes(selectedMc)) return false;
    }
    if (selectedLoader !== 'all') {
      if (!v.loaders || !v.loaders.map(l => l.toLowerCase()).includes(selectedLoader)) return false;
    }
    return true;
  });

  if (!listEl) return;
  listEl.innerHTML = '';

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div style="padding: 28px; text-align: center; color: var(--text-muted); background: var(--surface-2); border-radius: var(--radius-md);">
        Brak wydań dla wybranych filtrów (Minecraft: ${selectedMc}, Silnik: ${selectedLoader}).
        <br><span style="font-size: 11.5px; opacity: 0.8; margin-top: 4px; display: inline-block;">Zmień filtry powyżej na "Wszystkie", aby zobaczyć inne wersje.</span>
      </div>
    `;
    currentSelectedModVersion = null;
    if (confirmBtn) confirmBtn.disabled = true;
    if (selectedInfo) selectedInfo.textContent = 'Brak pasujących wersji.';
    return;
  }

  let defaultIdx = filtered.findIndex(v => {
    const hasMc = (v.game_versions || []).includes(activeMcVer);
    const hasLdr = (v.loaders || []).map(l => l.toLowerCase()).includes(activeLoader);
    return hasMc && hasLdr;
  });

  if (defaultIdx < 0) {
    defaultIdx = filtered.findIndex(v => v.version_type === 'release');
  }
  if (defaultIdx < 0) defaultIdx = 0;

  currentSelectedModVersion = filtered[defaultIdx];

  const updateSelectionUI = (ver, itemElement) => {
    currentSelectedModVersion = ver;
    listEl.querySelectorAll('.mod-version-item').forEach(el => el.classList.remove('selected'));
    itemElement?.classList.add('selected');
    const radio = itemElement?.querySelector('.mod-ver-radio');
    if (radio) radio.checked = true;

    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Zainstaluj ${ver.version_number || ver.name}</span>`;
    }

    const primaryFile = (ver.files || []).find(f => f.primary) || ver.files?.[0];
    const sizeStr = primaryFile ? (primaryFile.size > 1048576 ? ` • ${(primaryFile.size / 1048576).toFixed(1)} MB` : ` • ${Math.round(primaryFile.size / 1024)} KB`) : '';
    if (selectedInfo) {
      selectedInfo.innerHTML = `Wybrano: <strong style="color: #fff;">${ver.name || ver.version_number}</strong> (${(ver.game_versions || []).slice(0, 3).join(', ')})${sizeStr}`;
    }
  };

  filtered.forEach((v, idx) => {
    const isSelected = idx === defaultIdx;
    const isExactProfileMatch = (v.game_versions || []).includes(activeMcVer) &&
      (v.loaders || []).map(l => l.toLowerCase()).includes(activeLoader);

    const primaryFile = (v.files || []).find(f => f.primary) || v.files?.[0];
    const sizeStr = primaryFile ? (primaryFile.size > 1048576 ? `${(primaryFile.size / 1048576).toFixed(1)} MB` : `${Math.round(primaryFile.size / 1024)} KB`) : '';
    const dateStr = v.date_published ? new Date(v.date_published).toLocaleDateString('pl-PL') : '';

    const itemEl = document.createElement('div');
    itemEl.className = `mod-version-item${isSelected ? ' selected' : ''}`;
    itemEl.innerHTML = `
      <input type="radio" name="mod-version-radio-choice" class="mod-ver-radio" ${isSelected ? 'checked' : ''} style="cursor: pointer;">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 13px; color: #fff;">${v.name || v.version_number}</span>
          <span class="mod-ver-type ${v.version_type || 'release'}">${(v.version_type || 'release').toUpperCase()}</span>
          ${isExactProfileMatch ? '<span class="mod-ver-tag-rec">Zalecana dla Twojego profilu</span>' : ''}
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); margin-top: 4px; display: flex; gap: 10px; flex-wrap: wrap;">
          <span>MC: <strong>${(v.game_versions || []).slice(0, 4).join(', ')}${(v.game_versions?.length || 0) > 4 ? '...' : ''}</strong></span>
          <span>Loadery: <strong>${(v.loaders || []).join(', ')}</strong></span>
          ${sizeStr ? `<span>Rozmiar: <strong>${sizeStr}</strong></span>` : ''}
          ${dateStr ? `<span>Wydano: ${dateStr}</span>` : ''}
        </div>
      </div>
    `;

    itemEl.addEventListener('click', () => {
      updateSelectionUI(v, itemEl);
    });

    listEl.appendChild(itemEl);
  });

  if (currentSelectedModVersion) {
    const primaryFile = (currentSelectedModVersion.files || []).find(f => f.primary) || currentSelectedModVersion.files?.[0];
    const sizeStr = primaryFile ? (primaryFile.size > 1048576 ? ` • ${(primaryFile.size / 1048576).toFixed(1)} MB` : ` • ${Math.round(primaryFile.size / 1024)} KB`) : '';
    if (selectedInfo) {
      selectedInfo.innerHTML = `Wybrano: <strong style="color: #fff;">${currentSelectedModVersion.name || currentSelectedModVersion.version_number}</strong> (${(currentSelectedModVersion.game_versions || []).slice(0, 3).join(', ')})${sizeStr}`;
    }
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>Zainstaluj ${currentSelectedModVersion.version_number || currentSelectedModVersion.name}</span>`;
    }
  }
}

let currentSelectedVersionId = '1.21.11';
let profilesState = { activeProfileId: 'default-main', profiles: [], customEngines: [] };
let editingProfileId = null;
let selectedModalIcon = 'bolt';
let selectedModalLoader = 'fabric';

const PROFILE_ICONS_SVG = {
  bolt: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  sword: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" y1="19" x2="19" y2="13"/><line x1="16" y1="16" x2="20" y2="20"/><line x1="19" y1="21" x2="21" y2="19"/></svg>',
  cube: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>',
  spark: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>',
  compass: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  crown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"/></svg>'
};

const LOADER_LABELS = {
  fabric: 'Fabric',
  quilt: 'Quilt',
  forge: 'Forge',
  vanilla: 'Vanilla',
  custom: 'Własny'
};

function getActiveProfileObj() {
  if (!profilesState?.profiles?.length) return null;
  return profilesState.profiles.find(p => p.id === profilesState.activeProfileId) || profilesState.profiles[0];
}

function formatPolishProfilesCount(n) {
  if (n === 1) return '1 profil';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} profile`;
  return `${n} profili`;
}

async function loadVersions() {
  try {
    const data = await window.api.getVersions();
    availableVersions = data.releases || [];
    renderFullVersionsGrid();
  } catch (err) {
    console.error('Błąd pobierania wersji:', err);
  }
}

async function loadProfiles() {
  if (!window.api?.getProfilesState) return;
  try {
    profilesState = await window.api.getProfilesState();
    applyActiveProfileToUI();
    renderQuickVersionDropdown();
    renderProfilesCardsGrid();
    renderFullVersionsGrid();
    renderS2ModpacksWidget();
    updateScreenshotsProfileDropdown();
    updateBenchmarkProfileDropdown();
  } catch (err) {
    console.error('Błąd ładowania profili:', err);
  }
}

function applyActiveProfileToUI() {
  const active = getActiveProfileObj();
  if (!active) return;

  currentSelectedVersionId = active.effectiveVersionId || active.mcVersion || '1.21.11';
  const loaderLabel = LOADER_LABELS[active.loader] || 'Fabric';
  const verText = active.loader === 'custom' && active.customVersionId
    ? active.customVersionId
    : active.mcVersion;

  const emblemEl = document.getElementById('active-profile-emblem');
  const kickerEl = document.getElementById('active-profile-kicker');
  const modsPill = document.getElementById('mods-active-profile-pill');
  const topbarLabel = document.getElementById('topbar-status-label');
  const quickRam = document.getElementById('quick-stat-ram');

  if (emblemEl) emblemEl.innerHTML = PROFILE_ICONS_SVG[active.icon] || PROFILE_ICONS_SVG.bolt;
  if (kickerEl) kickerEl.textContent = `${loaderLabel.toUpperCase()} • ${verText}`;
  if (elements.currentVersionDisplay) elements.currentVersionDisplay.textContent = active.name;
  if (modsPill) modsPill.textContent = `Profil: ${active.name} (${loaderLabel} ${verText})`;

  if (!isGameLaunching && topbarLabel) {
    topbarLabel.textContent = `Profil ${active.name} (${loaderLabel} ${verText}) gotowy`;
  }
  if (!isGameLaunching && elements.playBtnText) {
    elements.playBtnText.textContent = currentLauncherStyle === 'style2' ? 'GRAJ' : 'URUCHOM GRĘ';
  }

  const effectiveRam = active.memoryMax || currentConfig?.memoryMax || 4;
  if (quickRam) {
    quickRam.textContent = active.memoryMax
      ? `${effectiveRam} GB (profil)`
      : `${effectiveRam} GB przydzielone`;
  }

  const activeModsCount = active.loader === 'vanilla' ? 0 : (active.modsEnabled ?? 0);
  const sidebarModsBadge = document.getElementById('sidebar-mods-badge');
  const subtabModsBadge = document.getElementById('mods-subtab-badge');
  const quickMods = document.getElementById('quick-stat-mods');
  if (sidebarModsBadge) sidebarModsBadge.textContent = String(activeModsCount);
  if (subtabModsBadge) subtabModsBadge.textContent = String(activeModsCount);
  if (quickMods) quickMods.textContent = `${activeModsCount} aktywnych`;
  updateWardrobeSkinSyncBanner();
  syncS2ProfileWidget();
  renderS2ModpacksWidget();
}

async function activateProfileById(profileId) {
  try {
    profilesState = await window.api.selectProfile(profileId);
    applyActiveProfileToUI();
    renderQuickVersionDropdown();
    renderProfilesCardsGrid();
    renderFullVersionsGrid();
    hasLoadedModBrowseOnce = false;
    await loadMods();
    await loadPacks(currentPackType);
    const active = getActiveProfileObj();
    if (active) {
      showToast(`Aktywny profil: ${active.name} (${LOADER_LABELS[active.loader] || active.loader} ${active.mcVersion})`);
    }
  } catch (err) {
    showToast(`Błąd zmiany profilu: ${err.message}`);
  }
}

function updateSelectedVersion(versionId, save = true) {
  currentSelectedVersionId = versionId || '1.21.11';
  const active = getActiveProfileObj();
  if (active) {
    applyActiveProfileToUI();
    return;
  }
  const isFabric = currentSelectedVersionId.startsWith('fabric-');
  const cleanDisplay = currentSelectedVersionId.replace(/^(fabric|quilt)-/, '');
  elements.currentVersionDisplay.textContent = isFabric ? `Fabric ${cleanDisplay}` : cleanDisplay;
  if (save) {
    window.api.saveConfig({ selectedVersion: currentSelectedVersionId });
  }
}

function renderQuickVersionDropdown() {
  if (!elements.versionQuickMenu) return;
  elements.versionQuickMenu.innerHTML = '';

  const list = profilesState?.profiles || [];
  list.forEach(prof => {
    const item = document.createElement('div');
    const isSelected = prof.id === profilesState.activeProfileId;
    const loaderLabel = LOADER_LABELS[prof.loader] || 'Fabric';
    const verLabel = prof.loader === 'custom' && prof.customVersionId ? prof.customVersionId : prof.mcVersion;

    item.className = `version-menu-item ${isSelected ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display: flex; align-items: center; gap: 9px; min-width: 0;">
        <span style="color: var(--accent-primary-hover); display: inline-flex;">${PROFILE_ICONS_SVG[prof.icon] || PROFILE_ICONS_SVG.bolt}</span>
        <div style="display: flex; flex-direction: column; min-width: 0;">
          <span style="font-size: 12.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prof.name}</span>
          <span class="tnum" style="font-size: 10.5px; color: var(--text-muted);">${verLabel}${prof.loader !== 'vanilla' ? ` • ${prof.modsEnabled || 0} modów` : ''}</span>
        </div>
      </div>
      <span class="loader-pill ${prof.loader}">${loaderLabel}</span>
    `;
    item.addEventListener('click', () => {
      elements.versionQuickMenu.classList.remove('open');
      activateProfileById(prof.id);
    });
    elements.versionQuickMenu.appendChild(item);
  });

  const footer = document.createElement('div');
  footer.className = 'quick-menu-footer';
  footer.innerHTML = `
    <button type="button" class="btn-primary" id="btn-quick-new-profile" style="flex: 1; height: 30px; font-size: 11.5px;">
      + Nowy Profil
    </button>
    <button type="button" class="btn-secondary" id="btn-quick-manage-profiles" style="height: 30px; font-size: 11.5px;">
      Zarządzaj
    </button>
  `;
  elements.versionQuickMenu.appendChild(footer);

  footer.querySelector('#btn-quick-new-profile')?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.versionQuickMenu.classList.remove('open');
    openProfileEditorModal();
  });
  footer.querySelector('#btn-quick-manage-profiles')?.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.versionQuickMenu.classList.remove('open');
    switchToTab('instances');
    document.getElementById('subtab-btn-profiles')?.click();
  });
}

function renderProfilesCardsGrid() {
  const grid = document.getElementById('profiles-cards-grid');
  const badge = document.getElementById('profiles-count-badge');
  const sidebarProfBadge = document.getElementById('sidebar-profiles-badge');
  if (!grid) return;

  const list = profilesState?.profiles || [];
  if (badge) badge.textContent = formatPolishProfilesCount(list.length);
  if (sidebarProfBadge) sidebarProfBadge.textContent = String(list.length);

  grid.innerHTML = '';
  list.forEach(prof => {
    const isActive = prof.id === profilesState.activeProfileId;
    const loaderLabel = LOADER_LABELS[prof.loader] || 'Fabric';
    const verLabel = prof.loader === 'custom' && prof.customVersionId ? prof.customVersionId : prof.mcVersion;
    const ramTag = prof.memoryMax ? `${prof.memoryMax} GB RAM` : 'Domyślny RAM';
    const folderTag = prof.isolated ? 'Izolowany folder' : 'Główny katalog';
    const modsTag = prof.loader === 'vanilla'
      ? 'Bez modów (Czysta)'
      : `${prof.modsEnabled || 0} / ${prof.modsTotal || 0} modów`;

    const card = document.createElement('div');
    card.className = `profile-instance-card ${isActive ? 'active' : ''}`;
    card.innerHTML = `
      <div class="profile-card-top">
        <div class="profile-card-identity">
          <div class="profile-emblem-box">${PROFILE_ICONS_SVG[prof.icon] || PROFILE_ICONS_SVG.bolt}</div>
          <div style="min-width: 0;">
            <div class="profile-card-name" title="${prof.name}">${prof.name}</div>
            <div class="profile-card-sub tnum">Minecraft ${verLabel} • ${folderTag}</div>
          </div>
        </div>
        ${isActive
          ? '<span class="mod-tag status-on">Aktywny</span>'
          : `<button type="button" class="btn-secondary btn-prof-activate" style="height: 26px; padding: 0 10px; font-size: 11px;">Wybierz</button>`}
      </div>

      <div class="profile-card-tags">
        <span class="loader-pill ${prof.loader}">${loaderLabel}</span>
        <span class="mod-tag tnum">${modsTag}</span>
        <span class="mod-tag tnum">${ramTag}</span>
      </div>

      <div class="profile-card-actions">
        <div style="display: flex; align-items: center; gap: 6px;">
          <button type="button" class="btn-emerald btn-prof-play" style="height: 28px; padding: 0 11px; font-size: 11.5px;">
            Graj
          </button>
          ${prof.loader !== 'vanilla' ? `
            <button type="button" class="btn-secondary btn-prof-mods" style="height: 28px; padding: 0 10px; font-size: 11.5px;">
              Mody
            </button>
          ` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 4px;">
          <button type="button" class="btn-icon-only btn-prof-export" title="Eksportuj paczkę .mrpack dla znajomych" style="width: 28px; height: 28px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </button>
          <button type="button" class="btn-icon-only btn-prof-folder" title="Otwórz folder profilu" style="width: 28px; height: 28px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          </button>
          <button type="button" class="btn-icon-only btn-prof-edit" title="Edytuj profil" style="width: 28px; height: 28px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" class="btn-icon-only btn-prof-dup" title="Duplikuj profil" style="width: 28px; height: 28px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          ${prof.id !== 'default-main' ? `
            <button type="button" class="btn-icon-only btn-prof-del" title="Usuń profil" style="width: 28px; height: 28px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;

    card.querySelector('.btn-prof-activate')?.addEventListener('click', () => activateProfileById(prof.id));
    card.querySelector('.btn-prof-play')?.addEventListener('click', async () => {
      if (!isActive) await activateProfileById(prof.id);
      switchToTab('play');
      handlePlayClick();
    });
    card.querySelector('.btn-prof-mods')?.addEventListener('click', async () => {
      if (!isActive) await activateProfileById(prof.id);
      switchToTab('mods');
      if (typeof window.switchModsSubtab === 'function') {
        window.switchModsSubtab('installed');
      }
    });
    card.querySelector('.btn-prof-export')?.addEventListener('click', () => {
      handleExportProfileMrpack(prof.id);
    });
    card.querySelector('.btn-prof-folder')?.addEventListener('click', () => {
      window.api.openProfileFolder(prof.id);
    });
    card.querySelector('.btn-prof-edit')?.addEventListener('click', () => {
      openProfileEditorModal(prof);
    });
    card.querySelector('.btn-prof-dup')?.addEventListener('click', async () => {
      try {
        profilesState = await window.api.duplicateProfile(prof.id);
        applyActiveProfileToUI();
        renderQuickVersionDropdown();
        renderProfilesCardsGrid();
        await loadMods();
        showToast(`Zduplikowano profil: ${prof.name}`);
      } catch (err) {
        showToast(`Błąd duplikowania: ${err.message}`);
      }
    });
    card.querySelector('.btn-prof-del')?.addEventListener('click', async () => {
      if (!confirm(`Czy na pewno chcesz usunąć profil „${prof.name}”?`)) return;
      try {
        profilesState = await window.api.deleteProfile(prof.id);
        applyActiveProfileToUI();
        renderQuickVersionDropdown();
        renderProfilesCardsGrid();
        await loadMods();
        showToast(`Usunięto profil: ${prof.name}`);
      } catch (err) {
        showToast(`Błąd usuwania: ${err.message}`);
      }
    });

    grid.appendChild(card);
  });
}

function renderFullVersionsGrid() {
  if (!elements.versionsFullGrid) return;
  const activeProf = getActiveProfileObj();
  elements.versionsFullGrid.innerHTML = '';

  availableVersions.forEach(ver => {
    const card = document.createElement('div');
    const isSelected = activeProf?.mcVersion === ver.id;
    card.className = `version-card-item ${isSelected ? 'selected' : ''}`;
    card.style.flexDirection = 'column';
    card.style.alignItems = 'stretch';
    card.style.gap = '10px';

    card.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <div>
          <div class="v-card-name tnum">${ver.id}</div>
          <div class="setting-desc" style="font-size: 10.5px;">Wydanie ${ver.releaseTime || 'Mojang'}</div>
        </div>
        <span class="v-card-badge">${isSelected ? 'W aktywnym profilu' : 'Utwórz profil'}</span>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button type="button" class="btn-secondary btn-ver-fabric" style="flex: 1; height: 26px; padding: 0 8px; font-size: 10.5px;">+ Fabric</button>
        <button type="button" class="btn-secondary btn-ver-quilt" style="flex: 1; height: 26px; padding: 0 8px; font-size: 10.5px;">+ Quilt</button>
        <button type="button" class="btn-secondary btn-ver-vanilla" style="flex: 1; height: 26px; padding: 0 8px; font-size: 10.5px;">+ Vanilla</button>
      </div>
    `;

    card.querySelector('.btn-ver-fabric')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileEditorModal(null, ver.id, 'fabric');
    });
    card.querySelector('.btn-ver-quilt')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileEditorModal(null, ver.id, 'quilt');
    });
    card.querySelector('.btn-ver-vanilla')?.addEventListener('click', (e) => {
      e.stopPropagation();
      openProfileEditorModal(null, ver.id, 'vanilla');
    });

    elements.versionsFullGrid.appendChild(card);
  });
}

function openProfileEditorModal(existingProfile = null, presetMcVersion = null, presetLoader = null) {
  const modal = document.getElementById('profile-editor-modal');
  const titleEl = document.getElementById('profile-editor-title');
  const nameInput = document.getElementById('prof-input-name');
  const verSelect = document.getElementById('prof-select-mcversion');
  const ramSelect = document.getElementById('prof-select-ram');
  const customWrap = document.getElementById('prof-custom-engine-wrap');
  const customSelect = document.getElementById('prof-select-custom-engine');
  const isolatedToggle = document.getElementById('prof-toggle-isolated');
  const saveBtn = document.getElementById('btn-save-profile-modal');

  if (!modal) return;

  editingProfileId = existingProfile ? existingProfile.id : null;
  selectedModalIcon = existingProfile?.icon || (presetLoader === 'vanilla' ? 'cube' : 'bolt');
  selectedModalLoader = existingProfile?.loader || presetLoader || 'fabric';

  if (titleEl) titleEl.textContent = existingProfile ? `Edytuj Profil: ${existingProfile.name}` : 'Nowy Profil Gry';
  if (saveBtn) saveBtn.textContent = existingProfile ? 'Zapisz Zmiany' : 'Utwórz Profil';

  if (verSelect) {
    verSelect.innerHTML = '';
    const vers = availableVersions.length > 0 ? availableVersions : [{ id: '1.21.11' }, { id: '1.21.4' }, { id: '1.21.1' }, { id: '1.20.4' }, { id: '1.20.1' }, { id: '1.19.4' }, { id: '1.18.2' }, { id: '1.16.5' }, { id: '1.12.2' }, { id: '1.8.9' }];
    vers.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `Minecraft ${v.id}`;
      verSelect.appendChild(opt);
    });
    verSelect.value = existingProfile?.mcVersion || presetMcVersion || '1.21.11';
  }

  if (customSelect) {
    customSelect.innerHTML = '';
    const engines = profilesState?.customEngines || [];
    if (engines.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Brak ręcznie zainstalowanych silników w katalogu versions/';
      customSelect.appendChild(opt);
    } else {
      engines.forEach(eng => {
        const opt = document.createElement('option');
        opt.value = eng;
        opt.textContent = eng;
        customSelect.appendChild(opt);
      });
      if (existingProfile?.customVersionId) customSelect.value = existingProfile.customVersionId;
    }
  }

  if (nameInput) {
    if (existingProfile) {
      nameInput.value = existingProfile.name;
    } else if (presetMcVersion && presetLoader) {
      nameInput.value = `${LOADER_LABELS[presetLoader] || 'Profil'} ${presetMcVersion}`;
    } else {
      nameInput.value = '';
    }
  }

  if (ramSelect) {
    ramSelect.value = existingProfile?.memoryMax ? String(existingProfile.memoryMax) : '';
  }

  const jvmPresetSelect = document.getElementById('prof-select-jvm-preset');
  const jvmArgsInput = document.getElementById('prof-input-jvm-args');
  if (jvmPresetSelect) jvmPresetSelect.value = existingProfile?.jvmPreset || '';
  if (jvmArgsInput) jvmArgsInput.value = existingProfile?.jvmArgs || '';

  if (isolatedToggle) {
    isolatedToggle.checked = existingProfile ? !!existingProfile.isolated : true;
    isolatedToggle.disabled = existingProfile?.id === 'default-main';
  }

  document.querySelectorAll('#prof-icon-picker .icon-option-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.icon === selectedModalIcon);
  });
  document.querySelectorAll('#prof-loader-picker .loader-option-card').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.loader === selectedModalLoader);
  });
  if (customWrap) {
    customWrap.style.display = selectedModalLoader === 'custom' ? 'block' : 'none';
  }

  modal.classList.add('open');
  setTimeout(() => nameInput?.focus(), 60);
}

function closeProfileEditorModal() {
  document.getElementById('profile-editor-modal')?.classList.remove('open');
}

async function handleExportProfileMrpack(profileId = null) {
  try {
    const res = await window.api.exportProfileMrpack(profileId);
    if (!res || res.canceled) return;
    if (res.success) {
      showToast(`Zapisano paczkę ${res.profileName}.mrpack (${res.sizeFormatted}) — wyślij plik znajomym!`);
    }
  } catch (err) {
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    showToast(`Błąd eksportu paczki: ${cleanErr}`);
  }
}

async function handleImportMrpack(explicitPath = null) {
  const modal = document.getElementById('modpack-install-modal');
  const iconEl = document.getElementById('modpack-modal-icon');
  const nameEl = document.getElementById('modpack-modal-name');
  const authorEl = document.getElementById('modpack-modal-author');
  const detailsEl = document.getElementById('modpack-modal-details');
  const configSection = document.getElementById('modpack-install-config-section');
  const progressSection = document.getElementById('modpack-install-progress-section');
  const closeBtn = document.getElementById('btn-close-modpack-modal');
  const progressStatus = document.getElementById('modpack-progress-status');
  const progressPct = document.getElementById('modpack-progress-pct');
  const progressFill = document.getElementById('modpack-progress-fill');
  const progressFile = document.getElementById('modpack-progress-file');
  const statSpeed = document.getElementById('modpack-stat-speed');
  const statSize = document.getElementById('modpack-stat-size');
  const statEta = document.getElementById('modpack-stat-eta');
  const statFiles = document.getElementById('modpack-stat-files');

  let modalShown = false;
  const ensureProgressModalOpen = () => {
    if (modalShown) return;
    modalShown = true;
    if (iconEl) iconEl.src = 'assets/logo.svg';
    if (nameEl) nameEl.textContent = 'Importowanie paczki .mrpack';
    if (authorEl) authorEl.textContent = 'Paczka lokalna / od znajomego';
    if (detailsEl) detailsEl.textContent = 'Pobieranie modów z Modrinth oraz wypakowywanie ustawień...';
    if (configSection) configSection.style.display = 'none';
    if (progressSection) progressSection.style.display = 'flex';
    if (closeBtn) closeBtn.style.display = 'none';
    if (progressFill) {
      progressFill.style.width = '0%';
      progressFill.style.background = 'linear-gradient(90deg, #8B5CF6, #EC4899, #06B6D4)';
    }
    if (progressPct) progressPct.textContent = '0%';
    if (progressStatus) progressStatus.textContent = 'Odczytywanie pliku .mrpack...';
    if (statSpeed) statSpeed.textContent = '0.0 MB/s';
    if (statSize) statSize.textContent = '0 B / 0 B';
    if (statEta) statEta.textContent = 'Obliczanie...';
    if (statFiles) statFiles.textContent = '0 / 0 plików';
    if (progressFile) progressFile.textContent = 'Przygotowywanie nowej instancji...';
    if (modal) {
      modal.classList.add('open');
      modal.classList.add('active');
    }
  };

  if (explicitPath) {
    ensureProgressModalOpen();
  }

  const removeProgressListener = window.api.onModpackProgress((p) => {
    ensureProgressModalOpen();
    if (p.percent !== undefined) {
      if (progressFill) progressFill.style.width = `${p.percent}%`;
      if (progressPct) progressPct.textContent = `${p.percent}%`;
    }
    if (p.message && progressStatus) progressStatus.textContent = p.message;
    if (p.currentFile && progressFile) progressFile.textContent = p.currentFile;
    if (p.speedBytesPerSec !== undefined && statSpeed) statSpeed.textContent = formatSpeed(p.speedBytesPerSec);
    if (p.downloadedBytes !== undefined && p.totalBytes !== undefined && statSize) {
      statSize.textContent = `${formatByteSize(p.downloadedBytes)} / ${formatByteSize(p.totalBytes)}`;
    }
    if (p.etaSeconds !== undefined && statEta) statEta.textContent = formatEtaTime(p.etaSeconds);
    if (p.completedFiles !== undefined && p.totalFiles !== undefined && statFiles) {
      statFiles.textContent = `${p.completedFiles} / ${p.totalFiles} plików`;
    }
  });

  try {
    const res = await window.api.importProfileMrpack(explicitPath);
    removeProgressListener();
    if (closeBtn) closeBtn.style.display = 'flex';
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
    }
    if (!res || res.canceled) return;

    await loadProfiles();
    await loadMods();
    await loadPacks(currentPackType);
    showToast(`Wczytano i wybrano paczkę: ${res.name} (${res.modCount || 0} pobranych plików)!`);
  } catch (err) {
    removeProgressListener();
    if (closeBtn) closeBtn.style.display = 'flex';
    if (modal) {
      modal.classList.remove('open');
      modal.classList.remove('active');
    }
    const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
    showToast(`Błąd importu paczki .mrpack: ${cleanErr}`);
  }
}

function setupProfilesListeners() {
  const modal = document.getElementById('profile-editor-modal');
  const btnOpenCreate = document.getElementById('btn-open-create-profile');
  const btnExportActive = document.getElementById('btn-export-active-mrpack');
  const btnImportMrpack = document.getElementById('btn-import-mrpack');
  const btnClose = document.getElementById('btn-close-profile-editor');
  const btnCancel = document.getElementById('btn-cancel-profile-editor');
  const btnSave = document.getElementById('btn-save-profile-modal');
  const customWrap = document.getElementById('prof-custom-engine-wrap');

  btnOpenCreate?.addEventListener('click', () => openProfileEditorModal());
  btnExportActive?.addEventListener('click', () => handleExportProfileMrpack(null));
  btnImportMrpack?.addEventListener('click', () => handleImportMrpack(null));
  btnClose?.addEventListener('click', closeProfileEditorModal);
  btnCancel?.addEventListener('click', closeProfileEditorModal);
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeProfileEditorModal();
  });

  document.querySelectorAll('#prof-icon-picker .icon-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedModalIcon = btn.dataset.icon || 'bolt';
      document.querySelectorAll('#prof-icon-picker .icon-option-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
      });
    });
  });

  document.querySelectorAll('#prof-loader-picker .loader-option-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedModalLoader = card.dataset.loader || 'fabric';
      document.querySelectorAll('#prof-loader-picker .loader-option-card').forEach(c => {
        c.classList.toggle('active', c === card);
      });
      if (customWrap) {
        customWrap.style.display = selectedModalLoader === 'custom' ? 'block' : 'none';
      }
    });
  });

  btnSave?.addEventListener('click', async () => {
    const nameInput = document.getElementById('prof-input-name');
    const verSelect = document.getElementById('prof-select-mcversion');
    const ramSelect = document.getElementById('prof-select-ram');
    const customSelect = document.getElementById('prof-select-custom-engine');
    const isolatedToggle = document.getElementById('prof-toggle-isolated');

    const mcVersion = verSelect?.value || '1.21.11';
    const loaderLabel = LOADER_LABELS[selectedModalLoader] || 'Profil';
    const rawName = (nameInput?.value || '').trim() || `${loaderLabel} ${mcVersion}`;
    const customVersionId = customSelect?.value || '';

    if (selectedModalLoader === 'custom' && !customVersionId) {
      showToast('Brak zainstalowanego własnego silnika w katalogu versions/');
      return;
    }

    const jvmPresetSelect = document.getElementById('prof-select-jvm-preset');
    const jvmArgsInput = document.getElementById('prof-input-jvm-args');

    const payload = {
      name: rawName,
      mcVersion,
      loader: selectedModalLoader,
      customVersionId: selectedModalLoader === 'custom' ? customVersionId : null,
      icon: selectedModalIcon,
      isolated: isolatedToggle ? isolatedToggle.checked : true,
      memoryMax: ramSelect?.value ? parseInt(ramSelect.value, 10) : null,
      jvmPreset: jvmPresetSelect?.value || null,
      jvmArgs: (jvmArgsInput?.value || '').trim()
    };

    try {
      btnSave.disabled = true;
      if (editingProfileId) {
        profilesState = await window.api.updateProfile(editingProfileId, payload);
        showToast(`Zapisano profil: ${rawName}`);
      } else {
        profilesState = await window.api.createProfile(payload);
        showToast(`Utworzono i wybrano profil: ${rawName}`);
      }
      closeProfileEditorModal();
      applyActiveProfileToUI();
      renderQuickVersionDropdown();
      renderProfilesCardsGrid();
      renderFullVersionsGrid();
      hasLoadedModBrowseOnce = false;
      await loadMods();
      await loadPacks(currentPackType);
    } catch (err) {
      showToast(`Błąd zapisu profilu: ${err.message}`);
    } finally {
      btnSave.disabled = false;
    }
  });
}

async function handlePlayClick() {
  if (isGameLaunching) return;

  try {
    window.uiSounds?.playLaunch();
  } catch (_) {}

  if (!currentAccount) {
    showToast('Zaloguj się przed uruchomieniem gry');
    openLoginModal();
    return;
  }

  const activeProf = getActiveProfileObj();
  const launchLabel = activeProf
    ? `${activeProf.name} (${LOADER_LABELS[activeProf.loader] || activeProf.loader} ${activeProf.mcVersion})`
    : (currentSelectedVersionId || '1.21.11');

  setLaunchingState(true, `Uruchamianie ${launchLabel}...`);

  try {
    await window.api.launchGame();
  } catch (err) {
    console.error('Błąd startu gry:', err);
    showToast(`Błąd uruchamiania: ${err.message}`);
    setLaunchingState(false);
  }
}

function setLaunchingState(launching, text = '') {
  isGameLaunching = launching;
  const progBar = document.getElementById('launch-progress-bar');
  const topbarLabel = document.getElementById('topbar-status-label');
  const s3PlayBtn = document.getElementById('s3-btn-play');
  const s3PlayLabel = document.getElementById('s3-btn-play-label');
  const s3ProgBar = document.getElementById('s3-launch-progress-fill');

  if (launching) {
    elements.playBtnGroup.classList.add('launching');
    elements.playBtnText.textContent = text || 'Weryfikacja plików...';
    if (progBar) progBar.style.width = '0%';
    if (s3PlayBtn) s3PlayBtn.classList.add('is-launching');
    if (s3PlayLabel) s3PlayLabel.textContent = text || 'Weryfikacja...';
    if (s3ProgBar) s3ProgBar.style.width = '0%';
    if (topbarLabel) topbarLabel.textContent = text || 'Przygotowywanie sesji gry...';
  } else {
    elements.playBtnGroup.classList.remove('launching');
    elements.playBtnText.textContent = currentLauncherStyle === 'style2' ? 'GRAJ' : 'URUCHOM GRĘ';
    if (progBar) progBar.style.width = '0%';
    if (s3PlayBtn) s3PlayBtn.classList.remove('is-launching');
    if (s3PlayLabel) s3PlayLabel.textContent = 'ODPAL GRĘ';
    if (s3ProgBar) s3ProgBar.style.width = '0%';
    if (topbarLabel) topbarLabel.textContent = 'Silnik gotowy do uruchomienia';
  }
}

function setupLauncherEventListeners() {
  const progBar = document.getElementById('launch-progress-bar');
  const topbarLabel = document.getElementById('topbar-status-label');

  window.api.onLauncherStatus((data) => {
    if (data?.message) {
      elements.playBtnText.textContent = data.message;
      const s3PlayLabel = document.getElementById('s3-btn-play-label');
      if (s3PlayLabel) s3PlayLabel.textContent = data.message;
      if (topbarLabel) topbarLabel.textContent = data.message;
      appendLog(`[STATUS] ${data.message}`);
    }
  });

  window.api.onLauncherProgress((data) => {
    if (data) {
      const pct = Math.max(0, Math.min(100, Number(data.percentage) || 0));
      const text = data.label || (data.isDownloading ? `Pobieranie ${pct}%` : `Weryfikacja ${pct}%`);
      elements.playBtnText.textContent = text;
      if (progBar) progBar.style.width = `${pct}%`;
      const s3PlayLabel = document.getElementById('s3-btn-play-label');
      const s3ProgBar = document.getElementById('s3-launch-progress-fill');
      if (s3PlayLabel) s3PlayLabel.textContent = text;
      if (s3ProgBar) s3ProgBar.style.width = `${pct}%`;
    }
  });

  window.api.onLauncherLog((data) => {
    if (data?.text) {
      appendLog(data.text);
    }
  });

  window.api.onLauncherStarted((data) => {
    showToast(`Uruchomiono Minecraft ${data.version}`);
    elements.playBtnText.textContent = 'SESJA AKTYWNA';
    if (progBar) progBar.style.width = '100%';
    const s3PlayLabel = document.getElementById('s3-btn-play-label');
    const s3ProgBar = document.getElementById('s3-launch-progress-fill');
    if (s3PlayLabel) s3PlayLabel.textContent = 'GRA DZIAŁA';
    if (s3ProgBar) s3ProgBar.style.width = '100%';
    if (topbarLabel) topbarLabel.textContent = `W grze: Minecraft ${data.version}`;
    appendLog(`[KasteuszLauncher] Minecraft ${data.version} wystartował.`);
    try {
      window.liveWallpapers?.pause(true);
      window.musicPlayer?.onGameLaunch();
    } catch (_) {}
    if (skinViewer) {
      skinViewer.animation = null;
    }
  });

  window.api.onLauncherClosed((data) => {
    setLaunchingState(false);
    showToast(`Sesja gry zakończona (kod: ${data.code})`);
    appendLog(`[KasteuszLauncher] Proces gry zakończony z kodem ${data.code}.`);
    try {
      window.liveWallpapers?.pause(false);
      window.musicPlayer?.onGameClose();
    } catch (_) {}
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
    showToast(`Błąd uruchomienia: ${data.message}`);
    appendLog(`[BŁĄD] ${data.message}`);
  });
}

function appendLog(line) {
  const lineEl = document.createElement('div');
  lineEl.className = /error|exception|błąd/i.test(line) ? 'log-line log-err' : 'log-line';
  lineEl.textContent = line;
  elements.logsConsole.appendChild(lineEl);
  elements.logsConsole.scrollTop = elements.logsConsole.scrollHeight;
}

function showToast(message) {
  try {
    window.uiSounds?.playToast();
  } catch (_) {}
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3200);
}

// ============================================================================
// ============================================================================
let friendsList = [];

async function loadFriends() {
  try {
    const previous = friendsList;
    friendsList = await window.api.getFriends();
    if (Array.isArray(previous) && previous.length > 0) {
      const wasOnline = new Set(previous.filter(p => p.online).map(p => p.username.toLowerCase()));
      friendsList.forEach(f => {
        if (f.online && !wasOnline.has(f.username.toLowerCase())) {
          showToast(`${f.username} jest teraz online`);
        }
      });
    }
    renderFriendsList(friendsList);
  } catch (err) {
    console.error('Błąd wczytywania znajomych:', err);
  }
}

function renderFriendsList(friends) {
  const container = document.getElementById('friends-list-container');
  const countEl = document.getElementById('friends-count');
  if (!container) return;

  const list = Array.isArray(friends) ? friends : [];
  if (countEl) {
    countEl.textContent = String(list.length);
  }
  syncS3FriendsStrip(list);

  if (list.length === 0) {
    container.innerHTML = `
      <div class="friends-empty-state">
        <div class="friends-empty-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        </div>
        <div class="friends-empty-title">Lista znajomych jest pusta</div>
        <div class="friends-empty-desc">Dodaj graczy, aby szybko sprawdzać ich profile i kopiować nicki.</div>
        <button class="btn-secondary" id="btn-empty-add-friend" style="margin-top: 6px; height: 28px; font-size: 11.5px;">Dodaj gracza</button>
      </div>
    `;
    document.getElementById('btn-empty-add-friend')?.addEventListener('click', openAddFriendModal);
    return;
  }

  container.innerHTML = '';
  const listEl = document.createElement('div');
  listEl.className = 'friends-list';

  list.forEach(f => {
    const item = document.createElement('div');
    item.className = 'friend-item';
    item.innerHTML = `
      <div class="friend-item-left">
        <div class="friend-avatar-wrap">
          <img class="friend-avatar" alt="">
          <span class="friend-dot" style="background: ${f.online ? 'var(--emerald)' : 'var(--text-muted)'};"></span>
        </div>
        <div class="friend-meta">
          <div class="friend-name"></div>
          <div class="friend-status"></div>
        </div>
      </div>
      ${f.serverIp ? '<button class="btn-secondary friend-join-btn" style="height: 24px; font-size: 11px; padding: 0 8px; margin-right: 6px;">Dołącz</button>' : ''}
      <button class="friend-remove-btn" title="Usuń ${f.username}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    const avatarEl = item.querySelector('.friend-avatar');
    if (avatarEl) {
      avatarEl.alt = f.username;
      attachPlayerHeadImg(avatarEl, f.username, 32);
    }
    const nameEl = item.querySelector('.friend-name');
    if (nameEl) nameEl.textContent = f.username;
    const statusEl = item.querySelector('.friend-status');
    if (statusEl) statusEl.textContent = f.status || (f.online ? 'Aktywny' : 'Gracz Minecraft');

    item.querySelector('.friend-join-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(f.serverIp);
      showToast(`Skopiowano IP serwera ${f.username}: ${f.serverIp}. Wklej je w Minecraft (Multiplayer).`);
    });

    item.querySelector('.friend-remove-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const updated = await window.api.removeFriend(f.username);
        friendsList = updated;
        renderFriendsList(friendsList);
        showToast(`Usunięto ze znajomych: ${f.username}`);
      } catch (err) {
        showToast(`Błąd: ${err.message}`);
      }
    });

    item.addEventListener('click', () => {
      navigator.clipboard.writeText(f.username);
      showToast(`Skopiowano nick: ${f.username}`);
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

  setInterval(() => {
    if (!document.hidden) loadFriends();
  }, 60000);

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
  const s3SmpSub = document.getElementById('s3-smp-sub');

  try {
    const res = await fetch('https://api.mcsrvstat.us/3/szkolnesmp.com.pl');
    if (res.ok) {
      const data = await res.json();
      if (data && data.online) {
        if (badgePill) {
          badgePill.className = 'server-status-pill online';
        }
        if (labelText) labelText.textContent = 'Online';
        const online = data.players?.online ?? 0;
        const max = data.players?.max ?? 20;
        if (playersText) {
          playersText.textContent = `Gracze: ${online} / ${max}`;
        }
        if (s3SmpSub) {
          s3SmpSub.textContent = `Online • ${online}/${max} graczy`;
          s3SmpSub.style.color = '#34D399';
        }
        return;
      }
    }
  } catch (err) {
  }

  if (badgePill) {
    badgePill.className = 'server-status-pill offline';
  }
  if (labelText) labelText.textContent = 'Offline';
  if (playersText) playersText.textContent = 'Serwer wyłączony';
  if (s3SmpSub) {
    s3SmpSub.textContent = 'Serwer wyłączony';
    s3SmpSub.style.color = '';
  }
}

// ============================================================================
// ============================================================================
const SERVER_ENGINE_LABELS = {
  paper: 'Paper',
  purpur: 'Purpur',
  fabric: 'Fabric',
  vanilla: 'Vanilla'
};

let isServerRunning = false;
let isTunnelActive = false;
let isTunnelStarting = false;
let currentTunnelAddress = null;
let lastAnnouncedTunnelAddress = null;
let latestServerMetrics = null;
let serverMetricsPollTimer = null;
let serverUptimeClockTimer = null;

function formatDurationHMS(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatDiskSizeMb(mb) {
  const val = Number(mb) || 0;
  if (val >= 1024) return `${(val / 1024).toFixed(2)} GB`;
  if (val <= 0) return '0 MB';
  return val < 10 ? `${val.toFixed(1)} MB` : `${Math.round(val)} MB`;
}

function updateServerMetricsUI(m) {
  if (!m) return;
  latestServerMetrics = m;

  const running = !!m.running;
  const starting = !!m.starting;

  ['srv-card-cpu', 'srv-card-ram', 'srv-card-players', 'srv-card-uptime'].forEach(id => {
    document.getElementById(id)?.classList.toggle('is-live', running);
  });

  // 1. CPU
  const procCpu = Number(m.cpu?.processPct || 0);
  const sysCpu = Number(m.cpu?.systemPct || 0);
  const cores = m.cpu?.cores || 1;
  const threads = m.cpu?.threads || 0;

  const cpuVal = document.getElementById('srv-metric-cpu-val');
  const cpuBadge = document.getElementById('srv-metric-cpu-badge');
  const cpuBar = document.getElementById('srv-metric-cpu-bar');
  const cpuSysBar = document.getElementById('srv-metric-cpu-sysbar');
  const cpuSub = document.getElementById('srv-metric-cpu-sub');

  if (cpuVal) cpuVal.textContent = running ? `${procCpu.toFixed(1)}%` : '0.0%';
  if (cpuBadge) {
    if (running) {
      cpuBadge.textContent = `${threads || 1} wątków`;
      cpuBadge.className = `srv-metric-badge tnum ${procCpu >= 85 ? 'is-crit' : procCpu >= 65 ? 'is-warn' : 'is-online'}`;
    } else {
      cpuBadge.textContent = 'Wyłączony';
      cpuBadge.className = 'srv-metric-badge tnum';
    }
  }
  if (cpuSysBar) cpuSysBar.style.width = `${Math.min(100, sysCpu)}%`;
  if (cpuBar) {
    cpuBar.style.width = `${running ? Math.min(100, procCpu) : 0}%`;
    cpuBar.className = `srv-metric-fill ${procCpu >= 85 ? 'is-crit' : procCpu >= 65 ? 'is-warn' : ''}`;
  }
  if (cpuSub) cpuSub.textContent = `Cały PC: ${sysCpu.toFixed(1)}% • ${cores} wątków CPU`;

  // 2. RAM
  const usedMb = Number(m.ram?.usedMb || 0);
  const cfgRamGb = parseInt(document.getElementById('server-cfg-ram')?.value || '4', 10) || 4;
  const allocMb = Number(m.ram?.allocatedMb || (cfgRamGb * 1024));
  const ramPct = Number(m.ram?.pct || 0);
  const usedGbStr = (usedMb / 1024).toFixed(2);
  const allocGbStr = (allocMb / 1024).toFixed(1).replace(/\.0$/, '');
  const freeGbStr = ((m.ram?.systemFreeMb || 0) / 1024).toFixed(1);
  const totalGbStr = Math.round((m.ram?.systemTotalMb || 0) / 1024);

  const ramVal = document.getElementById('srv-metric-ram-val');
  const ramBadge = document.getElementById('srv-metric-ram-badge');
  const ramBar = document.getElementById('srv-metric-ram-bar');
  const ramSub = document.getElementById('srv-metric-ram-sub');

  if (ramVal) ramVal.textContent = `${running ? usedGbStr : '0.00'} / ${allocGbStr} GB`;
  if (ramBadge) {
    if (running) {
      ramBadge.textContent = `${Math.round(ramPct)}% limitu`;
      ramBadge.className = `srv-metric-badge tnum ${ramPct >= 90 ? 'is-crit' : ramPct >= 75 ? 'is-warn' : 'is-online'}`;
    } else {
      ramBadge.textContent = `Limit ${allocGbStr} GB`;
      ramBadge.className = 'srv-metric-badge tnum';
    }
  }
  if (ramBar) {
    ramBar.style.width = `${running ? Math.min(100, ramPct) : 0}%`;
    ramBar.className = `srv-metric-fill ${ramPct >= 90 ? 'is-crit' : ramPct >= 75 ? 'is-warn' : ''}`;
  }
  if (ramSub) ramSub.textContent = `Wolny RAM PC: ${freeGbStr} GB z ${totalGbStr} GB`;

  // 3. Players & Ping
  const online = Number(m.players?.online || 0);
  const maxP = Number(m.players?.max || 12);
  const playerNames = Array.isArray(m.players?.list) ? m.players.list : [];
  const pingMs = m.players?.pingMs;
  const lanOnly = !!m.players?.lanOnly;

  const pVal = document.getElementById('srv-metric-players-val');
  const pBadge = document.getElementById('srv-metric-players-badge');
  const pBar = document.getElementById('srv-metric-players-bar');
  const pSub = document.getElementById('srv-metric-players-sub');

  if (pVal) pVal.textContent = `${online} / ${maxP}`;
  if (pBadge) {
    if (starting) {
      pBadge.textContent = 'Startowanie';
      pBadge.className = 'srv-metric-badge tnum is-warn';
    } else if (running || lanOnly) {
      pBadge.textContent = pingMs ? `Ping ${pingMs} ms` : (lanOnly ? 'Świat LAN' : 'Online');
      pBadge.className = 'srv-metric-badge tnum is-online';
    } else {
      pBadge.textContent = 'Offline';
      pBadge.className = 'srv-metric-badge tnum';
    }
  }
  if (pBar) {
    const pPct = (running || lanOnly) && maxP > 0 ? Math.min(100, Math.round((online / maxP) * 100)) : 0;
    pBar.style.width = `${pPct}%`;
  }
  if (pSub) {
    if (starting) {
      pSub.textContent = 'Ładowanie świata i silnika...';
    } else if (running || lanOnly) {
      if (playerNames.length > 0) {
        const preview = playerNames.slice(0, 3).join(', ');
        pSub.textContent = `W grze: ${preview}${playerNames.length > 3 ? ` +${playerNames.length - 3}` : ''}`;
      } else if (online > 0) {
        pSub.textContent = `Aktywnych graczy: ${online}`;
      } else {
        pSub.textContent = 'Oczekiwanie na graczy';
      }
    } else {
      pSub.textContent = 'Serwer wyłączony';
    }
  }

  // 4. Uptime & Disk
  const uptimeSec = (running && m.startedAt)
    ? Math.max(0, Math.floor((Date.now() - m.startedAt) / 1000))
    : Number(m.uptimeSec || 0);

  const uVal = document.getElementById('srv-metric-uptime-val');
  const uBadge = document.getElementById('srv-metric-uptime-badge');
  const uBar = document.getElementById('srv-metric-uptime-bar');
  const uSub = document.getElementById('srv-metric-uptime-sub');

  if (uVal) uVal.textContent = formatDurationHMS(running ? uptimeSec : 0);
  if (uBadge) {
    if (starting) {
      uBadge.textContent = 'Rozruch';
      uBadge.className = 'srv-metric-badge tnum is-warn';
    } else if (running) {
      uBadge.textContent = m.tunnelActive ? 'Online • Tunel' : 'Online';
      uBadge.className = 'srv-metric-badge tnum is-online';
    } else {
      uBadge.textContent = 'Offline';
      uBadge.className = 'srv-metric-badge tnum';
    }
  }
  if (uBar) {
    uBar.style.width = running ? '100%' : '0%';
    uBar.className = `srv-metric-fill ${starting ? 'is-warn' : 'is-emerald'}`;
  }
  if (uSub) {
    uSub.textContent = `Świat: ${formatDiskSizeMb(m.disk?.worldMb || 0)} • Pliki: ${formatDiskSizeMb(m.disk?.totalMb || 0)}`;
  }
}

async function refreshServerMetricsOnce() {
  if (!window.api?.getServerMetrics) return;
  try {
    const m = await window.api.getServerMetrics();
    updateServerMetricsUI(m);
  } catch (_) {}
}

async function loadServerHosting() {
  try {
    const status = await window.api.getServerStatus();
    updateServerHostUI(status);
    refreshServerMetricsOnce();
    loadServerPlugins();
  } catch (err) {
    console.error('Błąd statusu serwera:', err);
  }
}

function updateServerTunnelUI(tunnel = {}) {
  isTunnelActive = !!tunnel.active;
  isTunnelStarting = !!tunnel.starting && !isTunnelActive;
  currentTunnelAddress = tunnel.publicAddress || null;

  const card = document.getElementById('server-tunnel-card');
  const badge = document.getElementById('server-tunnel-badge');
  const ipDisplay = document.getElementById('server-tunnel-ip-display');
  const portInput = document.getElementById('server-tunnel-port-input');
  const btnCopy = document.getElementById('btn-copy-tunnel-ip');
  const btnToggle = document.getElementById('btn-toggle-tunnel');

  card?.classList.toggle('is-active', isTunnelActive);

  if (portInput) {
    portInput.disabled = isTunnelActive || isTunnelStarting;
    if (tunnel.targetPort && document.activeElement !== portInput) {
      portInput.value = String(tunnel.targetPort);
    }
  }

  if (btnCopy) {
    btnCopy.disabled = !(isTunnelActive && currentTunnelAddress);
  }

  if (isTunnelActive && currentTunnelAddress) {
    if (badge) {
      badge.className = 'mod-tag status-on tnum';
      badge.textContent = 'Aktywny';
    }
    if (ipDisplay) {
      ipDisplay.textContent = currentTunnelAddress;
      ipDisplay.style.color = '#34D399';
    }
    if (btnToggle) {
      btnToggle.disabled = false;
      btnToggle.className = 'btn-danger-ghost';
      btnToggle.innerHTML = '<span>Zamknij tunel</span>';
    }
  } else if (isTunnelStarting) {
    if (badge) {
      badge.className = 'mod-tag tnum';
      badge.textContent = 'Łączenie...';
    }
    if (ipDisplay) {
      ipDisplay.textContent = tunnel.message || 'Tworzenie publicznego tunelu TCP (ok. 2–4 sek.)...';
      ipDisplay.style.color = '#FBBF24';
    }
    if (btnToggle) {
      btnToggle.disabled = false;
      btnToggle.className = 'btn-secondary';
      btnToggle.innerHTML = '<span class="spinner-ring" style="width: 13px; height: 13px;"></span><span>Łączenie...</span>';
    }
  } else {
    if (badge) {
      badge.className = 'mod-tag status-off tnum';
      badge.textContent = 'Wyłączony';
    }
    if (ipDisplay) {
      if (tunnel.error) {
        ipDisplay.textContent = `Błąd tunelu: ${tunnel.error}`;
        ipDisplay.style.color = '#F87171';
      } else {
        ipDisplay.textContent = 'Włącz serwer lub kliknij „Otwórz tunel”, aby uzyskać publiczne IP';
        ipDisplay.style.color = '';
      }
    }
    if (btnToggle) {
      btnToggle.disabled = false;
      btnToggle.className = 'btn-primary';
      btnToggle.innerHTML = '<span>Otwórz tunel</span>';
    }
  }
}

function readServerConfigFromInputs() {
  return {
    engine: document.getElementById('server-cfg-engine')?.value || 'paper',
    version: document.getElementById('server-cfg-version')?.value || '1.21.11',
    ram: parseInt(document.getElementById('server-cfg-ram')?.value || '4', 10),
    port: parseInt(document.getElementById('server-cfg-port')?.value || '25565', 10),
    onlineMode: document.getElementById('server-cfg-online-mode')?.value === 'true',
    autoTunnel: document.getElementById('server-cfg-auto-tunnel')?.value !== 'false',
    gamemode: document.getElementById('server-cfg-gamemode')?.value || 'survival',
    difficulty: document.getElementById('server-cfg-difficulty')?.value || 'normal',
    pvp: document.getElementById('server-cfg-pvp')?.value === 'true'
  };
}

function updateServerHostUI(status) {
  isServerRunning = !!status.running;
  const isBusy = isServerRunning || !!status.starting;
  const btn = document.getElementById('btn-toggle-server');
  const titleEl = document.getElementById('server-view-title');
  const statusText = document.getElementById('server-console-status-text');
  const statusDot = document.getElementById('server-console-dot');
  const sidebarServerDot = document.getElementById('sidebar-server-dot');
  const ipDisplay = document.getElementById('server-local-ip-display');
  const localhostDisplay = document.getElementById('server-localhost-ip-display');
  const tunnelPortInput = document.getElementById('server-tunnel-port-input');
  const engineSelect = document.getElementById('server-cfg-engine');
  const versionSelect = document.getElementById('server-cfg-version');
  const cmdInput = document.getElementById('server-cmd-input');
  const btnSend = document.getElementById('btn-send-server-cmd');

  if (sidebarServerDot) {
    sidebarServerDot.classList.toggle('visible', isServerRunning);
  }

  if (status.config) {
    const c = status.config;
    if (engineSelect && c.engine) engineSelect.value = c.engine;
    if (versionSelect && c.version) versionSelect.value = c.version;
    if (document.getElementById('server-cfg-ram')) document.getElementById('server-cfg-ram').value = c.ram || 4;
    if (document.getElementById('server-cfg-port')) document.getElementById('server-cfg-port').value = c.port || 25565;
    if (document.getElementById('server-cfg-online-mode')) document.getElementById('server-cfg-online-mode').value = String(!!c.onlineMode);
    if (document.getElementById('server-cfg-auto-tunnel')) document.getElementById('server-cfg-auto-tunnel').value = String(c.autoTunnel !== false);
    if (document.getElementById('server-cfg-gamemode')) document.getElementById('server-cfg-gamemode').value = c.gamemode || 'survival';
    if (document.getElementById('server-cfg-difficulty')) document.getElementById('server-cfg-difficulty').value = c.difficulty || 'normal';
    if (document.getElementById('server-cfg-pvp')) document.getElementById('server-cfg-pvp').value = String(c.pvp !== false);
  }

  const activePort = status.port || status.config?.port || parseInt(document.getElementById('server-cfg-port')?.value || '25565', 10) || 25565;
  const activeEngine = status.config?.engine || engineSelect?.value || 'paper';
  const activeVersion = status.config?.version || versionSelect?.value || '1.21.11';
  const engineLabel = SERVER_ENGINE_LABELS[activeEngine] || 'Paper';

  if (titleEl) {
    titleEl.textContent = `Serwer Lokalny (${engineLabel} ${activeVersion})`;
  }
  if (engineSelect) engineSelect.disabled = isBusy;
  if (versionSelect) versionSelect.disabled = isBusy;

  if (ipDisplay && status.localIp) {
    ipDisplay.textContent = `${status.localIp}:${activePort}`;
  }
  if (localhostDisplay) {
    localhostDisplay.textContent = `localhost:${activePort}`;
  }
  if (tunnelPortInput && !isTunnelActive && !isTunnelStarting && document.activeElement !== tunnelPortInput) {
    tunnelPortInput.value = String(activePort);
  }

  if (isServerRunning) {
    if (btn) {
      btn.className = 'btn-danger-ghost';
      btn.style.background = '';
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <rect x="4" y="4" width="16" height="16" rx="2"/>
        </svg>
        <span>Zatrzymaj Serwer</span>
      `;
    }
    if (statusText) {
      statusText.textContent = `Status: Serwer działa (${engineLabel} ${activeVersion})`;
      statusText.style.color = '#34D399';
    }
    if (statusDot) statusDot.style.display = 'inline-block';
    if (cmdInput) cmdInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
  } else {
    if (btn) {
      btn.className = 'btn-emerald';
      btn.style.background = '';
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
        <span>Uruchom Serwer</span>
      `;
    }
    if (statusText) {
      statusText.textContent = status.starting ? 'Status: Uruchamianie...' : 'Status: Wyłączony';
      statusText.style.color = status.starting ? '#FBBF24' : '#94A3B8';
    }
    if (statusDot) statusDot.style.display = 'none';
    if (cmdInput) cmdInput.disabled = true;
    if (btnSend) btnSend.disabled = true;
  }

  if (status.tunnel) {
    updateServerTunnelUI(status.tunnel);
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
  const btnOpenFolder = document.getElementById('btn-open-server-folder');
  const btnToggleTunnel = document.getElementById('btn-toggle-tunnel');
  const btnCopyTunnel = document.getElementById('btn-copy-tunnel-ip');
  const btnCopyLocal = document.getElementById('btn-copy-local-ip');
  const btnCopyLocalhost = document.getElementById('btn-copy-localhost-ip');
  const cmdInput = document.getElementById('server-cmd-input');
  const btnSend = document.getElementById('btn-send-server-cmd');

  btnOpenFolder?.addEventListener('click', async () => {
    try {
      await window.api.openServerFolder();
      showToast('Otwarto folder serwera.');
    } catch (err) {
      showToast(`Błąd otwierania folderu: ${err.message}`);
    }
  });

  btnToggleTunnel?.addEventListener('click', async () => {
    if (isTunnelActive || isTunnelStarting) {
      lastAnnouncedTunnelAddress = null;
      try {
        await window.api.stopServerTunnel();
        updateServerTunnelUI({ active: false, starting: false, publicAddress: null });
        showToast('Zamknięto publiczny tunel.');
      } catch (err) {
        showToast(`Błąd zamykania tunelu: ${err.message}`);
      }
      return;
    }

    const rawPort = document.getElementById('server-tunnel-port-input')?.value
      || document.getElementById('server-cfg-port')?.value
      || '25565';
    const port = parseInt(rawPort, 10) || 25565;

    updateServerTunnelUI({
      active: false,
      starting: true,
      targetPort: port,
      message: `Otwieranie publicznego tunelu dla portu ${port}...`
    });

    try {
      const res = await window.api.startServerTunnel(port);
      updateServerTunnelUI(res);
      if (res?.publicAddress) {
        lastAnnouncedTunnelAddress = res.publicAddress;
        navigator.clipboard.writeText(res.publicAddress).catch(() => {});
        showToast(`Tunel otwarty! Skopiowano adres dla znajomych: ${res.publicAddress}`);
      }
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      updateServerTunnelUI({ active: false, starting: false, error: cleanErr });
      showToast(`Błąd tunelu: ${cleanErr}`);
    }
  });

  btnCopyTunnel?.addEventListener('click', () => {
    if (!currentTunnelAddress) return;
    navigator.clipboard.writeText(currentTunnelAddress);
    showToast(`Skopiowano publiczny adres dla znajomych: ${currentTunnelAddress}`);
  });

  btnCopyLocal?.addEventListener('click', () => {
    const ip = document.getElementById('server-local-ip-display')?.textContent || '127.0.0.1:25565';
    navigator.clipboard.writeText(ip);
    showToast(`Skopiowano adres LAN: ${ip}`);
  });

  btnCopyLocalhost?.addEventListener('click', () => {
    const addr = document.getElementById('server-localhost-ip-display')?.textContent || 'localhost:25565';
    navigator.clipboard.writeText(addr);
    showToast(`Skopiowano adres: ${addr}`);
  });

  const cfgInputs = [
    'server-cfg-engine', 'server-cfg-version', 'server-cfg-ram', 'server-cfg-port',
    'server-cfg-online-mode', 'server-cfg-auto-tunnel', 'server-cfg-gamemode',
    'server-cfg-difficulty', 'server-cfg-pvp'
  ];
  cfgInputs.forEach(id => {
    document.getElementById(id)?.addEventListener('change', async () => {
      const newCfg = readServerConfigFromInputs();
      await window.api.saveServerConfig(newCfg);
      const titleEl = document.getElementById('server-view-title');
      const engineLabel = SERVER_ENGINE_LABELS[newCfg.engine] || 'Paper';
      if (titleEl) titleEl.textContent = `Serwer Lokalny (${engineLabel} ${newCfg.version})`;
      const lh = document.getElementById('server-localhost-ip-display');
      if (lh) lh.textContent = `localhost:${newCfg.port}`;
      const tp = document.getElementById('server-tunnel-port-input');
      if (tp && !isTunnelActive && !isTunnelStarting) tp.value = String(newCfg.port);
      if (id === 'server-cfg-engine') {
        loadServerPlugins();
      }
      refreshServerMetricsOnce();
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
      const newCfg = readServerConfigFromInputs();
      const engineLabel = SERVER_ENGINE_LABELS[newCfg.engine] || 'Paper';
      showToast(`Uruchamianie serwera ${engineLabel} ${newCfg.version}...`);
      try {
        await window.api.saveServerConfig(newCfg);
        await window.api.startServer();
      } catch (err) {
        const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
        showToast(`Błąd startu serwera: ${cleanErr}`);
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

  window.api.onServerLog((line) => {
    appendServerLog(line);
  });

  window.api.onServerMetrics?.((metrics) => {
    updateServerMetricsUI(metrics);
  });

  if (!serverMetricsPollTimer) {
    serverMetricsPollTimer = setInterval(() => {
      const srvView = document.getElementById('view-server');
      if (srvView?.classList.contains('active') && !isServerRunning) {
        refreshServerMetricsOnce();
      }
    }, 2500);
  }

  if (!serverUptimeClockTimer) {
    serverUptimeClockTimer = setInterval(() => {
      if (!latestServerMetrics?.running || !latestServerMetrics?.startedAt) return;
      const uVal = document.getElementById('srv-metric-uptime-val');
      if (uVal) {
        const sec = Math.max(0, Math.floor((Date.now() - latestServerMetrics.startedAt) / 1000));
        uVal.textContent = formatDurationHMS(sec);
      }
    }, 1000);
  }

  window.api.onServerTunnelStatus?.((data) => {
    updateServerTunnelUI(data || {});
    if (data?.active && data?.publicAddress && data.publicAddress !== lastAnnouncedTunnelAddress) {
      lastAnnouncedTunnelAddress = data.publicAddress;
      navigator.clipboard.writeText(data.publicAddress).catch(() => {});
      showToast(`Tunel publiczny gotowy! Skopiowano adres: ${data.publicAddress}`);
    }
    if (!data?.active && !data?.starting) {
      lastAnnouncedTunnelAddress = null;
    }
  });

  window.api.onLanDetected?.((data) => {
    if (!data?.port) return;
    const tp = document.getElementById('server-tunnel-port-input');
    if (tp && !isTunnelActive && !isTunnelStarting) {
      tp.value = String(data.port);
    }
    showToast(`Wykryto świat LAN (port ${data.port}) — możesz udostępnić go znajomym w zakładce Serwer Lokalny!`);
  });

  window.api.onServerStatus((data) => {
    if (data.status === 'running') {
      const cfg = readServerConfigFromInputs();
      const engineLabel = SERVER_ENGINE_LABELS[cfg.engine] || 'Paper';
      showToast(`Serwer ${engineLabel} ${cfg.version} jest już Online!`);
      loadServerHosting();
    } else if (data.status === 'stopped') {
      showToast('Serwer został zatrzymany.');
      loadServerHosting();
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
    const ver = document.getElementById('server-cfg-version')?.value || '1.21.11';
    if (statusText) statusText.textContent = `Pobieranie silnika serwera ${ver}: ${data.pct}%`;
  });

  setupServerPluginsListeners();
}

// ========================================================
// SERVER PLUGINS & ADDONS MANAGER
// ========================================================

let serverPluginsActiveTab = 'browse';
let serverPluginsSearchQuery = '';
let serverPluginsCurrentFilter = 'all';
let serverPluginsInstalledList = [];
let serverPluginsSearchResults = [];
let serverPluginsSearchDebounce = null;
let serverPluginsIsSearching = false;
const installingPluginsSet = new Set();

function formatCompactNumber(num) {
  const n = Number(num) || 0;
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

async function loadServerPlugins() {
  const warnEl = document.getElementById('server-plugins-vanilla-warn');
  const searchBar = document.getElementById('server-plugins-search-bar');
  const countBadge = document.getElementById('server-plugins-count-badge');
  const installedCount = document.getElementById('srv-installed-count');
  const subdesc = document.getElementById('server-plugins-subdesc');

  if (!window.api?.getServerPlugins) return;

  try {
    const res = await window.api.getServerPlugins();
    if (!res.supported) {
      if (warnEl) warnEl.style.display = 'flex';
      if (searchBar) searchBar.style.display = 'none';
      if (countBadge) countBadge.textContent = 'Vanilla (Brak pluginów)';
      if (installedCount) installedCount.textContent = '0';
      const browseGrid = document.getElementById('server-plugins-browse-grid');
      const instList = document.getElementById('server-plugins-installed-list');
      if (browseGrid) browseGrid.innerHTML = '';
      if (instList) instList.innerHTML = '';
      return;
    }

    if (warnEl) warnEl.style.display = 'none';
    if (searchBar) searchBar.style.display = 'flex';

    serverPluginsInstalledList = res.items || [];
    const count = serverPluginsInstalledList.length;

    if (countBadge) {
      countBadge.textContent = count > 0 ? `${count} ${count === 1 ? 'zainstalowany' : (count < 5 ? 'zainstalowane' : 'zainstalowanych')}` : '0 zainstalowanych';
    }
    if (installedCount) {
      installedCount.textContent = String(count);
    }
    if (subdesc && res.label) {
      subdesc.textContent = res.type === 'mods'
        ? 'Pobieraj modyfikacje serwerowe Fabric bezpośrednio z bazy Modrinth.'
        : 'Pobieraj oficjalne pluginy z Modrinth w 1 kliknięcie (Geyser do Bedrocka, ViaVersion, EssentialsX, SkinsRestorer, Chunky, WorldEdit).';
    }

    renderInstalledServerPlugins(serverPluginsInstalledList);

    if (serverPluginsSearchResults.length === 0 && !serverPluginsIsSearching) {
      searchServerPluginsModrinth(serverPluginsSearchQuery, serverPluginsCurrentFilter);
    }
  } catch (err) {
    console.error('Błąd loadServerPlugins:', err);
  }
}

function renderInstalledServerPlugins(items = []) {
  const container = document.getElementById('server-plugins-installed-list');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <div class="server-plugins-empty">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="color: var(--text-muted); opacity: 0.7;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <div style="font-weight: 600; color: var(--text-secondary);">Brak zainstalowanych pluginów</div>
        <div>Przejdź do zakładki „Szukaj w Modrinth”, aby pobrać pierwsze wtyczki (np. Geyser, ViaVersion, EssentialsX).</div>
        <button class="btn-primary" style="margin-top: 6px;" onclick="window.switchServerPluginsTab('browse')">Przeglądaj Modrinth</button>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="server-installed-row ${item.enabled ? '' : 'is-disabled'}" data-file="${escapeHtml(item.filename)}">
      <div class="server-installed-info">
        <div class="server-installed-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
        </div>
        <div class="server-installed-text">
          <div class="server-installed-name">
            ${escapeHtml(item.displayName)}
            ${item.version ? `<span class="mod-tag tnum" style="margin-left: 6px;">v${escapeHtml(item.version)}</span>` : ''}
            <span class="mod-tag tnum" style="margin-left: 4px; font-weight: normal; color: var(--text-muted);">${escapeHtml(item.sizeFormatted)}</span>
          </div>
          <div class="server-installed-meta">
            ${item.description ? escapeHtml(item.description) : escapeHtml(item.filename)}
            ${item.author ? ` • Autor: ${escapeHtml(item.author)}` : ''}
          </div>
        </div>
      </div>

      <div class="server-installed-actions">
        <span class="mod-tag ${item.enabled ? 'status-on' : 'status-off'} tnum" style="font-size: 10.5px;">
          ${item.enabled ? 'Aktywny' : 'Wyłączony'}
        </span>
        <label class="ui-switch" title="${item.enabled ? 'Wyłącz plugin' : 'Włącz plugin'}">
          <input type="checkbox" ${item.enabled ? 'checked' : ''} onchange="window.handleToggleServerPlugin('${escapeHtml(item.filename)}')">
          <span class="switch-slider"></span>
        </label>
        <button class="btn-danger-ghost" style="padding: 4px 8px; height: 30px;" title="Usuń plugin" onclick="window.handleDeleteServerPlugin('${escapeHtml(item.filename)}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </div>
    </div>
  `).join('');
}

async function searchServerPluginsModrinth(query = '', filter = 'all') {
  const container = document.getElementById('server-plugins-browse-grid');
  if (!container) return;

  serverPluginsIsSearching = true;
  container.innerHTML = `
    <div style="grid-column: 1 / -1; padding: 36px 20px; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <span class="spinner-ring" style="width: 22px; height: 22px;"></span>
      <span>Wyszukiwanie pluginów w bazie Modrinth...</span>
    </div>
  `;

  try {
    const res = await window.api.searchServerPlugins({ query, filter, limit: 24 });
    serverPluginsSearchResults = res?.hits || [];
    renderModrinthPluginsGrid(serverPluginsSearchResults);
  } catch (err) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 30px; text-align: center; color: #F87171;">
        Błąd wyszukiwania: ${escapeHtml(err.message)}
      </div>
    `;
  } finally {
    serverPluginsIsSearching = false;
  }
}

function renderModrinthPluginsGrid(hits = []) {
  const container = document.getElementById('server-plugins-browse-grid');
  if (!container) return;

  if (!hits || hits.length === 0) {
    container.innerHTML = `
      <div class="server-plugins-empty" style="grid-column: 1 / -1;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <div>Nie znaleziono pluginów pasujących do wyszukiwania.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = hits.map(hit => {
    const isInstalling = installingPluginsSet.has(hit.slug);
    const isInstalled = hit.isInstalled;

    let btnMarkup = '';
    if (isInstalled) {
      btnMarkup = `
        <button class="btn-secondary" style="height: 28px; padding: 0 10px; font-size: 11px; color: #34D399; pointer-events: none;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Zainstalowany</span>
        </button>
      `;
    } else if (isInstalling) {
      btnMarkup = `
        <button class="btn-primary" style="height: 28px; padding: 0 10px; font-size: 11px;" disabled>
          <span class="spinner-ring" style="width: 11px; height: 11px;"></span>
          <span>Pobieranie...</span>
        </button>
      `;
    } else {
      btnMarkup = `
        <button class="btn-emerald" style="height: 28px; padding: 0 11px; font-size: 11px;" onclick="window.handleInstallServerPlugin('${escapeHtml(hit.slug)}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>Zainstaluj</span>
        </button>
      `;
    }

    const iconMarkup = hit.icon_url
      ? `<img src="${escapeHtml(hit.icon_url)}" class="server-plugin-icon" alt="" onerror="this.outerHTML='<div class=\\\'server-plugin-icon\\\'><svg width=\\\'18\\\' height=\\\'18\\\' viewBox=\\\'0 0 24 24\\\' fill=\\\'none\\\' stroke=\\\'currentColor\\\' stroke-width=\\\'2\\\'><rect x=\\\'3\\\' y=\\\'3\\\' width=\\\'18\\\' height=\\\'18\\\' rx=\\\'2\\\'/></svg></div>'">`
      : `<div class="server-plugin-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div>`;

    return `
      <div class="server-plugin-card">
        <div class="server-plugin-top">
          ${iconMarkup}
          <div class="server-plugin-meta">
            <div class="server-plugin-name" title="${escapeHtml(hit.title)}">${escapeHtml(hit.title)}</div>
            <div class="server-plugin-author">${hit.author ? `Autor: ${escapeHtml(hit.author)}` : ''}</div>
          </div>
        </div>
        <div class="server-plugin-desc">${escapeHtml(hit.description || '')}</div>
        <div class="server-plugin-foot">
          <div class="server-plugin-stats">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>${formatCompactNumber(hit.downloads)} pobrań</span>
          </div>
          ${btnMarkup}
        </div>
      </div>
    `;
  }).join('');
}

window.handleInstallServerPlugin = async function (slug) {
  if (!slug || installingPluginsSet.has(slug)) return;
  installingPluginsSet.add(slug);
  renderModrinthPluginsGrid(serverPluginsSearchResults);
  showToast(`Pobieranie pluginu ${slug}...`);

  try {
    const res = await window.api.installServerPlugin({ slug });
    showToast(`Pomyślnie zainstalowano ${res.filename || slug}!`);
    await loadServerPlugins();
    await searchServerPluginsModrinth(serverPluginsSearchQuery, serverPluginsCurrentFilter);
  } catch (err) {
    showToast(`Błąd instalacji pluginu: ${err.message}`);
  } finally {
    installingPluginsSet.delete(slug);
    renderModrinthPluginsGrid(serverPluginsSearchResults);
  }
};

window.handleToggleServerPlugin = async function (filename) {
  try {
    const res = await window.api.toggleServerPlugin(filename);
    showToast(`${res.enabled ? 'Włączono' : 'Wyłączono'} plugin: ${res.newFilename}`);
    await loadServerPlugins();
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
};

window.handleDeleteServerPlugin = async function (filename) {
  if (!confirm(`Czy na pewno chcesz usunąć plugin „${filename}”?`)) return;
  try {
    await window.api.deleteServerPlugin(filename);
    showToast(`Usunięto plugin ${filename}.`);
    await loadServerPlugins();
    await searchServerPluginsModrinth(serverPluginsSearchQuery, serverPluginsCurrentFilter);
  } catch (err) {
    showToast(`Błąd usuwania: ${err.message}`);
  }
};

window.switchServerPluginsTab = function (tabName) {
  serverPluginsActiveTab = tabName;
  const browseBtn = document.getElementById('srv-tab-browse');
  const instBtn = document.getElementById('srv-tab-installed');
  const browsePane = document.getElementById('server-plugins-browse-pane');
  const instPane = document.getElementById('server-plugins-installed-pane');
  const searchBar = document.getElementById('server-plugins-search-bar');

  if (tabName === 'browse') {
    browseBtn?.classList.add('active');
    instBtn?.classList.remove('active');
    if (browsePane) browsePane.style.display = 'block';
    if (instPane) instPane.style.display = 'none';
    if (searchBar) searchBar.style.display = 'flex';
  } else {
    browseBtn?.classList.remove('active');
    instBtn?.classList.add('active');
    if (browsePane) browsePane.style.display = 'none';
    if (instPane) instPane.style.display = 'block';
    if (searchBar) searchBar.style.display = 'none';
  }
};

function setupServerPluginsListeners() {
  document.getElementById('srv-tab-browse')?.addEventListener('click', () => {
    window.switchServerPluginsTab('browse');
  });

  document.getElementById('srv-tab-installed')?.addEventListener('click', () => {
    window.switchServerPluginsTab('installed');
  });

  document.getElementById('btn-open-plugins-folder')?.addEventListener('click', async () => {
    try {
      await window.api.openServerPluginsFolder();
      showToast('Otwarto folder pluginów.');
    } catch (err) {
      showToast(`Błąd otwierania folderu: ${err.message}`);
    }
  });

  const searchInput = document.getElementById('server-plugins-search-input');
  const clearBtn = document.getElementById('btn-clear-plugins-search');

  searchInput?.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    serverPluginsSearchQuery = q;
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    if (serverPluginsSearchDebounce) clearTimeout(serverPluginsSearchDebounce);
    serverPluginsSearchDebounce = setTimeout(() => {
      searchServerPluginsModrinth(serverPluginsSearchQuery, serverPluginsCurrentFilter);
    }, 320);
  });

  clearBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      serverPluginsSearchQuery = '';
      clearBtn.style.display = 'none';
      searchServerPluginsModrinth('', serverPluginsCurrentFilter);
    }
  });

  const chips = document.querySelectorAll('.server-plugins-chips .srv-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      serverPluginsCurrentFilter = chip.getAttribute('data-filter') || 'all';
      searchServerPluginsModrinth(serverPluginsSearchQuery, serverPluginsCurrentFilter);
    });
  });
}

// ========================================================
// ========================================================
const BUILTIN_CAPES = {
  kasteusz: { name: "Kasteusz Studio", url: "assets/capes/kasteusz.png" },
  mcqueen95: { name: "Zygzak McQueen #95", url: "assets/capes/mcqueen95.png" },
  szkolnesmp: { name: "Szkolne SMP", url: "assets/capes/szkolnesmp.png" },
  fire_dragon: { name: "Ognisty Płomień", url: "assets/capes/fire_dragon.png" },
  aurora: { name: "Zorza Polarna", url: "assets/capes/aurora.png" },
  void_crystal: { name: "Kryształ Pustki", url: "assets/capes/void_crystal.png" },
  golden_crown: { name: "Złota Korona", url: "assets/capes/golden_crown.png" },
  neon_circuit: { name: "Neonowy Obwód", url: "assets/capes/neon_circuit.png" }
};

let currentCapeId = "kasteusz";
let isPlayerFlipped = false;

function openWardrobeModal() {
  syncSkinVariantButtons();
  updateWardrobeSkinSyncBanner();
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

    card.addEventListener("click", async () => {
      applyCape(capeUrl, true);
      if (account.isPremium && c.id && window.api?.setMojangCape) {
        try {
          await window.api.setMojangCape(c.id);
          showToast(`Założono oficjalną pelerynkę ${c.alias || "Mojang"} w samej grze!`);
          return;
        } catch (err) {
          console.warn('Uwaga przy ustawianiu pelerynki Mojang:', err);
        }
      }
      showToast(`Założono pelerynkę: ${c.alias || "Mojang"}!`);
    });

    if (currentCapeId === capeUrl) card.classList.add("active");
    container.appendChild(card);
  });
}

function setupWardrobeListeners() {
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

  document.querySelectorAll("#capes-grid .cape-item-card").forEach(card => {
    card.addEventListener("click", () => {
      const id = card.dataset.capeId;
      applyCape(id, true);
      const name = BUILTIN_CAPES[id]?.name || "Pelerynka";
      showToast(`Założono pelerynkę: ${name}!`);
    });
  });

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

  elements.btnRemoveCape?.addEventListener("click", async () => {
    applyCape("none", true);
    if (currentAccount?.isPremium && window.api?.setMojangCape) {
      try { await window.api.setMojangCape("none"); } catch (_) {}
    }
    showToast("Pelerynka została zdjęta.");
  });

  const btnInstallCsl = document.getElementById('btn-wardrobe-install-csl');
  btnInstallCsl?.addEventListener('click', async () => {
    const activeProf = getActiveProfileObj();
    const activeMcVer = (activeProf?.mcVersion || currentSelectedVersionId || '1.21.11').replace(/^(fabric|quilt)-/, '');
    const origText = btnInstallCsl.textContent;
    btnInstallCsl.disabled = true;
    btnInstallCsl.textContent = 'Pobieranie...';
    try {
      const res = await window.api.installModrinthMod({
        projectId: 'customskinloader',
        slug: 'customskinloader',
        gameVersion: activeMcVer,
        loader: activeProf?.loader || 'fabric'
      });
      if (res?.mods) {
        installedMods = res.mods;
        renderModsList(installedMods);
      }
      await loadProfiles();
      updateWardrobeSkinSyncBanner();
      showToast('Dograno CustomSkinLoader! Twoja skórka i pelerynka będą widoczne na każdym serwerze w trybie Offline.');
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd pobierania CustomSkinLoader: ${cleanErr}`);
    } finally {
      btnInstallCsl.disabled = false;
      btnInstallCsl.textContent = origText;
    }
  });

  const handleVariantSwitch = async (variant) => {
    const norm = variant === 'SLIM' ? 'SLIM' : 'CLASSIC';
    if (currentSkinVariant === norm) return;
    currentSkinVariant = norm;
    syncSkinVariantButtons();
    const skinToUse = currentAccount?.skinUrl || currentAccount?.customSkinUrl || getDefaultSkinForAccount(currentAccount);
    updateSkinDisplay(skinToUse, norm);
    if (currentAccount) {
      try {
        const updated = await window.api.setCustomSkin(skinToUse, norm);
        if (updated) await applyAccountToUI(updated);
        showToast(norm === 'SLIM' ? 'Ustawiono smukłe ramiona (Alex • 3px) w grze.' : 'Ustawiono klasyczne ramiona (Steve • 4px) w grze.');
      } catch (err) {
        const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
        showToast(`Błąd zmiany modelu ramion: ${cleanErr}`);
      }
    }
  };

  document.getElementById('skin-variant-classic')?.addEventListener('click', () => handleVariantSwitch('CLASSIC'));
  document.getElementById('skin-variant-slim')?.addEventListener('click', () => handleVariantSwitch('SLIM'));

  elements.btnPresetMcqueen?.addEventListener("click", async () => {
    if (!isOwnerAccount(currentAccount)) {
      showToast("Ta unikalna skórka Zygzaka McQueena #95 jest zarezerwowana wyłącznie dla Właściciela!");
      return;
    }
    currentSkinVariant = 'CLASSIC';
    syncSkinVariantButtons();
    updateSkinDisplay("assets/mcqueen-skin.png", 'CLASSIC');
    try {
      const updated = await window.api.setCustomSkin("assets/mcqueen-skin.png", 'CLASSIC');
      if (updated) await applyAccountToUI(updated);
      showToast(updated?.isPremium ? "Wysłano skórkę Zygzaka McQueena na konto Microsoft!" : "Założono skórkę Zygzaka McQueena #95 w grze!");
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd zapisu skórki: ${cleanErr}`);
    }
  });

  elements.btnPresetSteve?.addEventListener("click", async () => {
    const url = "https://textures.minecraft.net/texture/1a406e897914457613d760ab577a34d35388b73d263f9d4ca4570b5f816b3fb9";
    currentSkinVariant = 'CLASSIC';
    syncSkinVariantButtons();
    updateSkinDisplay(url, 'CLASSIC');
    try {
      const updated = await window.api.setCustomSkin(url, 'CLASSIC');
      if (updated) await applyAccountToUI(updated);
      showToast(updated?.isPremium ? "Wysłano skórkę Steve na konto Microsoft!" : "Założono skórkę Steve w grze!");
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd zapisu skórki: ${cleanErr}`);
    }
  });

  elements.btnPresetAlex?.addEventListener("click", async () => {
    const url = "https://textures.minecraft.net/texture/e5585b88c7dd884ec71b83d693eeab61a5867ff4691bc9dbb2eb5420a32194b6";
    currentSkinVariant = 'SLIM';
    syncSkinVariantButtons();
    updateSkinDisplay(url, 'SLIM');
    try {
      const updated = await window.api.setCustomSkin(url, 'SLIM');
      if (updated) await applyAccountToUI(updated);
      showToast(updated?.isPremium ? "Wysłano skórkę Alex (3px) na konto Microsoft!" : "Założono skórkę Alex (3px) w grze!");
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd zapisu skórki: ${cleanErr}`);
    }
  });

  elements.btnWardrobeFetchNick?.addEventListener("click", async () => {
    const nick = elements.wardrobeNickInput?.value.trim();
    if (!nick) {
      showToast("Wpisz nick gracza Minecraft.");
      return;
    }
    showToast(currentAccount?.isPremium
      ? `Pobieranie skórki ${nick} i wysyłanie na konto Microsoft...`
      : `Pobieranie skórki gracza ${nick}...`);
    try {
      const url = await window.api.getSkinUrl(nick);
      if (url) {
        updateSkinDisplay(url, currentSkinVariant);
        const updated = await window.api.setCustomSkin(url, currentSkinVariant);
        if (updated) await applyAccountToUI(updated);
        showToast(updated?.isPremium
          ? `Wgrano skórkę gracza ${nick} na Twoje konto Microsoft!`
          : `Założono skórkę gracza ${nick} w grze!`);
      }
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd pobierania skórki: ${cleanErr}`);
    }
  });

  elements.wardrobeNickInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elements.btnWardrobeFetchNick?.click();
    }
  });

  elements.btnWardrobeUploadSkin?.addEventListener("click", async () => {
    try {
      const updated = await window.api.selectSkinFile(currentSkinVariant);
      if (updated) {
        await applyAccountToUI(updated);
        showToast(updated.isPremium
          ? "Wysłano własną skórkę .png na Twoje konto Microsoft!"
          : "Zapisano własną skórkę .png bezpośrednio w plikach gry!");
      }
    } catch (err) {
      const cleanErr = (err.message || '').replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
      showToast(`Błąd ładowania skórki: ${cleanErr}`);
    }
  });
}

// ========================================================
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
    if (isOwnerAccount(currentAccount)) {
      elements.profileStatRank.innerHTML = '<span style="color: #F59E0B; font-weight: 700;">👑 Właściciel</span>';
    } else {
      elements.profileStatRank.textContent = String(statsData.rankTitle || 'Gracz Kasteusz').trim() || 'Gracz';
    }
  }

  syncS2StatsWidget(statsData);
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
// ========================================================
const THEME_NAMES = {
  purple: "Indigo Obsidian",
  red: "Crimson #95",
  emerald: "Emerald SMP",
  cyan: "Cyber Cyan",
  gold: "Amber Gold",
  ruby: "Obsidian Rose"
};

function applyTheme(themeName, save = true) {
  const allowed = ["purple", "red", "emerald", "cyan", "gold", "ruby"];
  const theme = allowed.includes(themeName) ? themeName : "purple";

  document.documentElement.setAttribute("data-theme", theme);
  document.body.setAttribute("data-theme", theme);
  try { localStorage.setItem("kasteusz_theme_accent", theme); } catch (_) {}

  document.querySelectorAll(".theme-card").forEach(card => {
    card.classList.toggle("active", card.dataset.theme === theme);
  });

  const logoEl = document.querySelector(".logo-icon");
  if (logoEl) {
    logoEl.style.filter = "drop-shadow(0 0 8px var(--accent-glow))";
  }

  try {
    window.liveWallpapers?.updateThemeColors?.();
  } catch (_) {}

  if (save) {
    window.api.saveConfig({ themeAccent: theme });
    showToast(`Aktywowano motyw: ${THEME_NAMES[theme] || theme}`);
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
// LAUNCHER UI STYLES (STYL 1 / STYL 2 BADLION / STYL 3 AUTORSKI)
// ==========================================================================
const LAUNCHER_STYLE_LABELS = {
  style1: 'Styl 1',
  style2: 'Styl 2',
  style3: 'Styl 3'
};

let currentLauncherStyle = 'style1';
let s2QuickModFilterText = '';
let s3RotatorTimer = null;
let s3RotatorIndex = 0;

const S3_KINETIC_PHRASES = [
  'ZE ZNAJOMYMI.',
  'NA SERWER.',
  'DO GRY.',
  'I GRASZ.'
];

function renderS3KineticWord(phrase) {
  const container = document.getElementById('s3-kinetic-word');
  if (!container) return;
  container.innerHTML = '';
  const chars = Array.from(String(phrase || ''));
  chars.forEach((ch, idx) => {
    const span = document.createElement('span');
    span.className = ch === ' ' ? 's3-char is-space' : 's3-char';
    span.style.setProperty('--char-idx', String(idx));
    span.textContent = ch === ' ' ? '\u00A0' : ch;
    container.appendChild(span);
  });

  const rule = document.querySelector('.s3-heading-rule');
  if (rule) {
    rule.style.animation = 'none';
    void rule.offsetWidth;
    rule.style.animation = 's3RuleExpand 0.6s cubic-bezier(0.16, 1, 0.3, 1) both';
  }
}

function startS3KineticRotator() {
  if (s3RotatorTimer) clearInterval(s3RotatorTimer);
  renderS3KineticWord(S3_KINETIC_PHRASES[s3RotatorIndex]);

  s3RotatorTimer = setInterval(() => {
    s3RotatorIndex = (s3RotatorIndex + 1) % S3_KINETIC_PHRASES.length;
    renderS3KineticWord(S3_KINETIC_PHRASES[s3RotatorIndex]);
  }, 3800);
}

function applyLauncherStyleUI(styleName) {
  const allowed = ['style1', 'style2', 'style3'];
  const normalized = allowed.includes(styleName) ? styleName : 'style1';
  currentLauncherStyle = normalized;

  document.documentElement.setAttribute('data-ui-style', normalized);
  document.body.setAttribute('data-ui-style', normalized);
  try {
    localStorage.setItem('kasteusz_launcher_style', normalized);
  } catch (_) {}

  document.querySelectorAll('.launcher-style-card').forEach(card => {
    card.classList.toggle('active', card.dataset.launcherStyle === normalized);
  });

  if (!isGameLaunching && elements.playBtnText) {
    elements.playBtnText.textContent = normalized === 'style2' ? 'GRAJ' : 'URUCHOM GRĘ';
  }

  if (normalized === 'style3') {
    startS3KineticRotator();
  } else if (s3RotatorTimer) {
    clearInterval(s3RotatorTimer);
    s3RotatorTimer = null;
  }

  syncS2ProfileWidget();
  renderS2ModpacksWidget();
  renderS2QuickModsWidget(installedMods);
  syncS3HeroWidget();

  setTimeout(handleViewerResize, 60);
  setTimeout(handleViewerResize, 240);
}

async function switchLauncherStyleWithRestart(targetStyle) {
  const allowed = ['style1', 'style2', 'style3'];
  if (!allowed.includes(targetStyle)) return;

  if (targetStyle === currentLauncherStyle) {
    showToast(`${LAUNCHER_STYLE_LABELS[targetStyle]} jest już aktywny.`);
    return;
  }

  try { window.uiSounds?.playClick?.(); } catch (_) {}

  try {
    localStorage.setItem('kasteusz_launcher_style', targetStyle);
  } catch (_) {}

  try {
    await window.api.saveConfig({ launcherStyle: targetStyle });
    if (currentConfig) currentConfig.launcherStyle = targetStyle;
  } catch (err) {
    console.error('Błąd zapisu stylu launchera:', err);
  }

  const overlay = document.getElementById('style-restart-overlay');
  const titleEl = document.getElementById('style-restart-title');
  if (titleEl) {
    titleEl.textContent = `Przełączanie na ${LAUNCHER_STYLE_LABELS[targetStyle]}...`;
  }
  if (overlay) {
    overlay.style.display = 'flex';
  }

  setTimeout(async () => {
    try {
      if (window.api?.restartApp) {
        await window.api.restartApp();
      } else {
        window.location.reload();
      }
    } catch (_) {
      window.location.reload();
    }
  }, 380);
}

function jumpToModrinthModpacks() {
  switchToTab('mods');
  if (typeof window.switchModsSubtab === 'function') {
    window.switchModsSubtab('modrinth');
  }
  setTimeout(() => {
    const packBtn = document.getElementById('modrinth-type-modpack');
    if (packBtn) packBtn.click();
  }, 80);
}

function syncS3HeroWidget() {
  const techMeta = document.getElementById('s3-tech-meta');
  const subNick = document.getElementById('s3-sub-nick');
  const subProf = document.getElementById('s3-sub-profile');
  const pickerKicker = document.getElementById('s3-picker-kicker');
  const pickerName = document.getElementById('s3-picker-name');
  const modsMain = document.getElementById('s3-mods-main');

  const activeProf = typeof getActiveProfileObj === 'function' ? getActiveProfileObj() : null;
  const loaderLabel = activeProf ? (LOADER_LABELS[activeProf.loader] || activeProf.loader || 'Fabric') : 'Fabric';
  const verText = activeProf
    ? (activeProf.loader === 'custom' && activeProf.customVersionId ? activeProf.customVersionId : activeProf.mcVersion)
    : (currentConfig?.selectedVersion || '1.21.11');
  const ramGb = activeProf?.memoryMax || currentConfig?.memoryMax || 4;
  const profName = activeProf?.name || 'Kasteusz Main';

  if (techMeta) {
    techMeta.textContent = `gotowy do gry • ${String(loaderLabel).toLowerCase()} ${verText} • ${ramGb} GB RAM`;
  }
  if (subNick) {
    subNick.textContent = currentAccount?.username || 'Gość';
  }
  if (subProf) {
    subProf.textContent = profName;
  }
  if (pickerKicker) {
    pickerKicker.textContent = `${String(loaderLabel).toUpperCase()} ${verText}`;
  }
  if (pickerName) {
    pickerName.textContent = profName;
  }

  const allMods = Array.isArray(installedMods) ? installedMods : [];
  const enabledCount = activeProf?.loader === 'vanilla'
    ? 0
    : (allMods.length > 0 ? allMods.filter(m => m.enabled).length : (activeProf?.modsEnabled ?? 0));
  if (modsMain) {
    modsMain.textContent = activeProf?.loader === 'vanilla' ? 'Tryb Vanilla' : `${enabledCount} włączonych`;
  }

  renderS3ProfileDropdown();
}

function renderS3ProfileDropdown() {
  const menu = document.getElementById('s3-profile-dropdown');
  if (!menu) return;
  menu.innerHTML = '';

  const list = profilesState?.profiles || [];
  list.forEach(prof => {
    const isSelected = prof.id === profilesState.activeProfileId;
    const loaderLabel = LOADER_LABELS[prof.loader] || 'Fabric';
    const verLabel = prof.loader === 'custom' && prof.customVersionId ? prof.customVersionId : prof.mcVersion;

    const item = document.createElement('div');
    item.className = `version-menu-item ${isSelected ? 'active' : ''}`;
    item.innerHTML = `
      <div style="display:flex;flex-direction:column;min-width:0;">
        <span style="font-size:12px;font-weight:700;color:#FAFAFA;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
        <span class="tnum" style="font-size:10.5px;color:#94A3B8;"></span>
      </div>
      <span class="loader-pill ${prof.loader}">${loaderLabel}</span>
    `;
    item.querySelector('span').textContent = prof.name;
    item.querySelectorAll('span')[1].textContent = `${verLabel}${prof.loader !== 'vanilla' ? ` • ${prof.modsEnabled || 0} modów` : ''}`;
    item.addEventListener('click', () => {
      menu.classList.remove('open');
      activateProfileById(prof.id);
    });
    menu.appendChild(item);
  });
}

function formatPolishPeopleCount(n) {
  if (n === 1) return '1 osoba';
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} osoby`;
  return `${n} osób`;
}

function syncS3FriendsStrip(friends) {
  const headsEl = document.getElementById('s3-friends-heads');
  const mainEl = document.getElementById('s3-friends-main');
  const list = Array.isArray(friends) ? friends : [];

  if (mainEl) {
    mainEl.textContent = formatPolishPeopleCount(list.length);
  }
  if (headsEl) {
    headsEl.innerHTML = '';
    list.slice(0, 3).forEach(f => {
      const nick = typeof f === 'string' ? f : (f?.username || f?.name || 'Steve');
      const img = document.createElement('img');
      img.alt = nick;
      img.title = nick;
      attachPlayerHeadImg(img, nick, 32);
      headsEl.appendChild(img);
    });
  }
}

function syncS2ProfileWidget() {
  const avatarImg = document.getElementById('s2-avatar-img');
  const nickEl = document.getElementById('s2-player-nick');
  const badgeEl = document.getElementById('s2-account-badge');
  const engineEl = document.getElementById('s2-stat-engine');

  if (currentAccount) {
    if (nickEl) nickEl.textContent = currentAccount.username || 'Gracz';
    if (badgeEl) {
      if (isOwnerAccount(currentAccount)) {
        badgeEl.textContent = '👑 WŁAŚCICIEL';
        badgeEl.style.color = '#F59E0B';
      } else {
        badgeEl.textContent = currentAccount.isPremium ? 'PREMIUM' : 'OFFLINE';
        badgeEl.style.color = currentAccount.isPremium ? '#34D399' : '#38BDF8';
      }
    }
    if (avatarImg) {
      if (currentAvatarHeadDataUrl) {
        avatarImg.onerror = null;
        avatarImg.src = currentAvatarHeadDataUrl;
      } else {
        attachPlayerHeadImg(avatarImg, currentAccount.username, 64);
      }
    }
  } else {
    if (nickEl) nickEl.textContent = 'Zaloguj się';
    if (badgeEl) {
      badgeEl.textContent = 'GOŚĆ';
      badgeEl.style.color = '#FBBF24';
    }
    if (avatarImg) {
      avatarImg.onerror = null;
      avatarImg.src = defaultHeadDataUrl;
    }
  }

  const activeProf = typeof getActiveProfileObj === 'function' ? getActiveProfileObj() : null;
  if (engineEl && activeProf) {
    const loaderName = (LOADER_LABELS[activeProf.loader] || activeProf.loader || 'FABRIC').toUpperCase();
    engineEl.textContent = loaderName;
  }

  syncS3HeroWidget();
}

function syncS2StatsWidget(statsData) {
  if (!statsData) return;
  const rankEl = document.getElementById('s2-player-rank');
  const timeEl = document.getElementById('s2-stat-playtime');
  const launchesEl = document.getElementById('s2-stat-launches');
  const s3TimeEl = document.getElementById('s3-time-sub');
  const formatted = formatPlaytime(statsData.totalPlaytimeMinutes);

  if (rankEl) {
    if (isOwnerAccount(currentAccount)) {
      rankEl.innerHTML = '<span style="color: #F59E0B; font-weight: 700;">👑 Właściciel</span>';
    } else {
      rankEl.textContent = String(statsData.rankTitle || 'Gracz').trim() || 'Gracz';
    }
  }
  if (timeEl) {
    timeEl.textContent = formatted;
  }
  if (launchesEl) {
    launchesEl.textContent = String(statsData.totalLaunches || 0);
  }
  if (s3TimeEl) {
    s3TimeEl.textContent = `W grze: ${formatted}`;
  }
}

function renderS2ModpacksWidget() {
  const listEl = document.getElementById('s2-modpacks-list');
  const countEl = document.getElementById('s2-profiles-count');
  if (!listEl) return;

  const profiles = profilesState?.profiles || [];
  if (countEl) countEl.textContent = String(profiles.length);

  listEl.innerHTML = '';
  if (profiles.length === 0) {
    listEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);padding:10px 4px;text-align:center;">Brak profili.</div>`;
    return;
  }

  profiles.forEach(prof => {
    const isSelected = prof.id === profilesState.activeProfileId;
    const isModpack = /modpack/i.test(prof.name || '');
    const cleanName = String(prof.name || 'Profil').replace(/^\[Modpack\]\s*/i, '');
    const verLabel = prof.loader === 'custom' && prof.customVersionId ? prof.customVersionId : prof.mcVersion;
    const modsTxt = prof.loader === 'vanilla' ? 'Vanilla' : `${prof.modsEnabled || 0} modów`;
    const tagLabel = isSelected ? 'WYBRANY' : (isModpack ? 'PACZKA' : (LOADER_LABELS[prof.loader] || 'FABRIC'));

    const row = document.createElement('div');
    row.className = `s2-pack-item ${isSelected ? 'active' : ''}`;
    row.innerHTML = `
      <div class="s2-pack-info">
        <span class="s2-pack-name"></span>
        <span class="s2-pack-sub tnum"></span>
      </div>
      <span class="s2-pack-tag ${isModpack && !isSelected ? 'modpack' : ''}"></span>
    `;
    row.querySelector('.s2-pack-name').textContent = cleanName;
    row.querySelector('.s2-pack-sub').textContent = `${verLabel} • ${modsTxt}`;
    row.querySelector('.s2-pack-tag').textContent = tagLabel;

    row.addEventListener('click', () => {
      if (!isSelected) activateProfileById(prof.id);
    });
    listEl.appendChild(row);
  });

  syncS3HeroWidget();
}

function renderS2QuickModsWidget(mods) {
  syncS3HeroWidget();
  const listEl = document.getElementById('s2-quick-mods-list');
  const countEl = document.getElementById('s2-mods-count-pill');
  if (!listEl) return;

  const all = Array.isArray(mods) ? mods : [];
  const activeCount = all.filter(m => m.enabled).length;
  if (countEl) countEl.textContent = `${activeCount}/${all.length}`;

  listEl.innerHTML = '';
  const activeProf = typeof getActiveProfileObj === 'function' ? getActiveProfileObj() : null;
  if (activeProf && activeProf.loader === 'vanilla') {
    listEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);padding:12px 6px;text-align:center;">Profil Vanilla — wybierz profil Fabric po lewej, żeby używać modów.</div>`;
    return;
  }

  const q = s2QuickModFilterText.trim().toLowerCase();
  const filtered = q
    ? all.filter(m =>
        (m.displayName || m.name || '').toLowerCase().includes(q) ||
        (m.filename || '').toLowerCase().includes(q)
      )
    : all;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);padding:12px 6px;text-align:center;">${all.length === 0 ? 'Pusto — pobierz mody przyciskiem Modrinth.' : 'Nic nie znaleziono.'}</div>`;
    return;
  }

  filtered.forEach(mod => {
    const row = document.createElement('div');
    row.className = `s2-mod-mini-row ${mod.enabled ? '' : 'off'}`;
    const displayName = mod.displayName || mod.name || mod.filename;

    row.innerHTML = `
      <div class="s2-mod-mini-left">
        <span class="s2-mod-mini-dot"></span>
        <span class="s2-mod-mini-name"></span>
      </div>
      <input type="checkbox" class="ui-switch s2-mod-mini-switch" ${mod.enabled ? 'checked' : ''} title="Włącz / wyłącz mod">
    `;
    const nameSpan = row.querySelector('.s2-mod-mini-name');
    nameSpan.textContent = displayName;
    nameSpan.title = `${displayName} (${mod.filename})`;

    const toggle = row.querySelector('.s2-mod-mini-switch');
    toggle.addEventListener('change', async () => {
      try {
        await window.api.toggleMod(mod.filename);
        await loadMods();
        await loadProfiles();
      } catch (err) {
        showToast(`Błąd przełączania moda: ${err.message}`);
      }
    });

    listEl.appendChild(row);
  });
}

function setupLauncherStylesListeners() {
  document.querySelectorAll('.launcher-style-card').forEach(card => {
    card.addEventListener('click', () => {
      const style = card.dataset.launcherStyle;
      if (style) switchLauncherStyleWithRestart(style);
    });
  });

  const openAccAction = () => {
    if (!currentAccount) openLoginModal();
    else openProfileModal();
  };
  document.getElementById('s2-avatar-box')?.addEventListener('click', openAccAction);
  document.getElementById('s2-btn-account')?.addEventListener('click', openAccAction);
  document.getElementById('s2-btn-wardrobe')?.addEventListener('click', () => {
    document.getElementById('btn-open-wardrobe')?.click();
  });

  document.getElementById('s2-btn-import-mrpack')?.addEventListener('click', () => handleImportMrpack(null));
  document.getElementById('s2-btn-browse-modpacks')?.addEventListener('click', jumpToModrinthModpacks);
  document.getElementById('s2-btn-open-modrinth')?.addEventListener('click', () => {
    switchToTab('mods');
    if (typeof window.switchModsSubtab === 'function') window.switchModsSubtab('modrinth');
  });
  document.getElementById('s2-btn-all-mods')?.addEventListener('click', () => {
    switchToTab('mods');
    if (typeof window.switchModsSubtab === 'function') window.switchModsSubtab('installed');
  });

  document.getElementById('s2-quick-mod-filter')?.addEventListener('input', (e) => {
    s2QuickModFilterText = e.target.value || '';
    renderS2QuickModsWidget(installedMods);
  });

  document.getElementById('s2-extra-fps')?.addEventListener('click', () => switchToTab('benchmark'));
  document.getElementById('s2-extra-packs')?.addEventListener('click', () => switchToTab('packs'));
  document.getElementById('s2-extra-cosmetics')?.addEventListener('click', () => {
    document.getElementById('btn-open-wardrobe')?.click();
  });
  document.getElementById('s2-extra-screens')?.addEventListener('click', () => switchToTab('screenshots'));
  document.getElementById('s2-extra-music')?.addEventListener('click', () => switchToTab('music'));
  document.getElementById('s2-extra-doctor')?.addEventListener('click', () => {
    document.getElementById('btn-open-crash-doctor')?.click();
  });

  // Styl 3 Editorial interactions
  document.getElementById('s3-btn-play')?.addEventListener('click', () => {
    elements.btnPlayGame?.click();
  });

  const s3ProfBtn = document.getElementById('s3-profile-btn');
  const s3ProfMenu = document.getElementById('s3-profile-dropdown');
  s3ProfBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    s3ProfMenu?.classList.toggle('open');
  });
  document.addEventListener('click', (e) => {
    if (s3ProfMenu && s3ProfBtn && !s3ProfMenu.contains(e.target) && !s3ProfBtn.contains(e.target)) {
      s3ProfMenu.classList.remove('open');
    }
  });

  document.getElementById('s3-strip-smp')?.addEventListener('click', () => {
    document.getElementById('btn-copy-server-ip')?.click();
  });
  document.getElementById('s3-strip-mods')?.addEventListener('click', () => {
    switchToTab('mods');
  });
  document.getElementById('s3-strip-wardrobe')?.addEventListener('click', () => {
    document.getElementById('btn-open-wardrobe')?.click();
  });
  document.getElementById('s3-strip-friends')?.addEventListener('click', () => {
    document.getElementById('btn-add-friend')?.click();
  });
}

// ==========================================================================
// ==========================================================================
let spotifyUser = null;
let spotifyPlaylists = [];
let currentSpotifyPlaylistId = null;

const SVG_ICON_PLAY_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const SVG_ICON_PAUSE_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const SVG_ICON_PLAY_LG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
const SVG_ICON_PAUSE_LG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

function openMusicModal() {
  switchToTab('music');
  checkSpotifyStatus();
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
    await loadSpotifyPlaylists();
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
  const clientIdInput = document.getElementById('spotify-client-id-input');
  const keyBadge = document.getElementById('spotify-api-key-badge');

  if (clientIdInput && status?.clientId && !clientIdInput.value) {
    clientIdInput.value = status.clientId;
  }
  if (keyBadge) {
    keyBadge.textContent = status?.usingCustomClientId ? 'Własne API ✓' : 'Klucz API';
    keyBadge.style.color = status?.usingCustomClientId ? 'var(--emerald)' : '';
  }

  if (status && status.isLoggedIn) {
    spotifyUser = status.user || { displayName: 'Konto Spotify' };
    if (cardDisconnected) cardDisconnected.style.display = 'none';
    if (cardConnected) cardConnected.style.display = 'flex';
    if (avatarEl) avatarEl.src = status.user?.avatar || 'assets/icon-256.png';
    if (nameEl) nameEl.textContent = status.user?.displayName || 'Konto Spotify';
    if (planEl) {
      planEl.textContent = status.user?.product
        ? (status.user.product === 'premium' ? 'Premium' : 'Free')
        : 'Połączono';
    }
  } else {
    spotifyUser = null;
    if (cardDisconnected) cardDisconnected.style.display = 'flex';
    if (cardConnected) cardConnected.style.display = 'none';
  }
}

function formatPolishPlaylistCount(n) {
  if (n === 1) return '1 playlista';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} playlisty`;
  return `${n} playlist`;
}

const FEATURED_SPOTIFY_PLAYLISTS = [
  { id: '37i9dQZF1DXcBWIGoYBM5M', name: "Today's Top Hits", tracksCount: 50, image: 'https://i.scdn.co/image/ab67706f00000002b8d5a1f2674e7dfc757a3e74' },
  { id: '37i9dQZF1DX0k8z58Zk88K', name: 'Top Utwory Polska', tracksCount: 50, image: 'https://i.scdn.co/image/ab67706f00000002e7d71cd3fca000b21eec4d57' },
  { id: '37i9dQZF1DWY4lFlSbtbk1', name: 'Polski Hip-Hop & Rap', tracksCount: 50, image: 'https://i.scdn.co/image/ab67706f0000000213d29a5975eb1f87aa61a6b4' },
  { id: '37i9dQZF1DX4t95PZ0T4U0', name: 'Gaming & Viral Hits', tracksCount: 50, image: 'https://i.scdn.co/image/ab67706f00000002444b005118ce5288515ad47a' }
];

function renderFeaturedSpotifyPlaylists() {
  const featGrid = document.getElementById('spotify-featured-playlists-grid');
  if (!featGrid || featGrid.children.length > 0) return;
  featGrid.innerHTML = '';
  FEATURED_SPOTIFY_PLAYLISTS.forEach(pl => {
    const card = document.createElement('div');
    card.className = `spotify-playlist-card ${currentSpotifyPlaylistId === pl.id ? 'active' : ''}`;
    card.innerHTML = `
      <img src="${pl.image}" class="spotify-playlist-img" alt="${pl.name}" onerror="this.src='assets/icon-256.png'">
      <div class="spotify-playlist-details" style="flex: 1;">
        <span class="spotify-playlist-name" title="${pl.name}">${pl.name}</span>
        <span class="spotify-playlist-count tnum">${pl.tracksCount} utworów • Polecane</span>
      </div>
    `;
    card.addEventListener('click', () => {
      playSpotifyPlaylist(pl, card);
    });
    featGrid.appendChild(card);
  });
}

async function loadSpotifyPlaylists() {
  renderFeaturedSpotifyPlaylists();
  const grid = document.getElementById('spotify-playlists-grid');
  const countLabel = document.getElementById('spotify-playlists-count-label');
  const titleLabel = document.getElementById('spotify-playlists-title-label');
  if (!grid) return;

  grid.innerHTML = '<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 12px; grid-column: 1 / -1;">Synchronizowanie playlist z konta Spotify...</div>';

  let bundle = { playlists: [], isLoggedIn: !!spotifyUser, rateLimited: false, retryAfter: 0 };
  try {
    const res = await window.api.spotifyGetPlaylists();
    bundle = Array.isArray(res) ? { playlists: res, isLoggedIn: !!spotifyUser } : (res || bundle);
  } catch (err) {
    bundle.error = err.message;
  }

  spotifyPlaylists = Array.isArray(bundle.playlists) ? bundle.playlists : [];
  if (countLabel) {
    countLabel.textContent = formatPolishPlaylistCount(spotifyPlaylists.length);
  }
  if (titleLabel) {
    titleLabel.textContent = bundle.fromCache
      ? 'Twoje Playlisty Spotify (Zapisane)'
      : 'Twoje Playlisty Spotify';
  }

  grid.innerHTML = '';

  if (spotifyPlaylists.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'spotify-empty-box';

    if (bundle.isLoggedIn && bundle.rateLimited) {
      emptyBox.innerHTML = `
        <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">
          Oczekiwanie na limit wspólnego klucza Spotify API (HTTP 429 • auto-ponowienie za <span class="tnum">${bundle.retryAfter || 30}s</span>)
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
          Konto jest połączone, ale domyślny publiczny klucz API jest współdzielony globalnie. Aby <strong>natychmiast i bez limitów</strong> wyświetlić wszystkie swoje prywatne i publiczne playlisty z konta Spotify, ustaw własny darmowy <code>Client ID</code> (30 sekund) — lub wklej wyżej link do swojej playlisty.
        </div>
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px; flex-wrap: wrap;">
          <button type="button" class="btn-primary" id="btn-empty-open-api-setup" style="height: 30px; font-size: 11.5px;">
            Ustaw własny Client ID (bez limitów)
          </button>
          <button type="button" class="btn-secondary" id="btn-empty-retry-playlists" style="height: 30px; font-size: 11.5px;">
            Spróbuj pobrać teraz
          </button>
        </div>
      `;
      grid.appendChild(emptyBox);
      emptyBox.querySelector('#btn-empty-open-api-setup')?.addEventListener('click', () => {
        const setupBox = document.getElementById('spotify-api-setup-box');
        if (setupBox) setupBox.style.display = 'flex';
        document.getElementById('spotify-client-id-input')?.focus();
      });
      emptyBox.querySelector('#btn-empty-retry-playlists')?.addEventListener('click', () => {
        loadSpotifyPlaylists();
      });
    } else if (!bundle.isLoggedIn) {
      emptyBox.innerHTML = `
        <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">
          Połącz swoje konto Spotify
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
          Zaloguj się do Spotify powyżej, aby automatycznie wczytać swoje playlisty i Polubione utwory, albo wklej link do wybranej playlisty.
        </div>
        <button type="button" class="btn-spotify-pill" id="btn-empty-connect-spotify" style="margin-top: 2px;">
          Połącz konto Spotify
        </button>
      `;
      grid.appendChild(emptyBox);
      emptyBox.querySelector('#btn-empty-connect-spotify')?.addEventListener('click', () => {
        document.getElementById('btn-spotify-login')?.click();
      });
    } else {
      emptyBox.innerHTML = `
        <div style="font-size: 12.5px; font-weight: 700; color: var(--text-primary);">
          Brak playlist do wyświetlenia
        </div>
        <div style="font-size: 11.5px; color: var(--text-secondary); line-height: 1.5;">
          ${bundle.error ? `Komunikat Spotify: ${bundle.error}` : 'Nie znaleziono playlist na koncie. Utwórz playlistę w Spotify lub wklej link powyżej.'}
        </div>
      `;
      grid.appendChild(emptyBox);
    }
    return;
  }

  spotifyPlaylists.forEach(pl => {
    const card = document.createElement('div');
    card.className = `spotify-playlist-card ${currentSpotifyPlaylistId === pl.id ? 'active' : ''}`;

    const thumbHtml = pl.isLikedSongs
      ? `<div class="spotify-liked-thumb" aria-hidden="true">
           <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
         </div>`
      : `<img src="${pl.image || 'assets/icon-256.png'}" class="spotify-playlist-img" alt="" onerror="this.src='assets/icon-256.png'">`;

    const subtitle = pl.owner
      ? `${pl.tracksCount ?? 0} utworów • ${pl.owner}`
      : `${pl.tracksCount ?? 0} utworów`;

    const removeBtnHtml = pl.isManual
      ? `<button type="button" class="spotify-playlist-remove" title="Usuń z zapisanych playlist">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
         </button>`
      : '';

    card.innerHTML = `
      ${thumbHtml}
      <div class="spotify-playlist-details" style="flex: 1;">
        <span class="spotify-playlist-name" title="${pl.name}">${pl.name}</span>
        <span class="spotify-playlist-count tnum">${subtitle}</span>
      </div>
      ${removeBtnHtml}
    `;

    const removeBtn = card.querySelector('.spotify-playlist-remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await window.api.spotifyRemovePlaylist?.(pl.id);
        showToast(`Usunięto playlistę: ${pl.name}`);
        loadSpotifyPlaylists();
      });
    }

    card.addEventListener('click', () => {
      playSpotifyPlaylist(pl, card);
    });

    grid.appendChild(card);
  });
}

async function syncMprisStatus() {
  if (window.musicPlayer?.isStandalone?.()) return;
  if (!window.api?.spotifyGetMprisStatus) return;
  try {
    const data = await window.api.spotifyGetMprisStatus();

    const titleEl = document.getElementById('spotify-now-playing-title');
    const artistEl = document.getElementById('spotify-now-playing-artist');
    const artEl = document.getElementById('spotify-now-playing-art');
    const footerArt = document.getElementById('footer-cover-art');
    const playBtn = document.getElementById('btn-spotify-modal-play');
    const badgeText = document.getElementById('spotify-playback-badge-text');

    const footerTitle = document.getElementById('music-title');
    const footerGenre = document.getElementById('music-genre');
    const footerToggle = document.getElementById('btn-music-toggle');
    const visualizer = document.getElementById('music-visualizer');

    if (data && data.running && data.title) {
      if (titleEl) titleEl.textContent = data.title;
      if (artistEl) artistEl.textContent = data.artist || (data.album ? `Album: ${data.album}` : 'Spotify Desktop');
      if (data.artUrl) {
        if (artEl) artEl.src = data.artUrl;
        if (footerArt) footerArt.src = data.artUrl;
      }
      const isPlaying = (data.status === 'Playing');
      if (playBtn) playBtn.innerHTML = isPlaying ? SVG_ICON_PAUSE_LG : SVG_ICON_PLAY_LG;
      if (badgeText) badgeText.textContent = isPlaying ? 'Spotify Desktop • Aktywne' : 'Spotify Desktop • Wstrzymano';

      window.musicPlayer?.fetchLyricsForTrack?.(data.title, data.artist || '');

      if (window.musicPlayer && !window.musicPlayer.isRadioPlaying?.()) {
        if (footerTitle) footerTitle.textContent = data.title;
        if (footerGenre) footerGenre.textContent = `Spotify • ${data.artist || 'Desktop'}`;
        if (footerToggle) {
          footerToggle.innerHTML = isPlaying ? SVG_ICON_PAUSE_SM : SVG_ICON_PLAY_SM;
          footerToggle.title = isPlaying ? 'Pauza' : 'Odtwarzaj';
        }
        if (visualizer) visualizer.classList.toggle('animating', isPlaying);
      }
    }
  } catch (_) {}
}
window.syncMprisStatus = syncMprisStatus;

async function playSpotifyPlaylist(playlist, cardEl = null) {
  currentSpotifyPlaylistId = playlist.id;
  document.querySelectorAll('.spotify-playlist-card').forEach(c => c.classList.remove('active'));
  if (cardEl) cardEl.classList.add('active');

  showToast(`Ładowanie playlisty: ${playlist.name}...`);
  try {
    let loaded = false;

    if (!playlist.isLikedSongs && playlist.id !== 'liked-songs') {
      try {
        const playlistInfo = await window.api.spotifyGetPlaylistInfo(playlist.id);
        if (playlistInfo && Array.isArray(playlistInfo.tracks) && playlistInfo.tracks.length > 0) {
          window.musicPlayer.loadSpotifyPlaylist(playlistInfo);
          showToast(`Odtwarzanie: ${playlistInfo.name} (${playlistInfo.tracks.length} utworów)`);
          loaded = true;
        }
      } catch (_) {}
    }

    if (!loaded) {
      const tracks = await window.api.spotifyGetTracks(playlist.id);
      if (tracks && tracks.length > 0) {
        window.musicPlayer.loadSpotifyPlaylist({
          id: playlist.id,
          name: playlist.name,
          coverUrl: playlist.image,
          tracks: tracks.map(t => ({
            title: t.name,
            artist: t.artists,
            durationMs: t.durationMs,
            coverUrl: t.albumArt || playlist.image || null
          }))
        });
        showToast(`Odtwarzanie: ${playlist.name} (${tracks.length} utworów)`);
        loaded = true;
      }
    }

    if (!loaded) {
      throw new Error('Playlista jest pusta lub niedostępna.');
    }
  } catch (err) {
    showToast(`Błąd odtwarzania playlisty: ${err.message}`);
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

  const btnToggleApi = document.getElementById('btn-toggle-spotify-api');
  const apiSetupBox = document.getElementById('spotify-api-setup-box');
  const btnOpenSpotifyDev = document.getElementById('btn-open-spotify-dev');
  const btnCopyRedirect = document.getElementById('btn-copy-spotify-redirect');
  const clientIdInput = document.getElementById('spotify-client-id-input');
  const btnSaveClientId = document.getElementById('btn-spotify-save-client-id');

  const btnModalPlay = document.getElementById('btn-spotify-modal-play');
  const btnModalNext = document.getElementById('btn-spotify-modal-next');
  const btnModalPrev = document.getElementById('btn-spotify-modal-prev');

  btnToggleApi?.addEventListener('click', () => {
    if (!apiSetupBox) return;
    const isHidden = apiSetupBox.style.display === 'none' || !apiSetupBox.style.display;
    apiSetupBox.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) clientIdInput?.focus();
  });

  btnOpenSpotifyDev?.addEventListener('click', () => {
    window.api.openExternal('https://developer.spotify.com/dashboard');
  });

  btnCopyRedirect?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('http://127.0.0.1:8989/login');
      showToast('Skopiowano Redirect URI: http://127.0.0.1:8989/login');
    } catch (_) {
      showToast('Redirect URI: http://127.0.0.1:8989/login');
    }
  });

  btnSaveClientId?.addEventListener('click', async () => {
    const raw = (clientIdInput?.value || '').trim();
    if (!raw || raw.length < 16 || raw.includes('http')) {
      showToast('Wklej prawidłowy 32-znakowy Spotify Client ID z panelu Spotify Dev');
      return;
    }
    try {
      await window.api.spotifySetClientId?.(raw);
      showToast('Zapisano własny Client ID — otwieranie logowania Spotify...');
      const auth = await window.api.spotifyLogin(raw);
      if (auth && auth.accessToken) {
        if (apiSetupBox) apiSetupBox.style.display = 'none';
        showToast('Połączono konto Spotify na własnym kluczu API!');
        await checkSpotifyStatus();
      }
    } catch (err) {
      showToast(`Błąd autoryzacji Spotify: ${err.message}`);
    }
  });

  window.api.onSpotifyPlaylistsUpdated?.(() => {
    checkSpotifyStatus();
  });

  const subLyrics = document.getElementById('music-subtab-lyrics');
  const subLibrary = document.getElementById('music-subtab-library');
  const panelLyrics = document.getElementById('music-panel-lyrics');
  const panelLibrary = document.getElementById('music-panel-library');

  const activateMusicPanel = (which) => {
    const isLyrics = which === 'lyrics';
    subLyrics?.classList.toggle('active', isLyrics);
    subLibrary?.classList.toggle('active', !isLyrics);
    if (panelLyrics) panelLyrics.style.display = isLyrics ? 'flex' : 'none';
    if (panelLibrary) panelLibrary.style.display = isLyrics ? 'none' : 'flex';
  };

  subLyrics?.addEventListener('click', () => activateMusicPanel('lyrics'));
  subLibrary?.addEventListener('click', () => activateMusicPanel('library'));

  const trackSearchInput = document.getElementById('music-track-search-input');
  const btnTrackSearch = document.getElementById('btn-music-track-search');
  const trackResultsBox = document.getElementById('music-track-search-results');

  const runTrackSearch = async () => {
    const q = trackSearchInput?.value?.trim();
    if (!q || !trackResultsBox) return;
    trackResultsBox.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">Wyszukiwanie utworów...</div>';
    try {
      const tracks = await window.api.spotifySearchTracks(q);
      trackResultsBox.innerHTML = '';
      if (!tracks || tracks.length === 0) {
        trackResultsBox.innerHTML = '<div style="font-size: 11.5px; color: var(--text-muted); padding: 8px;">Brak wyników wyszukiwania.</div>';
        return;
      }
      tracks.slice(0, 8).forEach(t => {
        const row = document.createElement('div');
        row.className = 'track-result-row';
        const title = t.title || t.name || 'Utwór';
        const artist = t.artist || t.artists || '';
        const cover = t.coverUrl || t.thumbnail || t.image || 'assets/icon-256.png';
        row.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; min-width: 0;">
            <img src="${cover}" alt="" style="width: 32px; height: 32px; border-radius: 6px; object-fit: cover; flex-shrink: 0;" onerror="this.src='assets/icon-256.png'">
            <div style="min-width: 0;">
              <div style="font-size: 12px; font-weight: 600; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${title}</div>
              <div style="font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${artist}</div>
            </div>
          </div>
          <span class="mod-tag">Odtwórz</span>
        `;
        row.addEventListener('click', () => {
          window.musicPlayer?.playSingleTrack?.({ title, artist, coverUrl: cover });
          activateMusicPanel('lyrics');
          showToast(`Odtwarzanie: ${title}`);
        });
        trackResultsBox.appendChild(row);
      });
    } catch (err) {
      trackResultsBox.innerHTML = `<div style="font-size: 11.5px; color: #F87171; padding: 8px;">Błąd wyszukiwania: ${err.message}</div>`;
    }
  };

  btnTrackSearch?.addEventListener('click', runTrackSearch);
  trackSearchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runTrackSearch();
  });

  btnOpenHub?.addEventListener('click', (e) => {
    e.stopPropagation();
    switchToTab('music');
    activateMusicPanel('library');
    syncMprisStatus();
  });

  musicInfoClick?.addEventListener('click', () => {
    switchToTab('music');
    activateMusicPanel('lyrics');
    syncMprisStatus();
  });

  btnCloseModal?.addEventListener('click', closeMusicModal);
  musicModal?.addEventListener('click', (e) => {
    if (e.target === musicModal) closeMusicModal();
  });

  btnModalPlay?.addEventListener('click', () => {
    window.musicPlayer?.toggle();
  });

  btnModalNext?.addEventListener('click', () => {
    window.musicPlayer?.next();
  });

  btnModalPrev?.addEventListener('click', () => {
    window.musicPlayer?.prev();
  });

  btnLogin?.addEventListener('click', async () => {
    try {
      showToast('Otwieranie autoryzacji Spotify...');
      const auth = await window.api.spotifyLogin();
      if (auth && auth.accessToken) {
        showToast('Połączono z kontem Spotify');
        await checkSpotifyStatus();
      }
    } catch (err) {
      showToast(`Błąd logowania Spotify: ${err.message}`);
    }
  });

  btnLogout?.addEventListener('click', async () => {
    await window.api.spotifyLogout();
    currentSpotifyPlaylistId = null;
    showToast('Odłączono konto Spotify');
    checkSpotifyStatus();
  });

  const btnQuickAdd = document.getElementById('btn-quick-add-playlist-link');
  btnQuickAdd?.addEventListener('click', () => {
    if (urlInput) {
      urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      urlInput.focus();
      urlInput.style.borderColor = 'var(--emerald)';
      setTimeout(() => { urlInput.style.borderColor = ''; }, 1500);
      showToast('Wklej poniżej link do playlisty Spotify i kliknij Dodaj i Graj');
    }
  });

  btnRefresh?.addEventListener('click', async () => {
    btnRefresh.classList.add('rotating');
    showToast('Synchronizowanie playlist ze Spotify...');
    try {
      await loadSpotifyPlaylists();
      if (spotifyPlaylists.length > 0) {
        showToast(`Zsynchronizowano ${spotifyPlaylists.length} playlist z konta Spotify`);
      } else if (spotifyUser) {
        showToast('Spotify wymaga własnego Client ID (429) lub wklejenia linku do playlisty');
        const setupBox = document.getElementById('spotify-api-setup-box');
        if (setupBox) setupBox.style.display = 'flex';
      }
    } catch (err) {
      showToast(`Błąd synchronizacji: ${err.message}`);
    } finally {
      setTimeout(() => btnRefresh.classList.remove('rotating'), 650);
    }
  });

  btnLoadUrl?.addEventListener('click', async () => {
    const url = urlInput?.value?.trim();
    if (!url) {
      showToast('Wklej link do playlisty Spotify');
      return;
    }

    showToast('Pobieranie i zapisywanie playlisty Spotify...');
    try {
      const playlistInfo = await window.api.spotifyGetPlaylistInfo(url);
      if (!playlistInfo || !playlistInfo.tracks || !playlistInfo.tracks.length) {
        throw new Error('Nie znaleziono utworów w podanej playliście.');
      }
      if (urlInput) urlInput.value = '';
      currentSpotifyPlaylistId = playlistInfo.id;
      await loadSpotifyPlaylists();
      window.musicPlayer.loadSpotifyPlaylist(playlistInfo);
      showToast(`Zapisano i włączono: ${playlistInfo.name} (${playlistInfo.tracks.length} utworów)`);
    } catch (err) {
      showToast(`Błąd playlisty: ${err.message}`);
    }
  });

  urlInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnLoadUrl?.click();
  });

  document.getElementById('btn-station-lofi')?.addEventListener('click', () => {
    window.musicPlayer.playStation('lofi');
    showToast('Stacja aktywna: Lofi Chill Beats');
  });

  document.getElementById('btn-station-synthwave')?.addEventListener('click', () => {
    window.musicPlayer.playStation('synthwave');
    showToast('Stacja aktywna: Synthwave & Cyberpunk');
  });

  document.getElementById('btn-station-ambient')?.addEventListener('click', () => {
    window.musicPlayer.playStation('ambient');
    showToast('Stacja aktywna: Minecraft Ambient OST');
  });

  syncMprisStatus();
  setInterval(syncMprisStatus, 2500);
}

// ============================================================================
// ============================================================================

const screenshotsState = {
  list: [],
  filtered: [],
  activeFilter: 'active',
  searchQuery: '',
  sortOrder: 'newest',
  lightboxIndex: -1
};

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function updateScreenshotsProfileDropdown() {
  const select = document.getElementById('select-screenshots-profile');
  if (!select) return;

  const currentVal = select.value || screenshotsState.activeFilter || 'active';
  const activeProfile = getActiveProfileObj();
  const activeName = activeProfile ? activeProfile.name : 'Główny';

  let html = `
    <option value="active">Aktywny profil (${escapeHtml(activeName)})</option>
    <option value="all">Wszystkie profile i foldery</option>
  `;

  if (profilesState?.profiles && Array.isArray(profilesState.profiles)) {
    for (const p of profilesState.profiles) {
      html += `<option value="${escapeHtml(p.id)}">Profil: ${escapeHtml(p.name)}</option>`;
    }
  }

  select.innerHTML = html;
  if ([...select.options].some(o => o.value === currentVal)) {
    select.value = currentVal;
  }
}

async function loadScreenshots() {
  if (!window.api?.getScreenshots) return;
  const select = document.getElementById('select-screenshots-profile');
  const filter = select?.value || screenshotsState.activeFilter || 'active';
  screenshotsState.activeFilter = filter;

  const refreshBtn = document.getElementById('btn-screenshots-refresh');
  refreshBtn?.classList.add('rotating');

  try {
    const res = await window.api.getScreenshots(filter);
    if (res?.success) {
      screenshotsState.list = res.screenshots || [];

      const badge = document.getElementById('sidebar-screenshots-badge');
      if (badge) {
        if (res.screenshots.length > 0) {
          badge.textContent = res.screenshots.length > 99 ? '99+' : res.screenshots.length;
          badge.style.display = 'inline-flex';
        } else {
          badge.style.display = 'none';
        }
      }

      applyScreenshotsFilterAndSort();
    }
  } catch (err) {
    console.error('[Screenshots] Błąd pobierania listy zrzutów:', err);
  } finally {
    refreshBtn?.classList.remove('rotating');
  }
}

function applyScreenshotsFilterAndSort() {
  const searchInput = document.getElementById('input-screenshots-search');
  const sortSelect = document.getElementById('select-screenshots-sort');

  screenshotsState.searchQuery = searchInput?.value?.toLowerCase()?.trim() || '';
  screenshotsState.sortOrder = sortSelect?.value || 'newest';

  let list = [...screenshotsState.list];

  if (screenshotsState.searchQuery) {
    const q = screenshotsState.searchQuery;
    list = list.filter(item =>
      item.fileName.toLowerCase().includes(q) ||
      item.dateFormatted.toLowerCase().includes(q) ||
      (item.profileName && item.profileName.toLowerCase().includes(q))
    );
  }

  if (screenshotsState.sortOrder === 'newest') {
    list.sort((a, b) => b.timestamp - a.timestamp);
  } else if (screenshotsState.sortOrder === 'oldest') {
    list.sort((a, b) => a.timestamp - b.timestamp);
  } else if (screenshotsState.sortOrder === 'size') {
    list.sort((a, b) => b.sizeBytes - a.sizeBytes);
  }

  screenshotsState.filtered = list;
  renderScreenshotsUI();
}

function renderScreenshotsUI() {
  const grid = document.getElementById('screenshots-grid');
  const emptyState = document.getElementById('screenshots-empty');
  const countLabel = document.getElementById('screenshots-count-label');
  const sizeLabel = document.getElementById('screenshots-size-label');

  const totalBytes = screenshotsState.filtered.reduce((sum, item) => sum + item.sizeBytes, 0);
  const totalMb = (totalBytes / (1024 * 1024)).toFixed(1);

  if (countLabel) {
    const count = screenshotsState.filtered.length;
    let unit = 'zrzutów';
    if (count === 1) unit = 'zrzut';
    else if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) unit = 'zrzuty';
    countLabel.textContent = `${count} ${unit}`;
  }
  if (sizeLabel) {
    sizeLabel.textContent = `${totalMb} MB`;
  }

  if (!grid || !emptyState) return;

  if (screenshotsState.filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    emptyState.style.display = 'flex';
    return;
  }

  grid.style.display = 'grid';
  emptyState.style.display = 'none';

  grid.innerHTML = screenshotsState.filtered.map((item, index) => {
    return `
      <div class="screenshot-card" data-index="${index}" title="${escapeHtml(item.fileName)}">
        <div class="screenshot-thumb-wrap">
          ${item.isVideo ? `<div class="screenshot-video-badge"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> KLIP WIDEO</div>` : ''}
          <img class="screenshot-thumb" data-path="${escapeHtml(item.filePath)}" src="assets/icon-256.png" loading="lazy" alt="Miniaturka zrzutu" />
          <div class="screenshot-card-overlay">
            <button class="btn-card-action btn-copy-card" data-path="${escapeHtml(item.filePath)}" title="Kopiuj do schowka (Discord Ctrl+V)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>
            <button class="btn-card-action btn-view-card" data-index="${index}" title="Powiększ (Lightbox)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </button>
            <button class="btn-card-action danger btn-delete-card" data-path="${escapeHtml(item.filePath)}" title="Usuń zrzut">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
        <div class="screenshot-meta">
          <div class="screenshot-meta-header">
            <span class="screenshot-name">${escapeHtml(item.fileName)}</span>
            <span class="screenshot-badge-profile">${escapeHtml(item.profileName || 'Główny')}</span>
          </div>
          <div class="screenshot-meta-footer">
            <span>${item.dateFormatted}</span>
            <span>${item.sizeFormatted}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const thumbImgs = grid.querySelectorAll('.screenshot-thumb');
  thumbImgs.forEach(img => {
    const fPath = img.getAttribute('data-path');
    if (!fPath) return;

    window.api.getScreenshotThumbnail(fPath).then(res => {
      if (res?.success && res.dataUrl) {
        img.src = res.dataUrl;
      }
    }).catch(() => {});
  });

  grid.querySelectorAll('.screenshot-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.btn-card-action')) return;
      const idx = parseInt(card.getAttribute('data-index'), 10);
      if (!isNaN(idx)) openScreenshotLightbox(idx);
    });
  });

  grid.querySelectorAll('.btn-copy-card').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fPath = btn.getAttribute('data-path');
      await copyScreenshotToClipboard(fPath);
    });
  });

  grid.querySelectorAll('.btn-view-card').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.getAttribute('data-index'), 10);
      if (!isNaN(idx)) openScreenshotLightbox(idx);
    });
  });

  grid.querySelectorAll('.btn-delete-card').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const fPath = btn.getAttribute('data-path');
      await confirmAndDeleteScreenshot(fPath);
    });
  });
}

async function copyScreenshotToClipboard(filePath) {
  if (!window.api?.copyScreenshot || !filePath) return;
  try {
    const res = await window.api.copyScreenshot(filePath);
    if (res?.success) {
      showToast('📸 Obraz skopiowany do schowka! Wklej w Discordzie (Ctrl+V).');
      try { window.uiSounds?.playClick?.(); } catch (_) {}
    } else {
      showToast(`Błąd kopiowania: ${res?.error || 'Nieznany błąd'}`);
    }
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
}

async function openScreenshotLightbox(index) {
  if (index < 0 || index >= screenshotsState.filtered.length) return;
  screenshotsState.lightboxIndex = index;
  const item = screenshotsState.filtered[index];

  const modal = document.getElementById('screenshot-lightbox-modal');
  const counter = document.getElementById('lightbox-counter');
  const filename = document.getElementById('lightbox-filename');
  const meta = document.getElementById('lightbox-meta');
  const img = document.getElementById('lightbox-img');
  const video = document.getElementById('lightbox-video');
  const spinner = document.getElementById('lightbox-spinner');

  if (!modal) return;
  modal.classList.add('open');

  if (counter) counter.textContent = `${index + 1} z ${screenshotsState.filtered.length}`;
  if (filename) filename.textContent = item.fileName;
  if (meta) meta.textContent = `${item.sizeFormatted} • ${item.dateFormatted} • ${item.profileName || 'Minecraft'}`;

  if (item.isVideo) {
    if (img) img.style.display = 'none';
    if (spinner) spinner.style.display = 'none';
    if (video) {
      video.style.display = 'block';
      video.src = `file://${item.filePath}`;
      video.play().catch(() => {});
    }
  } else {
    if (video) {
      video.pause();
      video.style.display = 'none';
    }
    if (img) {
      img.style.display = 'none';
      if (spinner) spinner.style.display = 'flex';

      try {
        const full = await window.api.getScreenshotFull(item.filePath);
        if (full?.success && full.dataUrl) {
          img.src = full.dataUrl;
          img.style.display = 'block';
          if (meta && full.width && full.height) {
            meta.textContent = `${full.width}x${full.height} • ${item.sizeFormatted} • ${item.dateFormatted}`;
          }
        } else {
          img.src = `file://${item.filePath}`;
          img.style.display = 'block';
        }
      } catch (_) {
        img.src = `file://${item.filePath}`;
        img.style.display = 'block';
      } finally {
        if (spinner) spinner.style.display = 'none';
      }
    }
  }
}

function closeScreenshotLightbox() {
  const modal = document.getElementById('screenshot-lightbox-modal');
  const video = document.getElementById('lightbox-video');
  if (video) {
    video.pause();
    video.src = '';
  }
  if (modal) modal.classList.remove('open');
  screenshotsState.lightboxIndex = -1;
}

function navigateLightbox(dir) {
  if (screenshotsState.lightboxIndex < 0 || screenshotsState.filtered.length === 0) return;
  let next = screenshotsState.lightboxIndex + dir;
  if (next < 0) next = screenshotsState.filtered.length - 1;
  if (next >= screenshotsState.filtered.length) next = 0;
  openScreenshotLightbox(next);
}

async function copyCurrentLightboxScreenshot() {
  if (screenshotsState.lightboxIndex < 0) return;
  const item = screenshotsState.filtered[screenshotsState.lightboxIndex];
  if (!item) return;

  const copyLabel = document.getElementById('btn-lightbox-copy-label');
  await copyScreenshotToClipboard(item.filePath);
  if (copyLabel) {
    const orig = copyLabel.textContent;
    copyLabel.textContent = 'Skopiowano!';
    setTimeout(() => { copyLabel.textContent = orig; }, 1600);
  }
}

async function openCurrentLightboxFile() {
  if (screenshotsState.lightboxIndex < 0) return;
  const item = screenshotsState.filtered[screenshotsState.lightboxIndex];
  if (!item || !window.api?.openScreenshotFile) return;
  await window.api.openScreenshotFile(item.filePath);
}

async function deleteCurrentLightboxScreenshot() {
  if (screenshotsState.lightboxIndex < 0) return;
  const item = screenshotsState.filtered[screenshotsState.lightboxIndex];
  if (!item) return;

  const ok = confirm(`Czy na pewno chcesz usunąć zrzut ekranu "${item.fileName}"?`);
  if (!ok) return;

  try {
    const res = await window.api.deleteScreenshot(item.filePath);
    if (res?.success) {
      showToast('Zrzut ekranu został usunięty.');
      const oldIndex = screenshotsState.lightboxIndex;
      await loadScreenshots();
      if (screenshotsState.filtered.length > 0) {
        const nextIdx = Math.min(oldIndex, screenshotsState.filtered.length - 1);
        openScreenshotLightbox(nextIdx);
      } else {
        closeScreenshotLightbox();
      }
    } else {
      showToast(`Błąd usuwania: ${res?.error || 'Nieznany błąd'}`);
    }
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
}

async function confirmAndDeleteScreenshot(filePath) {
  const fileName = filePath.split(/[/\\]/).pop();
  const ok = confirm(`Czy na pewno chcesz usunąć zrzut "${fileName}"?`);
  if (!ok) return;

  try {
    const res = await window.api.deleteScreenshot(filePath);
    if (res?.success) {
      showToast('Zrzut ekranu został usunięty.');
      await loadScreenshots();
    } else {
      showToast(`Błąd usuwania: ${res?.error || 'Nieznany błąd'}`);
    }
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
  }
}

function setupScreenshotsListeners() {
  document.getElementById('btn-screenshots-refresh')?.addEventListener('click', () => {
    loadScreenshots();
  });

  const openFolderHandler = () => {
    const profileFilter = document.getElementById('select-screenshots-profile')?.value || 'active';
    window.api?.openScreenshotsFolder(profileFilter);
  };
  document.getElementById('btn-screenshots-open-folder')?.addEventListener('click', openFolderHandler);
  document.getElementById('btn-screenshots-empty-folder')?.addEventListener('click', openFolderHandler);

  document.getElementById('input-screenshots-search')?.addEventListener('input', () => {
    applyScreenshotsFilterAndSort();
  });

  document.getElementById('select-screenshots-profile')?.addEventListener('change', () => {
    loadScreenshots();
  });

  document.getElementById('select-screenshots-sort')?.addEventListener('change', () => {
    applyScreenshotsFilterAndSort();
  });

  document.getElementById('btn-close-lightbox')?.addEventListener('click', closeScreenshotLightbox);
  document.getElementById('btn-lightbox-prev')?.addEventListener('click', () => navigateLightbox(-1));
  document.getElementById('btn-lightbox-next')?.addEventListener('click', () => navigateLightbox(1));
  document.getElementById('btn-lightbox-copy')?.addEventListener('click', copyCurrentLightboxScreenshot);
  document.getElementById('btn-lightbox-open-file')?.addEventListener('click', openCurrentLightboxFile);
  document.getElementById('btn-lightbox-delete')?.addEventListener('click', deleteCurrentLightboxScreenshot);

  const lightboxModal = document.getElementById('screenshot-lightbox-modal');
  lightboxModal?.addEventListener('click', (e) => {
    if (e.target === lightboxModal) {
      closeScreenshotLightbox();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (!lightboxModal || !lightboxModal.classList.contains('open')) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeScreenshotLightbox();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateLightbox(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateLightbox(1);
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const selection = window.getSelection();
      if (!selection || selection.toString().length === 0) {
        e.preventDefault();
        copyCurrentLightboxScreenshot();
      }
    }
  });
}

// ============================================================================
// ============================================================================

let currentCrashDiagnosis = null;

function openCrashDoctorModal(diagnosis) {
  if (!diagnosis) return;
  currentCrashDiagnosis = diagnosis;

  const modal = document.getElementById('crash-doctor-modal');
  const badgeText = document.getElementById('crash-badge-text');
  const badgeWrap = document.getElementById('crash-doctor-badge');
  const title = document.getElementById('crash-modal-title');
  const metaLine = document.getElementById('crash-meta-line');
  const boxTitle = document.getElementById('crash-box-title');
  const boxDesc = document.getElementById('crash-box-desc');
  const culpritPill = document.getElementById('crash-culprit-pill');
  const culpritName = document.getElementById('crash-culprit-name');
  const solutionText = document.getElementById('crash-solution-text');
  const actionsContainer = document.getElementById('crash-actions-container');
  const rawCode = document.getElementById('crash-raw-code');

  if (!modal) return;

  if (badgeText) {
    if (diagnosis.exitCode !== undefined && diagnosis.exitCode !== null) {
      badgeText.textContent = `AWARIA GRY (KOD: ${diagnosis.exitCode})`;
    } else {
      badgeText.textContent = 'WYKRYTO BŁĄD LUB KONFLIKT';
    }
  }

  if (badgeWrap) {
    badgeWrap.className = 'crash-doctor-badge';
    if (diagnosis.severity === 'warning') badgeWrap.classList.add('warning');
    else if (diagnosis.severity === 'info') badgeWrap.classList.add('info');
  }

  if (title) title.textContent = diagnosis.title || 'Raport i Naprawa Błędów';
  if (metaLine) {
    metaLine.textContent = `Raport: ${diagnosis.crashTime || 'Brak daty'} • Plik: ${diagnosis.reportFileName || 'crash-reports'}`;
  }

  if (boxTitle) boxTitle.textContent = diagnosis.title || 'Wykryto problem';
  if (boxDesc) boxDesc.textContent = diagnosis.summary || 'Gra wyłączyła się nieoczekiwanie.';

  if (culpritPill && culpritName) {
    if (diagnosis.culpritFile || diagnosis.culpritMod) {
      culpritPill.style.display = 'inline-flex';
      culpritName.textContent = diagnosis.culpritFile || diagnosis.culpritMod;
    } else {
      culpritPill.style.display = 'none';
    }
  }

  if (solutionText) {
    solutionText.textContent = diagnosis.solution || 'Sprawdź kompatybilność modów z wybraną wersją gry.';
  }

  if (actionsContainer) {
    actionsContainer.innerHTML = '';

    const actions = diagnosis.suggestedActions || [];
    actions.forEach(act => {
      const btn = document.createElement('button');
      btn.className = `btn-${act.type === 'danger' ? 'danger' : act.type === 'primary' ? 'primary' : 'secondary'} btn-sm`;
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.gap = '6px';

      if (act.id === 'disable_mod' || act.id === 'disable_duplicates' || act.id === 'delete_mod') {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span>${escapeHtml(act.label)}</span>`;
      } else if (act.id === 'copy_discord') {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${escapeHtml(act.label)}</span>`;
      } else if (act.id === 'increase_ram' || act.id === 'switch_java_21' || act.id === 'disable_shaders' || act.id === 'install_fabric_api') {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg><span>${escapeHtml(act.label)}</span>`;
      } else {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg><span>${escapeHtml(act.label)}</span>`;
      }

      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          const originalContent = btn.innerHTML;
          btn.innerHTML = '<span>Naprawianie...</span>';

          const res = await window.api.executeCrashFix(act.id, act.payload || {});
          if (res?.success) {
            btn.innerHTML = '<span>Naprawiono! ✓</span>';
            btn.classList.remove('btn-danger', 'btn-primary');
            btn.classList.add('btn-emerald');
            showToast(res.message || 'Problem został pomyślnie naprawiony!');

            if (act.id === 'disable_mod' || act.id === 'delete_mod' || act.id === 'disable_duplicates') {
              try { await loadMods(); } catch (_) {}
            }
            if (act.id === 'increase_ram' || act.id === 'switch_java_21') {
              try { await loadConfig(); } catch (_) {}
            }
          } else {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            showToast(`Błąd naprawy: ${res?.error || 'Nieznany błąd'}`);
          }
        } catch (err) {
          btn.disabled = false;
          showToast(`Błąd: ${err.message}`);
        }
      });

      actionsContainer.appendChild(btn);
    });
  }

  if (rawCode) {
    rawCode.textContent = diagnosis.rawReport || 'Brak szczegółowego zrzutu stosu.';
  }

  modal.classList.add('open');
  try { window.uiSounds?.playClick?.(); } catch (_) {}
}

function closeCrashDoctorModal() {
  const modal = document.getElementById('crash-doctor-modal');
  if (modal) modal.classList.remove('open');
}

async function triggerManualCrashDoctor() {
  showToast('Sprawdzanie logów gry i raportów błędów...');
  try {
    const diag = await window.api.diagnoseCrash('active');
    if (diag && (diag.hasCrash || diag.duplicates?.length > 0)) {
      openCrashDoctorModal(diag);
    } else {
      showToast('Wszystko w porządku! Nie wykryto żadnych problemów z modami.');
    }
  } catch (err) {
    showToast(`Błąd diagnostyki: ${err.message}`);
  }
}

function setupCrashDoctorListeners() {
  document.getElementById('btn-open-crash-doctor')?.addEventListener('click', () => {
    triggerManualCrashDoctor();
  });

  document.getElementById('btn-close-crash-modal')?.addEventListener('click', closeCrashDoctorModal);

  const modal = document.getElementById('crash-doctor-modal');
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCrashDoctorModal();
    }
  });

  if (window.api?.onCrashDetected) {
    window.api.onCrashDetected((diagnosis) => {
      console.warn('[CrashDoctor] Otrzymano zdarzenie awarii gry:', diagnosis);
      openCrashDoctorModal(diagnosis);
    });
  }
}

// ============================================================================
// ============================================================================

const benchmarkUIState = {
  specs: null,
  recommendations: null,
  lastScore: null,
  isRunning: false
};

async function loadBenchmarkHardwareSpecs() {
  if (!window.api?.getDetailedSpecs) return;

  try {
    const specs = await window.api.getDetailedSpecs();
    if (specs) {
      benchmarkUIState.specs = specs;

      const cpuName = document.getElementById('spec-cpu-name');
      const cpuThreads = document.getElementById('spec-cpu-threads');
      const gpuName = document.getElementById('spec-gpu-name');
      const gpuType = document.getElementById('spec-gpu-type');
      const ramTotal = document.getElementById('spec-ram-total');
      const ramFree = document.getElementById('spec-ram-free');
      const javaVer = document.getElementById('spec-java-ver');
      const osInfo = document.getElementById('spec-os-info');

      if (cpuName) cpuName.textContent = specs.cpu.model;
      if (cpuThreads) cpuThreads.textContent = `${specs.cpu.cores} fiz. rdzeni / ${specs.cpu.threads} wątków (${specs.cpu.speedMhz} MHz)`;
      if (gpuName) gpuName.textContent = specs.gpu.primary;
      if (gpuType) gpuType.textContent = specs.gpu.hasDedicated ? 'Dedykowany akcelerator 3D' : 'Zintegrowany układ graficzny';
      if (ramTotal) ramTotal.textContent = `${specs.ram.totalGb} GB RAM`;
      if (ramFree) ramFree.textContent = `Dostępne: ${specs.ram.freeGb} GB (Zajęte: ${specs.ram.usedGb} GB)`;
      if (javaVer) javaVer.textContent = `Java ${specs.java.version}`;
      if (osInfo) osInfo.textContent = `${specs.os.platform} (${specs.os.arch}) • Dysk wolny: ${specs.disk.freeGb} GB`;
    }

    if (window.api?.getOptimalConfig) {
      const targetProfileId = document.getElementById('select-benchmark-profile')?.value || 'active';
      const configRes = await window.api.getOptimalConfig(targetProfileId);
      if (configRes?.success && configRes.recommendations) {
        benchmarkUIState.recommendations = configRes.recommendations;
        updateBenchmarkComparisonUI(configRes.recommendations);
      }
    }
  } catch (err) {
    console.error('[Benchmark] Błąd ładowania parametrów sprzętu:', err);
  }
}

function updateBenchmarkComparisonUI(recom) {
  if (!recom) return;

  const diffRamBefore = document.getElementById('diff-ram-before');
  const diffRamAfter = document.getElementById('diff-ram-after');
  const diffJvmBefore = document.getElementById('diff-jvm-before');
  const diffJvmAfter = document.getElementById('diff-jvm-after');
  const diffRenderBefore = document.getElementById('diff-render-before');
  const diffRenderAfter = document.getElementById('diff-render-after');

  if (diffRamBefore) diffRamBefore.textContent = `${recom.ram.current} GB`;
  if (diffRamAfter) diffRamAfter.textContent = `${recom.ram.optimal} GB`;

  if (diffJvmBefore) diffJvmBefore.textContent = (recom.jvmPreset.current || 'g1gc').toUpperCase();
  if (diffJvmAfter) diffJvmAfter.textContent = recom.jvmPreset.optimal === 'ultra' ? 'Ultra FPS (Aikar G1GC)' : recom.jvmPreset.optimal.toUpperCase();

  if (diffRenderBefore) diffRenderBefore.textContent = `${recom.renderDistance.current} chunków`;
  if (diffRenderAfter) diffRenderAfter.textContent = `${recom.renderDistance.optimal} chunków`;
}

async function startBenchmarkTest() {
  if (benchmarkUIState.isRunning || !window.api?.runBenchmark) return;
  benchmarkUIState.isRunning = true;

  const progressZone = document.getElementById('benchmark-progress-zone');
  const stageText = document.getElementById('benchmark-stage-text');
  const pctText = document.getElementById('benchmark-pct');
  const fillBar = document.getElementById('benchmark-progress-fill');
  const scoreText = document.getElementById('benchmark-score-text');
  const circleBar = document.getElementById('score-circle-bar');
  const heroTitle = document.getElementById('benchmark-hero-title');
  const heroSubtitle = document.getElementById('benchmark-hero-subtitle');
  const tierPill = document.getElementById('benchmark-tier-pill');
  const tierLabel = document.getElementById('benchmark-tier-label');

  if (progressZone) progressZone.style.display = 'flex';
  if (scoreText) scoreText.textContent = '...';

  const setStage = (pct, text) => {
    if (stageText) stageText.textContent = text;
    if (pctText) pctText.textContent = `${pct}%`;
    if (fillBar) fillBar.style.width = `${pct}%`;
  };

  setStage(15, '1/4 Testowanie wydajności jednowątkowej procesora CPU...');
  await new Promise(r => setTimeout(r, 450));

  setStage(45, '2/4 Testowanie alokatora pamięci RAM & przepustowości...');
  await new Promise(r => setTimeout(r, 550));

  setStage(75, '3/4 Testowanie jednostki GPU & shaderów...');
  await new Promise(r => setTimeout(r, 500));

  setStage(90, '4/4 Analiza wielowątkowości chunków i generowanie profilu...');

  try {
    const res = await window.api.runBenchmark();
    setStage(100, 'Test zakończony sukcesem!');
    await new Promise(r => setTimeout(r, 300));

    if (res?.success) {
      benchmarkUIState.lastScore = res.scores.total;

      const targetScore = res.scores.total;
      let currentVal = 0;
      const step = Math.max(1, Math.floor(targetScore / 40));
      const counterTimer = setInterval(() => {
        currentVal += step;
        if (currentVal >= targetScore) {
          currentVal = targetScore;
          clearInterval(counterTimer);
        }
        if (scoreText) scoreText.textContent = currentVal.toLocaleString();
      }, 20);

      if (circleBar) {
        const offset = Math.max(0, 314 - (314 * Math.min(10000, targetScore) / 10000));
        circleBar.style.strokeDashoffset = offset;
        circleBar.style.stroke = res.tierColor || '#10B981';
      }

      if (tierLabel) tierLabel.textContent = res.tierLabel.toUpperCase();
      if (tierPill) {
        tierPill.style.color = res.tierColor || '#10B981';
        tierPill.style.borderColor = `${res.tierColor || '#10B981'}44`;
      }
      if (heroTitle) heroTitle.textContent = `Wynik: ${res.tierLabel}`;
      if (heroSubtitle) {
        heroSubtitle.textContent = `Twój komputer uzyskał ${targetScore.toLocaleString()} punktów (CPU: ${res.scores.cpu}, RAM: ${res.scores.ram}, GPU: ${res.scores.gpu}). Rekomendowane ustawienia zostały zaktualizowane poniżej!`;
      }

      showToast(`🏆 Benchmark ukończony: ${targetScore.toLocaleString()} pkt (${res.tierLabel})!`);
      try { window.uiSounds?.playClick?.(); } catch (_) {}

      await loadBenchmarkHardwareSpecs();
    }
  } catch (err) {
    showToast(`Błąd podczas testu: ${err.message}`);
  } finally {
    benchmarkUIState.isRunning = false;
    setTimeout(() => {
      if (progressZone) progressZone.style.display = 'none';
    }, 1200);
  }
}

function updateBenchmarkProfileDropdown() {
  const select = document.getElementById('select-benchmark-profile');
  if (!select) return;

  const currentVal = select.value || 'active';
  const activeProfile = getActiveProfileObj();
  const activeName = activeProfile ? activeProfile.name : 'Główny';

  let html = `
    <option value="active">Aktywny profil (${escapeHtml(activeName)})</option>
  `;

  if (profilesState?.profiles && Array.isArray(profilesState.profiles)) {
    for (const p of profilesState.profiles) {
      const isCurActive = activeProfile && activeProfile.id === p.id;
      html += `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${p.loader || 'Fabric'}) ${isCurActive ? '★' : ''}</option>`;
    }
  }

  select.innerHTML = html;
  if ([...select.options].some(o => o.value === currentVal)) {
    select.value = currentVal;
  }

  updateBenchmarkProfileBadges();
}

function updateBenchmarkProfileBadges() {
  const select = document.getElementById('select-benchmark-profile');
  const selectedVal = select?.value || 'active';
  let targetName = 'Aktywny profil';

  if (selectedVal === 'active') {
    const active = getActiveProfileObj();
    targetName = active ? `${active.name}` : 'Aktywny';
  } else if (profilesState?.profiles) {
    const found = profilesState.profiles.find(p => p.id === selectedVal);
    if (found) targetName = found.name;
  }

  const recomBadge = document.getElementById('recom-target-profile-badge');
  if (recomBadge) recomBadge.textContent = `Profil: ${targetName}`;
}

async function applyOptimalBenchmarkSettings() {
  if (!window.api?.applyOptimalConfig) return;

  const btnBig = document.getElementById('btn-apply-optimal-settings-big');
  const btnSm = document.getElementById('btn-apply-optimal-settings');

  const recom = benchmarkUIState.recommendations;
  if (!recom) {
    showToast('Najpierw załaduj lub uruchom test wydajności!');
    return;
  }

  const payload = {
    ram: recom.ram.optimal,
    jvmPreset: recom.jvmPreset.optimal,
    renderDistance: recom.renderDistance.optimal,
    simulationDistance: recom.simulationDistance.optimal,
    chunkBuilderThreads: recom.sodium.threads
  };

  const targetProfileId = document.getElementById('select-benchmark-profile')?.value || 'active';

  try {
    if (btnBig) { btnBig.disabled = true; btnBig.textContent = 'Stosowanie optymalizacji...'; }
    if (btnSm) { btnSm.disabled = true; btnSm.textContent = 'Stosowanie...'; }

    const res = await window.api.applyOptimalConfig(payload, targetProfileId);
    if (res?.success) {
      const profName = res.profileName || 'wybrany profil';
      showToast(`⚡ Zastosowano profil: Ultra FPS dla "${profName}"! Minecraft i Sodium zostały zoptymalizowane.`);
      try { window.uiSounds?.playClick?.(); } catch (_) {}

      if (btnBig) { btnBig.textContent = 'Zastosowano Pomyślnie! ✓'; }
      if (btnSm) { btnSm.textContent = 'Zastosowano ✓'; }

      try { await loadConfig(); } catch (_) {}
      try { await loadProfiles(); } catch (_) {}
      await loadBenchmarkHardwareSpecs();

      setTimeout(() => {
        if (btnBig) { btnBig.disabled = false; btnBig.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Zastosuj Optymalne Ustawienia w 1 Kliknięcie</span>'; }
        if (btnSm) { btnSm.disabled = false; btnSm.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg><span>Zastosuj (1-Click)</span>'; }
      }, 3000);
    } else {
      showToast(`Błąd stosowania ustawień: ${res?.error || 'Nieznany błąd'}`);
      if (btnBig) { btnBig.disabled = false; btnBig.textContent = 'Spróbuj ponownie'; }
      if (btnSm) { btnSm.disabled = false; btnSm.textContent = 'Spróbuj'; }
    }
  } catch (err) {
    showToast(`Błąd: ${err.message}`);
    if (btnBig) btnBig.disabled = false;
    if (btnSm) btnSm.disabled = false;
  }
}

function setupBenchmarkListeners() {
  document.getElementById('btn-run-benchmark-hero')?.addEventListener('click', startBenchmarkTest);
  document.getElementById('btn-run-benchmark-main')?.addEventListener('click', startBenchmarkTest);
  document.getElementById('btn-apply-optimal-settings')?.addEventListener('click', applyOptimalBenchmarkSettings);
  document.getElementById('btn-apply-optimal-settings-big')?.addEventListener('click', applyOptimalBenchmarkSettings);
  document.getElementById('select-benchmark-profile')?.addEventListener('change', async (e) => {
    const val = e.target.value;
    updateBenchmarkProfileBadges();
    if (val && val !== 'active') {
      try {
        await window.api.selectProfile(val);
        await loadProfiles();
        const found = profilesState?.profiles?.find(p => p.id === val);
        const profName = found ? found.name : val;
        showToast(`🎯 Ustawiono profil: ${profName}`);
      } catch (err) {
        console.warn('Błąd zmiany profilu:', err);
      }
    }
    await loadBenchmarkHardwareSpecs();
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
