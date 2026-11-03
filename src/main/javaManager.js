const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const AdmZip = require('adm-zip');

const APP_DIR = path.join(os.homedir(), '.kasteuszlauncher');
const RUNTIME_DIR = path.join(APP_DIR, 'runtime');

let detectedCache = null;
let lastScanTs = 0;
const SCAN_CACHE_TTL_MS = 15000;

function getRequiredJavaMajor(mcVersion) {
  if (!mcVersion) return 21;
  const clean = String(mcVersion).replace(/^(fabric|quilt|forge|neoforge)-/, '').trim();
  const match = clean.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return 21;

  const major = parseInt(match[1], 10);
  const minor = parseInt(match[2], 10);
  const patch = parseInt(match[3] || '0', 10);

  if (isNaN(major)) return 21;

  if (major === 1) {
    if (minor >= 21) return 21;
    if (minor === 20 && patch >= 5) return 21;
    if (minor >= 17) return 17;
    return 8;
  }
  return 21;
}

function probeJava(binPath) {
  try {
    if (!binPath || typeof binPath !== 'string') return null;
    const isWin = process.platform === 'win32';

    let resolvedBin = binPath;
    if (fs.existsSync(binPath)) {
      resolvedBin = path.resolve(binPath);
    }

    let probeBin = resolvedBin;
    let javawBin = resolvedBin;

    if (isWin) {
      if (/javaw(\.exe)?$/i.test(resolvedBin)) {
        const sibling = resolvedBin.replace(/javaw(\.exe)?$/i, 'java$1');
        if (fs.existsSync(sibling)) {
          probeBin = sibling;
        }
      } else if (/java(\.exe)?$/i.test(resolvedBin)) {
        const sibling = resolvedBin.replace(/java(\.exe)?$/i, 'javaw$1');
        if (fs.existsSync(sibling)) {
          javawBin = sibling;
        }
      }
    }

    const out = execSync(`"${probeBin}" -version 2>&1`, { timeout: 3000, encoding: 'utf8' });
    const match = out.match(/"([^"]+)"/) || out.match(/version\s+([0-9._]+)/i);
    if (!match) return null;

    const vStr = match[1];
    let major = 0;
    if (vStr.startsWith('1.')) {
      major = parseInt(vStr.split('.')[1], 10) || 8;
    } else {
      major = parseInt(vStr.split('.')[0], 10) || 0;
    }

    const is64Bit = out.includes('64-Bit') || out.includes('64-bit') || process.arch === 'x64';

    return {
      path: isWin ? javawBin : resolvedBin,
      consolePath: probeBin,
      version: vStr,
      major,
      is64Bit
    };
  } catch (_) {
    return null;
  }
}

