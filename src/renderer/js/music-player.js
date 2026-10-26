// KasteuszLauncher Music Player (Lofi / Gaming Synthwave / Ambient OST)
(function() {
  const STATIONS = [
    {
      id: 'lofi',
      name: 'Lofi Chill Beats',
      genre: 'Lofi Hip-Hop',
      url: 'https://streams.ilovemusic.de/iloveradio17.mp3'
    },
    {
      id: 'synthwave',
      name: 'Synthwave & Cyberpunk',
      genre: 'Retro Electro',
      url: 'https://ice1.somafm.com/defcon-128-mp3'
    },
    {
      id: 'ambient',
      name: 'Minecraft Ambient & Relax',
      genre: 'Ambient OST',
      url: 'https://ice2.somafm.com/dronezone-128-mp3'
    }
  ];

  let audioEl = null;
  let isPlaying = false;
  let currentStationIdx = 0;
  let volume = 0.35;
  let pausedForGame = false;

  const player = {
    init(userStation = 'lofi', userVol = 0.35) {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.preload = 'none';

        audioEl.addEventListener('error', (e) => {
          console.warn('[Music Player] Błąd streamu, próba odtworzenia kolejnej stacji...');
          player.updateUI();
        });

        audioEl.addEventListener('playing', () => {
          isPlaying = true;
          player.updateUI();
        });

        audioEl.addEventListener('pause', () => {
          isPlaying = false;
          player.updateUI();
        });
      }

      const foundIdx = STATIONS.findIndex(s => s.id === userStation);
      currentStationIdx = foundIdx >= 0 ? foundIdx : 0;
      volume = Math.max(0, Math.min(1, userVol));
      audioEl.volume = volume;

      player.setupUI();
    },

    play() {
      if (!audioEl) return;
      const station = STATIONS[currentStationIdx];
      if (audioEl.src !== station.url) {
        audioEl.src = station.url;
      }
      audioEl.play().then(() => {
        isPlaying = true;
        player.updateUI();
      }).catch(err => {
        console.warn('[Music Player] Autoplay prevented or stream error:', err);
        isPlaying = false;
        player.updateUI();
      });
    },

    pause() {
      if (audioEl) {
        audioEl.pause();
        isPlaying = false;
        player.updateUI();
      }
    },

    toggle() {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    },

    next() {
      currentStationIdx = (currentStationIdx + 1) % STATIONS.length;
      const wasPlaying = isPlaying;
      if (audioEl) audioEl.pause();
      const station = STATIONS[currentStationIdx];
      if (audioEl) audioEl.src = station.url;
      if (wasPlaying) {
        player.play();
      } else {
        player.updateUI();
      }
      window.api?.saveConfig({ musicPlayerStation: station.id });
    },

    prev() {
      currentStationIdx = (currentStationIdx - 1 + STATIONS.length) % STATIONS.length;
      const wasPlaying = isPlaying;
      if (audioEl) audioEl.pause();
      const station = STATIONS[currentStationIdx];
      if (audioEl) audioEl.src = station.url;
      if (wasPlaying) {
        player.play();
      } else {
        player.updateUI();
      }
      window.api?.saveConfig({ musicPlayerStation: station.id });
    },

    setVolume(val) {
      volume = Math.max(0, Math.min(1, val));
      if (audioEl) {
        audioEl.volume = volume;
      }
      const slider = document.getElementById('music-volume-slider');
      if (slider) slider.value = Math.round(volume * 100);
      window.api?.saveConfig({ musicPlayerVolume: volume });
    },

    onGameLaunch() {
      if (isPlaying) {
        pausedForGame = true;
        player.pause();
      }
    },

    onGameClose() {
      if (pausedForGame) {
        pausedForGame = false;
        player.play();
      }
    },

    setupUI() {
      const btnToggle = document.getElementById('btn-music-toggle');
      const btnNext = document.getElementById('btn-music-next');
      const btnPrev = document.getElementById('btn-music-prev');
      const volSlider = document.getElementById('music-volume-slider');

      btnToggle?.addEventListener('click', () => player.toggle());
      btnNext?.addEventListener('click', () => player.next());
      btnPrev?.addEventListener('click', () => player.prev());
      volSlider?.addEventListener('input', (e) => {
        player.setVolume(parseInt(e.target.value, 10) / 100);
      });

      player.updateUI();
    },

    updateUI() {
      const station = STATIONS[currentStationIdx];
      const titleEl = document.getElementById('music-title');
      const genreEl = document.getElementById('music-genre');
      const btnToggle = document.getElementById('btn-music-toggle');
      const visualizer = document.getElementById('music-visualizer');

      if (titleEl) titleEl.textContent = station.name;
      if (genreEl) genreEl.textContent = station.genre;
      if (btnToggle) {
        btnToggle.innerHTML = isPlaying ? '⏸' : '▶';
        btnToggle.title = isPlaying ? 'Pauza' : 'Odtwarzaj';
      }
      if (visualizer) {
        visualizer.classList.toggle('animating', isPlaying);
      }
    }
  };

  window.musicPlayer = player;
})();
