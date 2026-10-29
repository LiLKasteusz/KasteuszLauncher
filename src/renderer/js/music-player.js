(function() {
  const STATIONS = [
    {
      id: 'lofi',
      name: 'Lofi Chill Beats',
      genre: 'Lofi Hip-Hop • Radio 24/7',
      url: 'https://streams.ilovemusic.de/iloveradio17.mp3'
    },
    {
      id: 'synthwave',
      name: 'Synthwave & Cyberpunk',
      genre: 'Retro Electro • Radio 24/7',
      url: 'https://ice1.somafm.com/defcon-128-mp3'
    },
    {
      id: 'ambient',
      name: 'Minecraft Ambient & Relax',
      genre: 'Ambient OST • Radio 24/7',
      url: 'https://ice2.somafm.com/dronezone-128-mp3'
    }
  ];

  const ICON_PLAY_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  const ICON_PAUSE_SM = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const ICON_PLAY_LG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
  const ICON_PAUSE_LG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';

  let audioEl = null;
  let isPlaying = false;
  let currentStationIdx = 0;
  let volume = 0.35;
  let currentCustomTrack = null;
  let radioActive = false;
  let isStandaloneSpotify = false;
  let currentPlaylist = [];
  let currentPlaylistIndex = 0;
  let playlistName = '';
  let playlistCover = '';
  let isResolvingTrack = false;
  let lastStateSync = 0;
  let isShuffle = false;
  let isLoop = false;
  let isUserSeeking = false;

  let currentLyricsKey = '';
  let parsedLyrics = [];
  let activeLyricIdx = -1;

  function formatTime(sec) {
    if (!sec || !isFinite(sec) || sec < 0) return '0:00';
    const total = Math.floor(sec);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  function parseLrc(lrcText) {
    const lines = String(lrcText || '').split(/\r?\n/);
    const out = [];
    const regex = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\](.*)/;
    for (const raw of lines) {
      const m = raw.match(regex);
      if (m) {
        const min = parseInt(m[1], 10);
        const sec = parseInt(m[2], 10);
        const frac = m[3] ? parseInt(m[3].padEnd(3, '0'), 10) / 1000 : 0;
        const text = m[4].trim();
        if (text) {
          out.push({ timeSec: min * 60 + sec + frac, text });
        }
      }
    }
    return out.sort((a, b) => a.timeSec - b.timeSec);
  }

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
          player.syncTrackState(true);
        });

        audioEl.addEventListener('playing', () => {
          isPlaying = true;
          player.updateUI();
          player.syncTrackState(true);
        });

        audioEl.addEventListener('pause', () => {
          isPlaying = false;
          player.updateUI();
          player.syncTrackState(true);
        });

        audioEl.addEventListener('ended', () => {
          if (isLoop && audioEl) {
            audioEl.currentTime = 0;
            audioEl.play().catch(() => {});
            return;
          }
          player.next();
        });

        audioEl.addEventListener('timeupdate', () => {
          player.updateTimelineUI();
          player.updateActiveLyric();
          player.syncTrackState(false);
        });

        audioEl.addEventListener('loadedmetadata', () => {
          player.updateTimelineUI();
        });
      }

      const foundIdx = STATIONS.findIndex(s => s.id === userStation);
      currentStationIdx = foundIdx >= 0 ? foundIdx : 0;
      volume = Math.max(0, Math.min(1, userVol));
      audioEl.volume = volume;

      player.setupUI();
      player.setupGlobalShortcuts();

      setInterval(() => {
        if (isPlaying || currentCustomTrack || radioActive) {
          player.syncTrackState(false);
        }
      }, 250);
    },

    setupGlobalShortcuts() {
      if (window.api?.onMusicAction) {
        window.api.onMusicAction((action, val) => {
          if (action === 'toggle') {
            player.toggle();
          } else if (action === 'next') {
            player.next();
          } else if (action === 'prev') {
            player.prev();
          } else if (action === 'volume' && typeof val === 'number') {
            player.setVolume(val / 100);
          }
        });
      }
    },

    async fetchLyricsForTrack(title, artist) {
      const container = document.getElementById('lyrics-scroll-container');
      const syncBadge = document.getElementById('lyrics-sync-badge');
      if (!container) return;

      const key = `${title || ''}::${artist || ''}`.trim().toLowerCase();
      if (!title || radioActive) {
        currentLyricsKey = '';
        parsedLyrics = [];
        activeLyricIdx = -1;
        if (syncBadge) syncBadge.textContent = 'Stacja Radiowa';
        container.innerHTML = '<div class="lyrics-placeholder">Słuchasz stacji radiowej na żywo. Wybierz utwór z playlisty Spotify lub wyszukiwarki, aby włączyć Live Lyrics.</div>';
        return;
      }

      if (key === currentLyricsKey && parsedLyrics.length > 0) return;
      currentLyricsKey = key;
      parsedLyrics = [];
      activeLyricIdx = -1;

      if (syncBadge) syncBadge.textContent = 'Pobieranie...';
      container.innerHTML = '<div class="lyrics-placeholder">Pobieranie synchronizowanego tekstu piosenki z LRCLIB...</div>';

      try {
        const res = await window.api?.getLyrics?.(title, artist);
        if (currentLyricsKey !== key) return;

        if (res && res.syncedLyrics) {
          parsedLyrics = parseLrc(res.syncedLyrics);
          if (parsedLyrics.length > 0) {
            if (syncBadge) syncBadge.textContent = 'LRCLIB Synced';
            container.innerHTML = '';
            parsedLyrics.forEach((line, idx) => {
              const el = document.createElement('div');
              el.className = 'lyric-line';
              el.dataset.idx = String(idx);
              el.textContent = line.text;
              el.addEventListener('click', () => {
                if (audioEl && isFinite(audioEl.duration)) {
                  audioEl.currentTime = Math.max(0, line.timeSec);
                }
              });
              container.appendChild(el);
            });
            return;
          }
        }

        if (res && res.plainLyrics) {
          if (syncBadge) syncBadge.textContent = 'Tekst statyczny';
          const lines = res.plainLyrics.split(/\r?\n/).filter(Boolean);
          container.innerHTML = '';
          lines.forEach(text => {
            const el = document.createElement('div');
            el.className = 'lyric-line';
            el.style.color = 'rgba(248, 250, 252, 0.78)';
            el.textContent = text;
            container.appendChild(el);
          });
          return;
        }

        if (syncBadge) syncBadge.textContent = 'Brak tekstu';
        container.innerHTML = `<div class="lyrics-placeholder">Brak zsynchronizowanego tekstu w bazie LRCLIB dla utworu „${title}”.</div>`;
      } catch (_) {
        if (syncBadge) syncBadge.textContent = 'Offline';
        container.innerHTML = '<div class="lyrics-placeholder">Nie udało się pobrać tekstu piosenki.</div>';
      }
    },

    updateActiveLyric() {
      if (!audioEl || !parsedLyrics.length) return;
      const cur = audioEl.currentTime + 0.15;
      let idx = -1;
      for (let i = 0; i < parsedLyrics.length; i++) {
        if (cur >= parsedLyrics[i].timeSec) {
          idx = i;
        } else {
          break;
        }
      }
      if (idx === activeLyricIdx) return;
      activeLyricIdx = idx;

      const container = document.getElementById('lyrics-scroll-container');
      if (!container) return;
      const nodes = container.querySelectorAll('.lyric-line');
      nodes.forEach((node, i) => {
        const isActive = i === idx;
        node.classList.toggle('active', isActive);
        if (isActive) {
          node.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    },

    updateTimelineUI() {
      if (!audioEl || isUserSeeking) return;
      const cur = audioEl.currentTime || 0;
      const dur = isFinite(audioEl.duration) ? audioEl.duration : 0;
      const ratio = dur > 0 ? Math.min(1000, Math.round((cur / dur) * 1000)) : 0;

      const fCur = document.getElementById('footer-time-cur');
      const fDur = document.getElementById('footer-time-dur');
      const fSeek = document.getElementById('footer-seek-slider');

      const tCur = document.getElementById('music-tab-time-cur');
      const tDur = document.getElementById('music-tab-time-dur');
      const tSeek = document.getElementById('music-tab-seek');

      const curTxt = formatTime(cur);
      const durTxt = radioActive ? 'LIVE' : formatTime(dur);

      if (fCur) fCur.textContent = curTxt;
      if (fDur) fDur.textContent = durTxt;
      if (fSeek) fSeek.value = String(ratio);

      if (tCur) tCur.textContent = curTxt;
      if (tDur) tDur.textContent = durTxt;
      if (tSeek) tSeek.value = String(ratio);
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

    async playSingleTrack(trackObj) {
      if (!trackObj || !trackObj.title) return;
      radioActive = false;
      isStandaloneSpotify = true;
      currentPlaylist = [{
        title: trackObj.title,
        artist: trackObj.artist || '',
        coverUrl: trackObj.coverUrl || 'assets/icon-256.png'
      }];
      currentPlaylistIndex = 0;
      playlistName = 'Wyszukiwarka Utworów';
      playlistCover = trackObj.coverUrl || 'assets/icon-256.png';
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
        coverUrl: track.coverUrl || playlistCover || 'assets/icon-256.png'
      };

      player.updateUI();
      player.updateModalView('Ładowanie strumienia audio...');
      player.fetchLyricsForTrack(track.title, track.artist);

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
            player.updateModalView('Aktywne • Gra w tle w grze');
          }).catch(err => {
            console.warn('[Music Player] Błąd autoplay:', err);
            isPlaying = false;
            player.updateUI();
          });
        }
      } catch (err) {
        isResolvingTrack = false;
        console.warn('[Music Player] Błąd utworu:', err.message);
        player.updateModalView(`Pomijanie niedostępnego utworu...`);
        setTimeout(() => {
          if (isStandaloneSpotify && currentPlaylist.length > 1) player.next();
        }, 1800);
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
        radioActive = true;
        const station = STATIONS[currentStationIdx];
        if (audioEl.src !== station.url) {
          audioEl.src = station.url;
        }
        player.fetchLyricsForTrack('', '');
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
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    },

    next() {
      if (isStandaloneSpotify && currentPlaylist.length) {
        if (isShuffle && currentPlaylist.length > 1) {
          let nextIdx = currentPlaylistIndex;
          while (nextIdx === currentPlaylistIndex) {
            nextIdx = Math.floor(Math.random() * currentPlaylist.length);
          }
          currentPlaylistIndex = nextIdx;
        } else {
          currentPlaylistIndex = (currentPlaylistIndex + 1) % currentPlaylist.length;
        }
        player.playCurrentStandaloneTrack();
      } else {
        radioActive = true;
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
        if (audioEl && audioEl.currentTime > 4) {
          audioEl.currentTime = 0;
          return;
        }
        currentPlaylistIndex = (currentPlaylistIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
        player.playCurrentStandaloneTrack();
      } else {
        radioActive = true;
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
        player.fetchLyricsForTrack('', '');
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
      const footerArt = document.getElementById('footer-cover-art');
      const playBtn = document.getElementById('btn-spotify-modal-play');
      const badgeText = document.getElementById('spotify-playback-badge-text');

      if (currentCustomTrack) {
        if (titleEl) titleEl.textContent = currentCustomTrack.name || 'Utwór Spotify';
        if (artistEl) artistEl.textContent = currentCustomTrack.artists || playlistName || 'Spotify Stream';
        const cover = currentCustomTrack.coverUrl || 'assets/icon-256.png';
        if (artEl) artEl.src = cover;
        if (footerArt) footerArt.src = cover;
      } else {
        const station = STATIONS[currentStationIdx];
        if (titleEl) titleEl.textContent = station ? station.name : 'Lofi Chill Beats';
        if (artistEl) artistEl.textContent = station ? station.genre : 'Radio 24/7';
        if (artEl) artEl.src = 'assets/icon-256.png';
        if (footerArt) footerArt.src = 'assets/icon-256.png';
      }

      if (playBtn) playBtn.innerHTML = isPlaying ? ICON_PAUSE_LG : ICON_PLAY_LG;
      if (badgeText) {
        badgeText.textContent = statusText || (isPlaying ? 'Odtwarzanie aktywne' : 'Wstrzymano');
      }
    },

    setVolume(val) {
      volume = Math.max(0, Math.min(1, val));
      if (audioEl) {
        audioEl.volume = volume;
      }
      const pct = Math.round(volume * 100);
      const slider1 = document.getElementById('music-volume-slider');
      const slider2 = document.getElementById('music-tab-volume');
      const volLabel = document.getElementById('music-tab-vol-label');
      if (slider1) slider1.value = String(pct);
      if (slider2) slider2.value = String(pct);
      if (volLabel) volLabel.textContent = `${pct}%`;
      window.api?.saveConfig({ musicPlayerVolume: volume });
    },

    onGameLaunch() {},
    onGameClose() {},

    setupUI() {
      const btnToggle = document.getElementById('btn-music-toggle');
      const btnNext = document.getElementById('btn-music-next');
      const btnPrev = document.getElementById('btn-music-prev');
      const volSlider = document.getElementById('music-volume-slider');
      const tabVolSlider = document.getElementById('music-tab-volume');
      const btnShuffle = document.getElementById('btn-music-tab-shuffle');
      const btnLoop = document.getElementById('btn-music-tab-loop');
      const footerSeek = document.getElementById('footer-seek-slider');
      const tabSeek = document.getElementById('music-tab-seek');

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
      tabVolSlider?.addEventListener('input', (e) => {
        player.setVolume(parseInt(e.target.value, 10) / 100);
      });

      btnShuffle?.addEventListener('click', () => {
        isShuffle = !isShuffle;
        btnShuffle.classList.toggle('active', isShuffle);
      });

      btnLoop?.addEventListener('click', () => {
        isLoop = !isLoop;
        btnLoop.classList.toggle('active', isLoop);
      });

      const bindSeek = (sliderEl) => {
        if (!sliderEl) return;
        sliderEl.addEventListener('mousedown', () => { isUserSeeking = true; });
        sliderEl.addEventListener('mouseup', () => { isUserSeeking = false; });
        sliderEl.addEventListener('change', (e) => {
          isUserSeeking = false;
          if (audioEl && isFinite(audioEl.duration) && audioEl.duration > 0) {
            const ratio = parseInt(e.target.value, 10) / 1000;
            audioEl.currentTime = ratio * audioEl.duration;
          }
        });
      };

      bindSeek(footerSeek);
      bindSeek(tabSeek);

      player.setVolume(volume);
      player.updateUI();
    },

    syncTrackState(force = false) {
      const now = Date.now();
      if (!force && now - lastStateSync < 200) return;
      lastStateSync = now;

      const title = currentCustomTrack ? currentCustomTrack.name : (radioActive ? STATIONS[currentStationIdx]?.name : '');
      const artist = currentCustomTrack ? currentCustomTrack.artists : (radioActive ? STATIONS[currentStationIdx]?.genre : '');
      const cover = currentCustomTrack ? (currentCustomTrack.coverUrl || playlistCover || '') : '';
      const posMs = audioEl && !isNaN(audioEl.currentTime) ? Math.round(audioEl.currentTime * 1000) : 0;
      const durMs = audioEl && !isNaN(audioEl.duration) && isFinite(audioEl.duration) ? Math.round(audioEl.duration * 1000) : 0;

      const active = (isPlaying || !!currentCustomTrack || radioActive) && !!title;

      window.api?.updateMusicState?.({
        active,
        isPlaying,
        title: title || '',
        artist: artist || '',
        artUrl: cover || '',
        positionMs: posMs,
        durationMs: durMs
      });
    },

    updateUI() {
      const titleEl = document.getElementById('music-title');
      const genreEl = document.getElementById('music-genre');
      const btnToggle = document.getElementById('btn-music-toggle');
      const visualizer = document.getElementById('music-visualizer');
      const sidebarMusicDot = document.getElementById('sidebar-music-dot');

      if (currentCustomTrack) {
        if (titleEl) titleEl.textContent = currentCustomTrack.name || 'Utwór Spotify';
        if (genreEl) genreEl.textContent = currentCustomTrack.artists || playlistName || 'Spotify Stream';
      } else {
        const station = STATIONS[currentStationIdx];
        if (titleEl) titleEl.textContent = station ? station.name : 'Lofi Chill Beats';
        if (genreEl) genreEl.textContent = station ? station.genre : 'Radio 24/7';
      }

      if (btnToggle) {
        btnToggle.innerHTML = isPlaying ? ICON_PAUSE_SM : ICON_PLAY_SM;
        btnToggle.title = isPlaying ? 'Pauza' : 'Odtwarzaj';
      }
      if (visualizer) {
        visualizer.classList.toggle('animating', isPlaying);
      }
      if (sidebarMusicDot) {
        sidebarMusicDot.classList.toggle('visible', isPlaying);
      }

      player.updateModalView();
      player.syncTrackState(true);
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
