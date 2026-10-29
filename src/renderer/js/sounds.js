(function() {
  let audioCtx = null;
  let masterGain = null;
  let enabled = true;
  let volume = 0.4;
  let lastHoverTime = 0;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioCtx = new AudioContextClass();
      masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  const soundSystem = {
    init(userEnabled = true, userVol = 0.4) {
      enabled = !!userEnabled;
      volume = Math.max(0, Math.min(1, userVol));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
      }
    },

    setEnabled(val) {
      enabled = !!val;
    },

    setVolume(val) {
      volume = Math.max(0, Math.min(1, val));
      if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(volume, audioCtx.currentTime);
      }
    },

    playClick() {
      if (!enabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.045);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    },

    playHover() {
      if (!enabled) return;
      const nowMs = Date.now();
      if (nowMs - lastHoverTime < 45) return;
      lastHoverTime = nowMs;

      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(450, now + 0.018);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.02);
    },

    playLaunch() {
      if (!enabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.35);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.30, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.35);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.42);
    },

    playToast() {
      if (!enabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      [587.33, 880.00].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.18, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.25);
      });
    },

    playEquip() {
      if (!enabled) return;
      const ctx = getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(850, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.12);
    },

    attachInteractiveListeners() {
      const clickSelector = '.nav-pill, .hero-tool-btn, .btn-primary, .btn-secondary, .skin-preset-btn, .cape-item-card, .theme-card, .btn-play-hero, .window-btn, .tab-btn, .wardrobe-tab, .cosmetic-card';
      const hoverSelector = '.nav-pill, .hero-tool-btn, .theme-card, .cape-item-card, .cosmetic-card, .btn-play-hero';

      document.body.addEventListener('click', (e) => {
        const target = e.target.closest(clickSelector);
        if (target) {
          if (target.classList.contains('btn-play-hero') || target.id === 'btn-launch-game') {
            soundSystem.playLaunch();
          } else if (target.classList.contains('cape-item-card') || target.classList.contains('cosmetic-card') || target.classList.contains('skin-preset-btn')) {
            soundSystem.playEquip();
          } else {
            soundSystem.playClick();
          }
        }
      }, { passive: true });

      document.body.addEventListener('mouseover', (e) => {
        const target = e.target.closest(hoverSelector);
        if (target) {
          soundSystem.playHover();
        }
      }, { passive: true });
    }
  };

  window.uiSounds = soundSystem;
})();
