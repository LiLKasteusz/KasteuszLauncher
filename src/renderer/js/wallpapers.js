// KasteuszLauncher Live Wallpapers Engine (Canvas 2D / 60 FPS / Theme-Adaptive)
(function() {
  let canvas = null;
  let ctx = null;
  let animId = null;
  let currentStyle = 'matrix';
  let opacity = 0.55;
  let width = 0;
  let height = 0;
  let isPaused = false;

  // Particle storage for Matrix & Warp
  let particles = [];
  let stars = [];
  let waveTick = 0;

  function hexToRgb(hex) {
    if (!hex) return { r: 168, g: 85, b: 247 };
    hex = hex.replace('#', '').trim();
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function getThemeRgb() {
    try {
      const col = getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim();
      return hexToRgb(col || '#6366F1');
    } catch (_) {
      return { r: 99, g: 102, b: 241 };
    }
  }

  function resize() {
    if (!canvas) return;
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initParticles();
    initStars();
  }

  function initParticles() {
    particles = [];
    const count = Math.min(65, Math.floor((width * height) / 18000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.45,
        vy: (Math.random() - 0.5) * 0.45,
        radius: Math.random() * 2 + 1.2,
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  function initStars() {
    stars = [];
    const count = 160;
    for (let i = 0; i < count; i++) {
      stars.push({
        x: (Math.random() - 0.5) * width * 1.5,
        y: (Math.random() - 0.5) * height * 1.5,
        z: Math.random() * width,
        prevZ: 0
      });
    }
  }

  // Style 1: Cyber Matrix / Constellations
  function renderMatrix(rgb) {
    ctx.clearRect(0, 0, width, height);
    const maxDist = 125;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      else if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      else if (p.y > height) p.y = 0;

      p.pulse += 0.025;
      const currentRadius = p.radius + Math.sin(p.pulse) * 0.6;

      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.8, currentRadius), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.5 * opacity})`;
      ctx.shadowBlur = 8;
      ctx.shadowColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Connect neighbor particles with glowing neon lines
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const dx = p.x - p2.x;
        const dy = p.y - p2.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDist) {
          const alpha = (1 - dist / maxDist) * 0.28 * opacity;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  // Style 2: Hyperspace Warp Speed Starfield
  function renderWarp(rgb) {
    // Slight motion blur background
    ctx.fillStyle = 'rgba(10, 11, 16, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const speed = 7.5;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.prevZ = s.z;
      s.z -= speed;

      if (s.z <= 0) {
        s.z = width;
        s.prevZ = width;
        s.x = (Math.random() - 0.5) * width * 1.5;
        s.y = (Math.random() - 0.5) * height * 1.5;
      }

      const k = 250 / s.z;
      const px = s.x * k + cx;
      const py = s.y * k + cy;

      const prevK = 250 / s.prevZ;
      const prevPx = s.x * prevK + cx;
      const prevPy = s.y * prevK + cy;

      if (px >= 0 && px <= width && py >= 0 && py <= height) {
        const alpha = Math.min(1, (1 - s.z / width) * 1.2) * opacity;
        ctx.beginPath();
        ctx.moveTo(prevPx, prevPy);
        ctx.lineTo(px, py);
        ctx.strokeStyle = `rgba(${Math.min(255, rgb.r + 50)}, ${Math.min(255, rgb.g + 50)}, ${Math.min(255, rgb.b + 50)}, ${alpha})`;
        ctx.lineWidth = Math.max(1, (1 - s.z / width) * 2.4);
        ctx.stroke();
      }
    }
  }

  // Style 3: Cosmic Aurora Wave
  function renderAurora(rgb) {
    ctx.clearRect(0, 0, width, height);
    waveTick += 0.012;

    const layers = 3;
    for (let i = 0; i < layers; i++) {
      ctx.beginPath();
      const waveAlpha = (0.16 / (i + 1)) * opacity;
      ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${waveAlpha})`;

      const yOffset = height * (0.45 + i * 0.14);
      ctx.moveTo(0, height);
      ctx.lineTo(0, yOffset);

      for (let x = 0; x <= width; x += 15) {
        const sin1 = Math.sin(x * 0.003 + waveTick + i * 1.5);
        const sin2 = Math.cos(x * 0.006 - waveTick * 0.8 + i);
        const y = yOffset + (sin1 * 65 + sin2 * 35);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fill();
    }
  }

  function loop() {
    if (isPaused || currentStyle === 'none') {
      animId = requestAnimationFrame(loop);
      return;
    }

    const rgb = getThemeRgb();

    if (currentStyle === 'matrix') {
      renderMatrix(rgb);
    } else if (currentStyle === 'warp') {
      renderWarp(rgb);
    } else if (currentStyle === 'aurora') {
      renderAurora(rgb);
    }

    animId = requestAnimationFrame(loop);
  }

  const wallpaperSystem = {
    init(style = 'matrix', opac = 0.55) {
      canvas = document.getElementById('live-wallpaper-canvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');

      currentStyle = style || 'matrix';
      opacity = Math.max(0.1, Math.min(1.0, opac));

      window.addEventListener('resize', resize, { passive: true });
      document.addEventListener('visibilitychange', () => {
        isPaused = document.hidden;
      });

      resize();
      if (!animId) loop();
    },

    setStyle(style) {
      currentStyle = style || 'none';
      if (ctx && canvas) {
        ctx.clearRect(0, 0, width, height);
      }
      if (currentStyle === 'warp') {
        initStars();
      } else if (currentStyle === 'matrix') {
        initParticles();
      }
    },

    setOpacity(val) {
      opacity = Math.max(0.05, Math.min(1.0, val));
    },

    updateThemeColors() {},

    pause(val = true) {
      isPaused = !!val;
      if (val && ctx && canvas) {
        ctx.clearRect(0, 0, width, height);
      }
    }
  };

  window.liveWallpapers = wallpaperSystem;
})();