function findJavaBinaryInDir(dir, preferJavaw = true) {
  try {
    if (!fs.existsSync(dir)) return null;
    const isWin = process.platform === 'win32';
    const targetName = isWin ? (preferJavaw ? 'javaw.exe' : 'java.exe') : 'java';
    const fallbackName = isWin ? (preferJavaw ? 'java.exe' : 'javaw.exe') : 'java';

    // Direct check: dir/bin/javaw.exe
    const directTarget = path.join(dir, 'bin', targetName);
    if (fs.existsSync(directTarget)) return directTarget;
    const directFallback = path.join(dir, 'bin', fallbackName);
    if (fs.existsSync(directFallback)) return directFallback;

    // Search 1-2 levels deep (e.g. dir/jdk-21.0.6+7-jre/bin/javaw.exe)
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subTarget = path.join(dir, entry.name, 'bin', targetName);
        if (fs.existsSync(subTarget)) return subTarget;
        const subFallback = path.join(dir, entry.name, 'bin', fallbackName);
        if (fs.existsSync(subFallback)) return subFallback;

        // One more level deep
        try {
          const subEntries = fs.readdirSync(path.join(dir, entry.name), { withFileTypes: true });
          for (const subEntry of subEntries) {
            if (subEntry.isDirectory()) {
              const deepTarget = path.join(dir, entry.name, subEntry.name, 'bin', targetName);
              if (fs.existsSync(deepTarget)) return deepTarget;
              const deepFallback = path.join(dir, entry.name, subEntry.name, 'bin', fallbackName);
              if (fs.existsSync(deepFallback)) return deepFallback;
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  return null;
}

function detectInstalledJavas(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && detectedCache && (now - lastScanTs < SCAN_CACHE_TTL_MS)) {
    return detectedCache;
  }

  const isWin = process.platform === 'win32';
  const candidates = new Set();

  // 1. Managed Launcher Runtimes
  if (fs.existsSync(RUNTIME_DIR)) {
    try {
      const runtimes = fs.readdirSync(RUNTIME_DIR, { withFileTypes: true });
      for (const r of runtimes) {
        if (r.isDirectory()) {
          const bin = findJavaBinaryInDir(path.join(RUNTIME_DIR, r.name), true);
          if (bin) candidates.add(bin);
        }
      }
    } catch (_) {}
  }

  // 2. Environment Variables
  const envHomes = [process.env.JAVA_HOME, process.env.JDK_HOME, process.env.GRAALVM_HOME];
  for (const envH of envHomes) {
    if (envH && fs.existsSync(envH)) {
      const bin = findJavaBinaryInDir(envH, true);
      if (bin) candidates.add(bin);
    }
  }

  // 3. Platform-specific scanning
  if (isWin) {
    // Check PATH via where.exe
    try {
      const whereOut = execSync('where.exe javaw.exe 2>nul || where.exe java.exe 2>nul', { encoding: 'utf8', timeout: 1500 });
      for (const line of whereOut.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) candidates.add(trimmed);
      }
    } catch (_) {}

    // Common Windows directories
    const searchRoots = [
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Java'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Eclipse Adoptium'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Microsoft'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'BellSoft'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Zulu'),
      path.join(process.env['ProgramFiles'] || 'C:\\Program Files', 'Semeru'),
      path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Java'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Eclipse Adoptium'),
      path.join(process.env['LOCALAPPDATA'] || '', 'Programs', 'Java'),
      // Mojang official Minecraft launcher bundled runtimes
      path.join(process.env['LOCALAPPDATA'] || '', 'Packages', 'Microsoft.4297127D64EC6_8wekyb3d8bbwe', 'LocalCache', 'Local', 'runtime'),
      path.join(process.env['APPDATA'] || '', '.minecraft', 'runtime'),
      path.join(process.env['APPDATA'] || '', 'PrismLauncher', 'java')
    ];

    for (const root of searchRoots) {
      if (root && fs.existsSync(root)) {
        try {
          const subDirs = fs.readdirSync(root, { withFileTypes: true });
          for (const d of subDirs) {
            if (d.isDirectory()) {
              const fullDir = path.join(root, d.name);
              const bin = findJavaBinaryInDir(fullDir, true);
              if (bin) candidates.add(bin);
            }
          }
        } catch (_) {}
      }
    }
  } else {
    // Linux / macOS
    try {
      const whichOut = execSync('which -a java 2>/dev/null', { encoding: 'utf8', timeout: 1500 });
      for (const line of whichOut.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && fs.existsSync(trimmed)) candidates.add(trimmed);
      }
    } catch (_) {}

    const unixRoots = [
      '/usr/lib/jvm',
      '/usr/java',
      path.join(os.homedir(), '.jdks'),
      path.join(os.homedir(), '.sdkman', 'candidates', 'java'),
      path.join(os.homedir(), '.minecraft', 'runtime')
    ];

    for (const root of unixRoots) {
      if (fs.existsSync(root)) {
        try {
          const subDirs = fs.readdirSync(root, { withFileTypes: true });
          for (const d of subDirs) {
            if (d.isDirectory()) {
              const fullDir = path.join(root, d.name);
              const bin = findJavaBinaryInDir(fullDir, false);
              if (bin) candidates.add(bin);
            }
          }
        } catch (_) {}
      }
    }
  }

  // Probe candidates
  const probed = [];
  for (const c of candidates) {
    const info = probeJava(c);
    if (info) {
      // Avoid duplicate console paths
      if (!probed.some(p => p.consolePath === info.consolePath)) {
        probed.push(info);
      }
    }
  }

  // Sort best first: 64-bit, internal runtime first, then highest major
  probed.sort((a, b) => {
    if (a.is64Bit !== b.is64Bit) return a.is64Bit ? -1 : 1;
    const aInternal = a.path.includes(RUNTIME_DIR);
    const bInternal = b.path.includes(RUNTIME_DIR);
    if (aInternal !== bInternal) return aInternal ? -1 : 1;
    return b.major - a.major;
  });

  detectedCache = probed;
  lastScanTs = Date.now();
  return probed;
}

