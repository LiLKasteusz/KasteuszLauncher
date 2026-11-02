
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const config = require('./config');
const profiles = require('./profiles');
const launcher = require('./launcher');

function detectGpu() {
  if (process.platform === 'linux') {
    try {
      const output = execSync("lspci 2>/dev/null | grep -i 'vga\\|3d\\|display'", { encoding: 'utf8' });
      const lines = output.trim().split('\n').filter(Boolean);
      const gpus = lines.map(line => {
        const parts = line.split(/controller:\s*|controller\s+/i);
        let name = parts.length > 1 ? parts[1].trim() : line;
        name = name.replace(/\(rev [a-z0-9]+\)/i, '').trim();
        return name;
      });

      const dedicated = gpus.find(g => /nvidia|geforce|rtx|gtx|radeon rx/i.test(g));
      return {
        primary: dedicated || gpus[0] || 'Zintegrowana karta graficzna',
        all: gpus,
        hasDedicated: !!dedicated
      };
    } catch (_) {}
  } else if (process.platform === 'win32') {
    try {
      const output = execSync('wmic path win32_VideoController get name 2>nul', { encoding: 'utf8' });
      const gpus = output.split('\n').map(l => l.trim()).filter(l => l && l !== 'Name');
      return {
        primary: gpus[0] || 'Karta graficzna Windows',
        all: gpus,
        hasDedicated: gpus.some(g => /nvidia|rtx|gtx|radeon/i.test(g))
      };
    } catch (_) {}
  }

  return {
    primary: 'Domyślna karta graficzna systemu',
    all: ['Domyślna karta graficzna systemu'],
    hasDedicated: false
  };
}

function getDetailedSystemSpecs() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model || 'Wielordzeniowy procesor x86_64';
  const cpuSpeed = cpus[0]?.speed || 0;
  const threadCount = cpus.length || 4;
  const estimatedPhysicalCores = Math.max(1, Math.round(threadCount / (threadCount > 4 ? 2 : 1)));

  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const totalRamGb = parseFloat((totalBytes / (1024 ** 3)).toFixed(1));
  const freeRamGb = parseFloat((freeBytes / (1024 ** 3)).toFixed(1));

  let diskTotalGb = 0;
  let diskFreeGb = 0;
  try {
    const instDir = profiles.getActiveInstanceDirectory ? profiles.getActiveInstanceDirectory() : os.homedir();
    const stat = fs.statfsSync(instDir);
    diskTotalGb = parseFloat((stat.bsize * stat.blocks / (1024 ** 3)).toFixed(1));
    diskFreeGb = parseFloat((stat.bsize * stat.bfree / (1024 ** 3)).toFixed(1));
  } catch (_) {}

  const gpuInfo = detectGpu();

  let javaPath = 'java';
  let javaVersion = '21.0.6 (Temurin LTS)';
  try {
    const javaManager = require('./javaManager');
    const javaBin = javaManager.resolveConsoleJava ? javaManager.resolveConsoleJava(21) : (launcher.resolveJavaExecutable ? launcher.resolveJavaExecutable() : 'java');
    const jOut = execSync(`"${javaBin}" -version 2>&1`, { timeout: 3000, encoding: 'utf8' });
    const match = jOut.match(/(?:version|openjdk)\s+"?([0-9._]+)/i);
    if (match) javaVersion = match[1];
    javaPath = javaBin;
  } catch (_) {}

  return {
    cpu: {
      model: cpuModel,
      speedMhz: cpuSpeed,
      threads: threadCount,
      cores: estimatedPhysicalCores
    },
    ram: {
      totalGb: totalRamGb,
      freeGb: freeRamGb,
      usedGb: parseFloat((totalRamGb - freeRamGb).toFixed(1))
    },
    gpu: gpuInfo,
    disk: {
      totalGb: diskTotalGb,
      freeGb: diskFreeGb
    },
    os: {
      platform: process.platform === 'linux' ? 'Linux' : process.platform === 'win32' ? 'Windows' : 'macOS',
      release: os.release(),
      arch: os.arch()
    },
    java: {
      path: javaPath,
      version: javaVersion
    }
  };
}

