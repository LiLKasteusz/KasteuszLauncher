// KasteuszLauncher Music Player (Lofi / Gaming Synthwave / Ambient OST + Spotify Integration)
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
  let currentCustomTrack = null; // Informacje o aktualnym utworze Spotify
  let radioActive = false; // czy aktualnie odtwarzana jest stacja radiowa (lofi/synthwave/ambient)

  const player = {
    init(userStation = 'lofi', userVol = 0.35) {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.preload = 'none';

        audioEl.addEventListener('error', (e) => {
          console.warn('[Music Player] Błąd streamu/utworu:', e);
          isPlaying = false;
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

        audioEl.addEventListener('ended', () => {
          player.next();
        });
      }

      const foundIdx = STATIONS.findIndex(s => s.id === userStation);
      currentStationIdx = foundIdx >= 0 ? foundIdx : 0;
      volume = Math.max(0, Math.min(1, userVol));
      audioEl.volume = volume;

      player.setupUI();
      player.setupGlobalShortcuts();
    },

    setupGlobalShortcuts() {
      if (window.api?.onMusicAction) {
        window.api.onMusicAction((action) => {
          console.log('[Music Player] Odebrano skrót globalny:', action);
          if (action === 'toggle') {
            player.toggle();
          } else if (action === 'next') {
            player.next();
          } else if (action === 'prev') {
            player.prev();
          }
        });
      }
    },

    play() {
      if (!audioEl) return;
      if (currentCustomTrack && currentCustomTrack.previewUrl) {
        if (audioEl.src !== currentCustomTrack.previewUrl) {
          audioEl.src = currentCustomTrack.previewUrl;
        }
      } else {
        const station = STATIONS[currentStationIdx];
        if (audioEl.src !== station.url) {
          audioEl.src = station.url;
        }
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
      if (radioActive) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Kontrolujemy odtwarzacz Spotify (Desktop Linux / MPRIS / Web)
        window.api?.spotifyControl('toggle').catch(() => {});
        if (window.syncMprisStatus) {
          setTimeout(window.syncMprisStatus, 250);
        }
      }
    },

    next() {
      if (radioActive) {
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
      } else {
        window.api?.spotifyControl('next').catch(() => {});
        if (window.syncMprisStatus) {
          setTimeout(window.syncMprisStatus, 300);
        }
      }
    },

    prev() {
      if (radioActive) {
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
      } else {
        window.api?.spotifyControl('prev').catch(() => {});
        if (window.syncMprisStatus) {
          setTimeout(window.syncMprisStatus, 300);
        }
      }
    },

    playSpotifyTrack(track) {
      if (!track) return;
      currentCustomTrack = track;
      if (audioEl) {
        audioEl.pause();
        if (track.previewUrl) {
          audioEl.src = track.previewUrl;
          player.play();
        } else {
          // Jeśli brak podglądu 30s, wysyłamy komendę do natywnego Spotify (MPRIS/Web)
          window.api?.spotifyControl('play', track.uri).catch(() => {});
          isPlaying = true;
          player.updateUI();
        }
      }
      player.updateUI();
    },

    playStation(stationId) {
      const idx = STATIONS.findIndex(s => s.id === stationId);
      if (idx >= 0) {
        radioActive = true;
        currentCustomTrack = null;
        currentStationIdx = idx;
        if (audioEl) {
          audioEl.pause();
          audioEl.src = STATIONS[idx].url;
        }
        player.play();
        window.api?.saveConfig({ musicPlayerStation: stationId });
      }
    },

    stopRadio() {
      radioActive = false;
      if (audioEl) {
        audioEl.pause();
        isPlaying = false;
        player.updateUI();
      }
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

    // Gra Minecraft wystartowała - MUZYKA GRA DALEJ W TLE!
    onGameLaunch() {
      console.log('[Music Player] Minecraft wystartował. Muzyka gra płynnie w tle podczas rozgrywki.');
      // Nie pauzujemy muzyki - gracz może słuchać utworów podczas gry!
    },

    onGameClose() {
      console.log('[Music Player] Gra Minecraft została zamknięta.');
    },

    setupUI() {
      const btnToggle = document.getElementById('btn-music-toggle');
      const btnNext = document.getElementById('btn-music-next');
      const btnPrev = document.getElementById('btn-music-prev');
      const volSlider = document.getElementById('music-volume-slider');

      btnToggle?.addEventListener('click', (e) => {
        e.stopPropagation();
        player.toggle();
      });
      btnNext?.addEventListener('click', (e) => {
        e.stopPropagation();
        player.next();
      });
      btnPrev?.addEventListener('click', (e) => {
        e.stopPropagation();
        player.prev();
      });
      volSlider?.addEventListener('input', (e) => {
        player.setVolume(parseInt(e.target.value, 10) / 100);
      });

      player.updateUI();
    },

    updateUI() {
      const titleEl = document.getElementById('music-title');
      const genreEl = document.getElementById('music-genre');
      const btnToggle = document.getElementById('btn-music-toggle');
      const visualizer = document.getElementById('music-visualizer');

      if (currentCustomTrack) {
        if (titleEl) titleEl.textContent = currentCustomTrack.name || 'Utwór Spotify';
        if (genreEl) genreEl.textContent = `🟢 Spotify • ${currentCustomTrack.artists || ''}`;
      } else {
        const station = STATIONS[currentStationIdx];
        if (titleEl) titleEl.textContent = station ? station.name : 'Lofi Chill Beats';
        if (genreEl) genreEl.textContent = station ? station.genre : 'Radio';
      }

      if (btnToggle) {
        btnToggle.innerHTML = isPlaying ? '⏸' : '▶';
        btnToggle.title = isPlaying ? 'Pauza' : 'Odtwarzaj';
      }
      if (visualizer) {
        visualizer.classList.toggle('animating', isPlaying);
      }
    },

    getStations() {
      return STATIONS;
    },

    getCurrentTrack() {
      return currentCustomTrack;
    },

    isPlaying() {
      return isPlaying;
    },

    isRadioPlaying() {
      return radioActive && isPlaying;
    }
  };

  window.musicPlayer = player;
})();