function findBestCompatibleJava(requiredMajor = 21, configuredPath = null) {
  // If user configured a specific path, check if it exists and is compatible
  if (configuredPath && typeof configuredPath === 'string') {
    const isPlaceholder = configuredPath === 'java' || configuredPath === 'java.exe' || configuredPath === 'javaw.exe' || configuredPath === '/usr/bin/java';
    if (!isPlaceholder && fs.existsSync(configuredPath)) {
      const probe = probeJava(configuredPath);
      if (probe) {
        if (requiredMajor === 21 && probe.major >= 21) return probe;
        if (requiredMajor === 17 && probe.major >= 17) return probe;
        if (requiredMajor === 8 && (probe.major === 8 || probe.major <= 17)) return probe;
      }
    }
  }

  const javas = detectInstalledJavas();

  if (requiredMajor === 21) {
    // Prefer exact 21, then any >= 21
    const exact = javas.find(j => j.major === 21 && j.is64Bit);
    if (exact) return exact;
    const compatible = javas.find(j => j.major >= 21 && j.is64Bit);
    if (compatible) return compatible;
  } else if (requiredMajor === 17) {
    // Prefer exact 17, then 21+, then any >= 17
    const exact = javas.find(j => j.major === 17 && j.is64Bit);
    if (exact) return exact;
    const compatible = javas.find(j => j.major >= 17 && j.is64Bit);
    if (compatible) return compatible;
  } else if (requiredMajor === 8) {
    const exact = javas.find(j => j.major === 8);
    if (exact) return exact;
    const compatible = javas.find(j => j.major <= 17);
    if (compatible) return compatible;
  }

  // Fallback to any 64-bit Java >= requiredMajor
  const fallback = javas.find(j => j.major >= requiredMajor);
  if (fallback) return fallback;

  return null;
}