async function runSyntheticBenchmark() {
  const specs = getDetailedSystemSpecs();

  const startCpu = Date.now();
  let dummy = 0;
  for (let i = 0; i < 4000000; i++) {
    dummy += Math.sqrt(i) * Math.sin(i);
  }
  const cpuDuration = Math.max(1, Date.now() - startCpu);
  const cpuScore = Math.min(4500, Math.round(180000 / cpuDuration));

  const startRam = Date.now();
  const arr = new Float64Array(1024 * 1024);
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = i * 1.5;
  }
  const ramDuration = Math.max(1, Date.now() - startRam);
  const ramScore = Math.min(3000, Math.round(120000 / ramDuration) + Math.round(specs.ram.totalGb * 120));

  let gpuScore = 2000;
  const gpuName = specs.gpu.primary.toLowerCase();
  if (/rtx\s*40|rx\s*7900|rtx\s*3080|rtx\s*3090/i.test(gpuName)) {
    gpuScore = 4800;
  } else if (/rtx\s*30|rtx\s*20|rx\s*6700|rx\s*6800|rx\s*6600/i.test(gpuName)) {
    gpuScore = 4000;
  } else if (/gtx\s*16|gtx\s*10|rx\s*580|rx\s*5500|vega/i.test(gpuName)) {
    gpuScore = 3200;
  } else if (specs.gpu.hasDedicated) {
    gpuScore = 2800;
  } else {
    gpuScore = 1500;
  }

  const threadBonus = Math.min(2500, specs.cpu.threads * 180);

  const totalScore = Math.round(cpuScore * 0.35 + ramScore * 0.25 + gpuScore * 0.25 + threadBonus * 0.15);

  let tier = 'MID_RANGE';
  let tierLabel = 'Średni Komputer / Laptop Gamingowy';
  let tierColor = 'var(--accent-primary)';

  if (totalScore >= 7500 || (specs.ram.totalGb >= 16 && specs.cpu.threads >= 12 && specs.gpu.hasDedicated)) {
    tier = 'ULTRA_GAMING';
    tierLabel = 'Potężna Maszyna Gamingowa (Ultra)';
    tierColor = '#10B981';
  } else if (totalScore >= 5000 || (specs.ram.totalGb >= 12 && specs.cpu.threads >= 8)) {
    tier = 'HIGH_END';
    tierLabel = 'Wydajny PC Gamingowy';
    tierColor = '#6366F1';
  } else if (totalScore < 3000 || specs.ram.totalGb <= 6 || specs.cpu.threads <= 4) {
    tier = 'LOW_END';
    tierLabel = 'Budżetowy PC / Low-End Laptop';
    tierColor = '#F59E0B';
  }

  return {
    success: true,
    specs,
    scores: {
      total: totalScore,
      cpu: cpuScore,
      ram: ramScore,
      gpu: gpuScore,
      threads: threadBonus
    },
    tier,
    tierLabel,
    tierColor,
    timestamp: Date.now()
  };
}

