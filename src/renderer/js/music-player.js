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
  let radioActive = false; // czy gra stacja radiowa (lofi/synthwave/ambient)
  let isStandaloneSpotify = false; // czy gra samodzielny odtwarzacz Spotify (bez aplikacji Spotify!)
  let currentPlaylist = [];
  let currentPlaylistIndex = 0;
  let playlistName = '';
  let playlistCover = '';
  let isResolvingTrack = false;

  const player = {
    init(userStation = 'lofi', userVol = 0.35) {
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.crossOrigin = 'anonymous';
        audioEl.preload = 'none';

        audioEl.addEventListener('error', (e) => {
          console.warn('[Music Player] Błąd odtwarzania utworu/strumienia:', e);
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
          console.log('[Music Player] Utwór zakończony. Następuje przejście do kolejnego utworu...');
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
          console.log('[Music Player] Odebrano skrót globalny (działa w Minecraft):', action);
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

    async loadSpotifyPlaylist(playlistInfo) {
      if (!playlistInfo || !playlistInfo.tracks || !playlistInfo.tracks.length) return;
      radioActive = false;
      isStandaloneSpotify = true;
      currentPlaylist = playlistInfo.tracks;
      currentPlaylistIndex = 0;
      playlistName = playlistInfo.name || 'Playlista Spotify';
      playlistCover = playlistInfo.coverUrl || 'assets/icon-256.png';
      await player.playCurrentStandaloneTrack();
    },

    async playCurrentStandaloneTrack() {
      if (!currentPlaylist || !currentPlaylist.length) return;
      if (currentPlaylistIndex < 0) currentPlaylistIndex = 0;
      if (currentPlaylistIndex >= currentPlaylist.length) currentPlaylistIndex = 0;

      const track = currentPlaylist[currentPlaylistIndex];
      if (!track) return;

      currentCustomTrack = {
        name: track.title,
        artists: track.artist,
        coverUrl: playlistCover
      };

      player.updateUI();
      player.updateModalView('Wyszukiwanie strumienia audio...');

      try {
        isResolvingTrack = true;
        const audioData = await window.api.spotifyResolveAudio(track.title, track.artist);
        isResolvingTrack = false;

        if (!audioData || !audioData.streamUrl) {
          throw new Error('Brak strumienia audio');
        }

        if (audioEl) {
          audioEl.src = audioData.streamUrl;
          audioEl.play().then(() => {
            isPlaying = true;
            player.updateUI();
            player.updateModalView('Spotify Standalone • Gra bez aplikacji Spotify!');
          }).catch(err => {
            console.warn('[Music Player] Błąd autoplay:', err);
            isPlaying = false;
            player.updateUI();
          });
        }
      } catch (err) {
        isResolvingTrack = false;
        console.warn('[Music Player] Błąd utworu:', err.message);
        player.updateModalView(`Błąd utworu: ${err.message}`);
        setTimeout(() => {
          if (isStandaloneSpotify) player.next();
        }, 2000);
      }
    },

    play() {
      if (!audioEl) return;
      if (isStandaloneSpotify) {
        if (!audioEl.src && currentPlaylist.length) {
          player.playCurrentStandaloneTrack();
          return;
        }
      } else if (!radioActive) {
        const station = STATIONS[currentStationIdx];
        if (audioEl.src !== station.url) {
          audioEl.src = station.url;
        }
      }

      audioEl.play().then(() => {
        isPlaying = true;
        player.updateUI();
      }).catch(err => {
        console.warn('[Music Player] Autoplay error:', err);
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
      if (isStandaloneSpotify) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      } else if (radioActive) {
        if (isPlaying) {
          player.pause();
        } else {
          player.play();
        }
      } else {
        // Jeśli nic nie było aktywne, włącz radio lub sprawdź Spotify
        player.play();
      }
    },

    next() {
      if (isStandaloneSpotify && currentPlaylist.length) {
        currentPlaylistIndex = (currentPlaylistIndex + 1) % currentPlaylist.length;
        player.playCurrentStandaloneTrack();
      } else if (radioActive) {
        currentStationIdx = (currentStationIdx + 1) % STATIONS.length;
        const wasPlaying = isPlaying;
        if (audioEl) audioEl.pause();
        const station = STATIONS[currentStationIdx];
        if (audioEl) audioEl.src = station.url;
        if (wasPlaying) player.play();
        else player.updateUI();
        window.api?.saveConfig({ musicPlayerStation: station.id });
      }
    },

    prev() {
      if (isStandaloneSpotify && currentPlaylist.length) {
        currentPlaylistIndex = (currentPlaylistIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        player.playCurrentStandaloneTrack();
      } else if (radioActive) {
        currentStationIdx = (currentStationIdx - 1 + STATIONS.length) % STATIONS.length;
        const wasPlaying = isPlaying;
        if (audioEl) audioEl.pause();
        const station = STATIONS[currentStationIdx];
        if (audioEl) audioEl.src = station.url;
        if (wasPlaying) player.play();
        else player.updateUI();
        window.api?.saveConfig({ musicPlayerStation: station.id });
      }
    },

    playStation(stationId) {
      isStandaloneSpotify = false;
      radioActive = true;
      currentCustomTrack = null;
      const idx = STATIONS.findIndex(s => s.id === stationId);
      if (idx >= 0) {
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

    updateModalView(statusText = '') {
      const titleEl = document.getElementById('spotify-now-playing-title');
      const artistEl = document.getElementById('spotify-now-playing-artist');
      const artEl = document.getElementById('spotify-now-playing-art');
      const playBtn = document.getElementById('btn-spotify-modal-play');
      const badgeText = document.getElementById('spotify-playback-badge-text');

      if (currentCustomTrack) {
        if (titleEl) titleEl.textContent = currentCustomTrack.name || 'Utwór Spotify';
        if (artistEl) artistEl.textContent = currentCustomTrack.artists || playlistName || 'Spotify Standalone';
        if (artEl && currentCustomTrack.coverUrl) artEl.src = currentCustomTrack.coverUrl;
      }
      if (playBtn) playBtn.textContent = isPlaying ? '⏸' : '▶';
      if (badgeText) {
        badgeText.textContent = statusText || (isPlaying ? 'Spotify Standalone • Gra w tle w Minecraft' : 'Spotify Standalone • Wstrzymano');
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

    isStandalone() {
      return isStandaloneSpotify;
    },

    isRadioPlaying() {
      return radioActive && isPlaying;
    }
  };

  window.musicPlayer = player;
})();