async function downloadAndInstallJava(requiredMajor = 21, onProgress = null) {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }

  const targetDir = path.join(RUNTIME_DIR, `java-${requiredMajor}`);

  // Check if targetDir already has a working Java
  const existingBin = findJavaBinaryInDir(targetDir, true);
  if (existingBin) {
    const probe = probeJava(existingBin);
    if (probe && (probe.major === requiredMajor || probe.major >= 17)) {
      console.log(`[JavaManager] Znaleziono gotowe środowisko Java ${probe.major} w ${targetDir}`);
      return probe;
    }
  }

  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  const osName = isWin ? 'windows' : (isMac ? 'mac' : 'linux');
  const archName = process.arch === 'ia32' ? 'x86' : (process.arch === 'arm64' ? 'aarch64' : 'x64');

  const url = `https://api.adoptium.net/v3/binary/latest/${requiredMajor}/ga/${osName}/${archName}/jre/hotspot/normal/eclipse`;

  console.log(`[JavaManager] Pobieranie Java ${requiredMajor} (${osName}-${archName}) z ${url}...`);

  if (typeof onProgress === 'function') {
    onProgress({
      message: `Inicjowanie pobierania Java ${requiredMajor} LTS...`,
      percentage: 0,
      downloaded: 0,
      total: 0,
      isDownloading: true
    });
  }

  const ext = isWin ? 'zip' : 'tar.gz';
  const tempArchive = path.join(RUNTIME_DIR, `temp_adoptium_${requiredMajor}_${Date.now()}.${ext}`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)' }
    });

    if (!res.ok) {
      throw new Error(`Błąd serwera Adoptium: HTTP ${res.status} ${res.statusText}`);
    }

    const totalBytes = parseInt(res.headers.get('content-length') || '0', 10);
    let downloadedBytes = 0;
    let lastReportTs = 0;

    const fileStream = fs.createWriteStream(tempArchive);

    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          fileStream.write(value);
          downloadedBytes += value.length;
          const now = Date.now();
          if (now - lastReportTs > 150 || downloadedBytes === totalBytes) {
            lastReportTs = now;
            const pct = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
            const mbDown = (downloadedBytes / 1048576).toFixed(1);
            const mbTotal = totalBytes > 0 ? (totalBytes / 1048576).toFixed(1) : '?';
            if (typeof onProgress === 'function') {
              onProgress({
                message: `Pobieranie Java ${requiredMajor} (${mbDown}/${mbTotal} MB - ${pct}%)...`,
                percentage: pct,
                downloaded: downloadedBytes,
                total: totalBytes,
                isDownloading: true
              });
            }
          }
        }
      }
      fileStream.end();
      await new Promise((resolve, reject) => {
        fileStream.on('finish', resolve);
        fileStream.on('error', reject);
      });
    } else {
      // Fallback for arrayBuffer
      const buf = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(tempArchive, buf);
    }

    if (typeof onProgress === 'function') {
      onProgress({
        message: `Wypakowywanie środowiska Java ${requiredMajor}...`,
        percentage: 99,
        downloaded: totalBytes,
        total: totalBytes,
        isDownloading: true
      });
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (isWin) {
      const zip = new AdmZip(tempArchive);
      zip.extractAllTo(targetDir, true);
    } else {
      execSync(`tar -xzf "${tempArchive}" -C "${targetDir}"`, { timeout: 60000 });
      // Set permissions
      try {
        execSync(`chmod -R 755 "${targetDir}"`, { timeout: 10000 });
      } catch (_) {}
    }

    try { fs.unlinkSync(tempArchive); } catch (_) {}

    const installedBin = findJavaBinaryInDir(targetDir, true);
    if (!installedBin) {
      throw new Error(`Nie udało się odnaleźć pliku wykonywalnego Java w wypakowanym katalogu ${targetDir}`);
    }

    const probed = probeJava(installedBin);
    if (!probed) {
      throw new Error(`Pobrana Java (${installedBin}) nie przeszła testu uruchomieniowego.`);
    }

    console.log(`[JavaManager] Sukces! Zainstalowano Java ${probed.version} (${probed.path})`);
    detectedCache = null; // Invalidate cache so it includes new runtime

    if (typeof onProgress === 'function') {
      onProgress({
        message: `Środowisko Java ${requiredMajor} gotowe!`,
        percentage: 100,
        downloaded: totalBytes,
        total: totalBytes,
        isDownloading: false
      });
    }

    return probed;
  } catch (err) {
    try { if (fs.existsSync(tempArchive)) fs.unlinkSync(tempArchive); } catch (_) {}
    console.error(`[JavaManager] Błąd instalacji Java ${requiredMajor}:`, err);
    throw err;
  }
}

async function ensureJava(requiredMajor = 21, onProgress = null, configuredPath = null) {
  const existing = findBestCompatibleJava(requiredMajor, configuredPath);
  if (existing) {
    return existing.path;
  }

  // Not found on system: automatically download!
  const installed = await downloadAndInstallJava(requiredMajor, onProgress);
  return installed.path;
}

function resolveConsoleJava(requiredMajor = 21) {
  const isWin = process.platform === 'win32';
  const found = findBestCompatibleJava(requiredMajor);
  if (found && found.consolePath && fs.existsSync(found.consolePath)) {
    return found.consolePath;
  }
  return isWin ? 'java.exe' : (found?.path || '/usr/bin/java');
}

function resolveJavaSync(configuredPath = null, requiredMajor = 21) {
  const isWin = process.platform === 'win32';
  const found = findBestCompatibleJava(requiredMajor, configuredPath);
  if (found && found.path && fs.existsSync(found.path)) {
    return found.path;
  }
  return isWin ? 'javaw.exe' : (configuredPath || 'java');
}

module.exports = {
  getRequiredJavaMajor,
  probeJava,
  findJavaBinaryInDir,
  detectInstalledJavas,
  findBestCompatibleJava,
  downloadAndInstallJava,
  ensureJava,
  resolveConsoleJava,
  resolveJavaSync
};