async function getOptimalConfig(profileId = 'active') {
  const benchmark = await runSyntheticBenchmark();
  const specs = benchmark.specs;
  const targetProfile = profiles.getProfileById ? profiles.getProfileById(profileId) : profiles.getActiveProfile();
  const instanceDir = profiles.getInstanceDirectory
    ? profiles.getInstanceDirectory(targetProfile)
    : path.join(os.homedir(), '.kasteuszlauncher', 'minecraft');

  let optimalRam = 4;
  if (specs.ram.totalGb >= 28) optimalRam = 8;
  else if (specs.ram.totalGb >= 12) optimalRam = 6;
  else if (specs.ram.totalGb >= 7) optimalRam = 4;
  else optimalRam = 2.5;

  let optimalJvmPreset = 'g1gc';
  let jvmPresetName = 'G1GC Aikar High Performance';
  if (specs.cpu.threads >= 8 && specs.ram.totalGb >= 12) {
    optimalJvmPreset = 'ultra';
    jvmPresetName = 'Ultra FPS (Generational ZGC — Java 21)';
  } else if (specs.cpu.threads <= 4 || specs.ram.totalGb <= 6) {
    optimalJvmPreset = 'lowend';
    jvmPresetName = 'Low-End PC (Zoptymalizowany Parallel GC)';
  }

  let renderDistance = 12;
  let simulationDistance = 8;
  let entityDistance = 1.0;
  let particles = 0;

  if (benchmark.tier === 'ULTRA_GAMING') {
    renderDistance = 16;
    simulationDistance = 10;
    entityDistance = 1.25;
    particles = 0;
  } else if (benchmark.tier === 'HIGH_END') {
    renderDistance = 14;
    simulationDistance = 8;
    entityDistance = 1.0;
    particles = 0;
  } else if (benchmark.tier === 'LOW_END') {
    renderDistance = 8;
    simulationDistance = 6;
    entityDistance = 0.75;
    particles = 2;
  }

  const chunkBuilderThreads = Math.max(1, Math.min(6, Math.floor(specs.cpu.threads / 2)));
  const sodiumOptimizations = {
    animate_only_visible_textures: true,
    use_entity_culling: true,
    use_fog_occlusion: true,
    use_block_face_culling: true,
    chunk_builder_threads: chunkBuilderThreads
  };

  const currentConfig = config.getConfig();
  const currentRam = (targetProfile && targetProfile.memoryMax) || currentConfig.memoryMax || 4;
  const currentJvmPreset = (targetProfile && targetProfile.jvmPreset) || currentConfig.jvmPreset || 'g1gc';

  let currentRenderDistance = 12;
  const optionsPath = path.join(instanceDir, 'options.txt');
  if (fs.existsSync(optionsPath)) {
    try {
      const optText = fs.readFileSync(optionsPath, 'utf8');
      const m = optText.match(/^renderDistance:(\d+)/m);
      if (m) currentRenderDistance = parseInt(m[1], 10);
    } catch (_) {}
  }

  return {
    success: true,
    profileId: targetProfile ? targetProfile.id : 'active',
    profileName: targetProfile ? targetProfile.name : 'Aktywny profil',
    benchmark,
    recommendations: {
      ram: {
        current: currentRam,
        optimal: optimalRam,
        label: `${optimalRam} GB (z ${specs.ram.totalGb} GB fizycznej pamięci)`
      },
      jvmPreset: {
        current: currentJvmPreset,
        optimal: optimalJvmPreset,
        label: jvmPresetName
      },
      renderDistance: {
        current: currentRenderDistance,
        optimal: renderDistance,
        label: `${renderDistance} chunków`
      },
      simulationDistance: {
        optimal: simulationDistance,
        label: `${simulationDistance} chunków`
      },
      sodium: {
        threads: chunkBuilderThreads,
        features: [
          'Animuj tylko widoczne tekstury (+15% FPS)',
          'Entity Culling — pomijaj niewidoczne moby (+25% FPS w bazach)',
          'Fog Occlusion — ukrywanie bloków we mgle (+10% FPS)',
          'Block Face Culling — ukrywanie niewidocznych ścian bloków'
        ]
      }
    }
  };
}

async function applyOptimalSettings(payload = {}, profileId = 'active') {
  const targetProfile = profiles.getProfileById ? profiles.getProfileById(profileId) : profiles.getActiveProfile();
  const instanceDir = profiles.getInstanceDirectory
    ? profiles.getInstanceDirectory(targetProfile)
    : path.join(os.homedir(), '.kasteuszlauncher', 'minecraft');

  const appliedChanges = [];

  try {
    const optimalRam = payload.ram || 6;
    const optimalPreset = payload.jvmPreset || 'ultra';

    if (targetProfile && profiles.updateProfile) {
      profiles.updateProfile(targetProfile.id, {
        memoryMax: optimalRam,
        jvmPreset: optimalPreset
      });
    }

    const activeProfile = profiles.getActiveProfile ? profiles.getActiveProfile() : null;
    if (activeProfile && targetProfile && activeProfile.id === targetProfile.id) {
      config.saveConfig({
        memoryMax: optimalRam,
        jvmPreset: optimalPreset
      });
    }

    appliedChanges.push(`Profil docelowy: ${targetProfile ? targetProfile.name : 'Aktywny'}`);
    appliedChanges.push(`Przydział pamięci RAM: ${optimalRam} GB`);
    appliedChanges.push(`Profil flag JVM: ${optimalPreset.toUpperCase()}`);

    const optionsPath = path.join(instanceDir, 'options.txt');
    const defaultOptionsPath = path.join(os.homedir(), '.kasteuszlauncher', 'minecraft', 'options.txt');
    if (!fs.existsSync(optionsPath) && fs.existsSync(defaultOptionsPath)) {
      try { fs.copyFileSync(defaultOptionsPath, optionsPath); } catch (_) {}
    }

    if (fs.existsSync(optionsPath)) {
      let optText = fs.readFileSync(optionsPath, 'utf8');

      if (payload.renderDistance) {
        if (/^renderDistance:\d+/m.test(optText)) {
          optText = optText.replace(/^renderDistance:\d+/m, `renderDistance:${payload.renderDistance}`);
        } else {
          optText += `\nrenderDistance:${payload.renderDistance}`;
        }
        appliedChanges.push(`Zasięg renderowania: ${payload.renderDistance} chunków`);
      }

      if (payload.simulationDistance) {
        if (/^simulationDistance:\d+/m.test(optText)) {
          optText = optText.replace(/^simulationDistance:\d+/m, `simulationDistance:${payload.simulationDistance}`);
        } else {
          optText += `\nsimulationDistance:${payload.simulationDistance}`;
        }
      }

      fs.writeFileSync(optionsPath, optText, 'utf8');
    }

    const sodiumPath = path.join(instanceDir, 'config', 'sodium-options.json');
    const sodiumDir = path.dirname(sodiumPath);
    if (!fs.existsSync(sodiumDir)) {
      fs.mkdirSync(sodiumDir, { recursive: true });
    }

    let sodiumJson = {};
    if (fs.existsSync(sodiumPath)) {
      try {
        sodiumJson = JSON.parse(fs.readFileSync(sodiumPath, 'utf8'));
      } catch (_) {}
    }

    sodiumJson.performance = sodiumJson.performance || {};
    sodiumJson.performance.animate_only_visible_textures = true;
    sodiumJson.performance.use_entity_culling = true;
    sodiumJson.performance.use_fog_occlusion = true;
    sodiumJson.performance.use_block_face_culling = true;
    if (payload.chunkBuilderThreads) {
      sodiumJson.performance.chunk_builder_threads = payload.chunkBuilderThreads;
    }

    fs.writeFileSync(sodiumPath, JSON.stringify(sodiumJson, null, 2), 'utf8');
    appliedChanges.push('Optymalizacje Sodium: Entity Culling, Occlusion & Texture Culling');

    return {
      success: true,
      profileId: targetProfile ? targetProfile.id : 'active',
      profileName: targetProfile ? targetProfile.name : 'Aktywny profil',
      message: `Wszystkie optymalne ustawienia zostały pomyślnie zastosowane dla profilu "${targetProfile ? targetProfile.name : 'Aktywny'}"!`,
      appliedChanges
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

module.exports = {
  getDetailedSystemSpecs,
  runSyntheticBenchmark,
  getOptimalConfig,
  applyOptimalSettings
};
