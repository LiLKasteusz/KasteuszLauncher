const { spawn, execFile, execFileSync } = require('child_process');
const fs = require('fs');
const net = require('net');
const path = require('path');
const os = require('os');
const { app, shell } = require('electron');
const config = require('./config');

const SERVERS_ROOT = path.join(
  os.homedir(),
  '.kasteuszlauncher',
  'servers'
);

const LEGACY_SERVER_DIR = path.join(
  os.homedir(),
  '.kasteuszlauncher',
  'server'
);

const CONFIG_FILE = path.join(
  os.homedir(),
  '.kasteuszlauncher',
  'server_config.json'
);

const TUNNEL_KEY_PATH = path.join(
  os.homedir(),
  '.kasteuszlauncher',
  'tunnel_id_ed25519'
);

const UA_HEADERS = {
  'User-Agent': 'KasteuszLauncher/2.5.0 (https://szkolnesmp.com.pl)'
};

let serverProcess = null;
let isStarting = false;
let serverStartedAt = null;
let serverReady = false;
let metricsInterval = null;
const onlinePlayersSet = new Set();

let tunnelProcess = null;
let tunnelStarting = false;
let tunnelDesired = false;
let tunnelPublicAddress = null;
let tunnelTargetPort = 25565;
let tunnelReconnectTimer = null;

let lastSysCpuSnapshot = null;
let lastProcCpuSample = { pid: null, cpuSec: 0, ts: 0, pct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
let cachedSlp = { port: null, ts: 0, data: null };
let cachedDisk = { dir: null, ts: 0, totalMb: 0, worldMb: 0, pending: false };

function readSysCpuTotals() {
  const cpus = os.cpus() || [];
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    const t = cpu.times;
    const sum = t.user + t.nice + t.sys + t.irq + t.idle;
    idle += t.idle;
    total += sum;
  }
  return { idle, total, cores: Math.max(1, cpus.length), model: cpus[0]?.model?.trim() || 'CPU' };
}

lastSysCpuSnapshot = { ...readSysCpuTotals(), pct: 0, ts: Date.now() };

function sampleSystemCpu() {
  const now = Date.now();
  const cur = readSysCpuTotals();
  if (!lastSysCpuSnapshot || (now - lastSysCpuSnapshot.ts) < 200) {
    return {
      pct: lastSysCpuSnapshot?.pct || 0,
      cores: cur.cores,
      model: cur.model
    };
  }
  const dTotal = cur.total - lastSysCpuSnapshot.total;
  const dIdle = cur.idle - lastSysCpuSnapshot.idle;
  const pct = dTotal > 0 ? Math.max(0, Math.min(100, ((dTotal - dIdle) / dTotal) * 100)) : 0;
  const rounded = Math.round(pct * 10) / 10;
  lastSysCpuSnapshot = { ...cur, pct: rounded, ts: now };
  return { pct: rounded, cores: cur.cores, model: cur.model };
}

function getSystemMemoryInfo() {
  const totalBytes = os.totalmem();
  let availBytes = os.freemem();
  if (process.platform === 'linux') {
    try {
      const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
      const m = meminfo.match(/^MemAvailable:\s+(\d+)\s+kB/m);
      if (m) availBytes = parseInt(m[1], 10) * 1024;
    } catch (_) {}
  }
  const totalMb = Math.round(totalBytes / (1024 * 1024));
  const freeMb = Math.round(availBytes / (1024 * 1024));
  const usedMb = Math.max(0, totalMb - freeMb);
  const pct = totalMb > 0 ? Math.round((usedMb / totalMb) * 1000) / 10 : 0;
  return { totalMb, usedMb, freeMb, pct };
}

function execFileAsync(cmd, args, timeout = 1500) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => {
      if (err) return reject(err);
      resolve(String(stdout || ''));
    });
  });
}

async function sampleServerProcessUsage(pid, numCores) {
  if (!pid) {
    lastProcCpuSample = { pid: null, cpuSec: 0, ts: 0, pct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
    return { cpuPct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
  }

  const now = Date.now();
  const cores = Math.max(1, numCores || os.cpus().length || 1);

  if (process.platform === 'linux') {
    try {
      const statRaw = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
      const statusRaw = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
      const closeParen = statRaw.lastIndexOf(')');
      const fields = statRaw.slice(closeParen + 2).trim().split(/\s+/);
      const utimeTicks = parseInt(fields[11] || '0', 10);
      const stimeTicks = parseInt(fields[12] || '0', 10);
      const threads = parseInt(fields[17] || '1', 10) || 1;
      const cpuSec = (utimeTicks + stimeTicks) / 100;

      const rssMatch = statusRaw.match(/^VmRSS:\s+(\d+)\s+kB/m);
      const rssMb = rssMatch ? Math.round((parseInt(rssMatch[1], 10) / 1024) * 10) / 10 : 0;

      if (lastProcCpuSample.pid === pid && lastProcCpuSample.ts > 0) {
        const dtSec = (now - lastProcCpuSample.ts) / 1000;
        if (dtSec >= 0.2) {
          const dCpu = Math.max(0, cpuSec - lastProcCpuSample.cpuSec);
          const singleCorePct = Math.round(((dCpu / dtSec) * 100) * 10) / 10;
          const pct = Math.min(100, Math.round((singleCorePct / cores) * 10) / 10);
          lastProcCpuSample = { pid, cpuSec, ts: now, pct, singleCorePct, rssMb, threads };
        } else {
          lastProcCpuSample.rssMb = rssMb;
          lastProcCpuSample.threads = threads;
        }
      } else {
        lastProcCpuSample = { pid, cpuSec, ts: now, pct: 0, singleCorePct: 0, rssMb, threads };
      }

      return {
        cpuPct: lastProcCpuSample.pct,
        singleCorePct: lastProcCpuSample.singleCorePct,
        rssMb: lastProcCpuSample.rssMb,
        threads: lastProcCpuSample.threads
      };
    } catch (_) {
      return { cpuPct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
    }
  }

  if (lastProcCpuSample.pid === pid && (now - lastProcCpuSample.ts) < 1200) {
    return {
      cpuPct: lastProcCpuSample.pct,
      singleCorePct: lastProcCpuSample.singleCorePct,
      rssMb: lastProcCpuSample.rssMb,
      threads: lastProcCpuSample.threads
    };
  }

  if (process.platform === 'win32') {
    try {
      const out = await execFileAsync('powershell', [
        '-NoProfile',
        '-Command',
        `$p = Get-Process -Id ${Number(pid)} -ErrorAction Stop; "$($p.CPU)|$($p.WorkingSet64)|$($p.Threads.Count)"`
      ]);
      const [cpuStr, wsStr, thStr] = out.trim().split('|');
      const cpuSec = parseFloat(cpuStr || '0') || 0;
      const rssMb = Math.round(((parseInt(wsStr || '0', 10) || 0) / (1024 * 1024)) * 10) / 10;
      const threads = parseInt(thStr || '1', 10) || 1;
      let pct = lastProcCpuSample.pid === pid ? lastProcCpuSample.pct : 0;
      let singleCorePct = lastProcCpuSample.pid === pid ? lastProcCpuSample.singleCorePct : 0;
      if (lastProcCpuSample.pid === pid && lastProcCpuSample.ts > 0) {
        const dtSec = (now - lastProcCpuSample.ts) / 1000;
        if (dtSec >= 0.25) {
          const dCpu = Math.max(0, cpuSec - lastProcCpuSample.cpuSec);
          singleCorePct = Math.round(((dCpu / dtSec) * 100) * 10) / 10;
          pct = Math.min(100, Math.round((singleCorePct / cores) * 10) / 10);
        }
      }
      lastProcCpuSample = { pid, cpuSec, ts: now, pct, singleCorePct, rssMb, threads };
      return { cpuPct: pct, singleCorePct, rssMb, threads };
    } catch (_) {
      return { cpuPct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
    }
  }

  try {
    const out = await execFileAsync('ps', ['-p', String(pid), '-o', '%cpu=,rss=']);
    const parts = out.trim().split(/\s+/);
    const singleCorePct = Math.round((parseFloat(parts[0] || '0') || 0) * 10) / 10;
    const pct = Math.min(100, Math.round((singleCorePct / cores) * 10) / 10);
    const rssMb = Math.round(((parseInt(parts[1] || '0', 10) || 0) / 1024) * 10) / 10;
    lastProcCpuSample = { pid, cpuSec: 0, ts: now, pct, singleCorePct, rssMb, threads: 0 };
    return { cpuPct: pct, singleCorePct, rssMb, threads: 0 };
  } catch (_) {
    return { cpuPct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };
  }
}

async function computeDirSizeBytes(dirPath, budget = { left: 6000 }) {
  if (budget.left <= 0) return 0;
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (_) {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    if (budget.left-- <= 0) break;
    if (entry.isSymbolicLink()) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await computeDirSizeBytes(full, budget);
    } else if (entry.isFile()) {
      try {
        const st = await fs.promises.stat(full);
        total += st.size;
      } catch (_) {}
    }
  }
  return total;
}

function triggerServerDiskRefresh(srvDir) {
  const now = Date.now();
  if (cachedDisk.pending) return;
  if (cachedDisk.dir === srvDir && (now - cachedDisk.ts) < 12000) return;

  cachedDisk.pending = true;
  (async () => {
    try {
      const totalBytes = await computeDirSizeBytes(srvDir, { left: 7000 });
      let worldBytes = 0;
      for (const wName of ['world', 'world_nether', 'world_the_end']) {
        worldBytes += await computeDirSizeBytes(path.join(srvDir, wName), { left: 4000 });
      }
      cachedDisk = {
        dir: srvDir,
        ts: Date.now(),
        totalMb: Math.round((totalBytes / (1024 * 1024)) * 10) / 10,
        worldMb: Math.round((worldBytes / (1024 * 1024)) * 10) / 10,
        pending: false
      };
    } catch (_) {
      cachedDisk.pending = false;
    }
  })();
}

function writeVarInt(value) {
  const bytes = [];
  let v = value >>> 0;
  while (true) {
    if ((v & ~0x7F) === 0) {
      bytes.push(v);
      break;
    }
    bytes.push((v & 0x7F) | 0x80);
    v >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarIntFromBuffer(buf, offset = 0) {
  let numRead = 0;
  let result = 0;
  while (true) {
    if (offset + numRead >= buf.length) return null;
    const byte = buf[offset + numRead];
    result |= (byte & 0x7F) << (7 * numRead);
    numRead++;
    if (numRead > 5) return null;
    if ((byte & 0x80) === 0) break;
  }
  return { value: result, length: numRead };
}

function pingLocalMinecraftServer(port, timeoutMs = 650) {
  const now = Date.now();
  if (cachedSlp.port === port && (now - cachedSlp.ts) < 2400) {
    return Promise.resolve(cachedSlp.data);
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      cachedSlp = { port, ts: Date.now(), data: val };
      try { socket.destroy(); } catch (_) {}
      resolve(val);
    };

    const t0 = Date.now();
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(port) });
    socket.setNoDelay(true);
    socket.setTimeout(timeoutMs);

    const chunks = [];
    socket.on('connect', () => {
      const hostBuf = Buffer.from('127.0.0.1', 'utf8');
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(Number(port) & 0xFFFF, 0);
      const handshakeBody = Buffer.concat([
        writeVarInt(0x00),
        writeVarInt(767),
        writeVarInt(hostBuf.length),
        hostBuf,
        portBuf,
        writeVarInt(1)
      ]);
      const handshakePkt = Buffer.concat([writeVarInt(handshakeBody.length), handshakeBody]);
      const statusReqPkt = Buffer.from([0x01, 0x00]);
      socket.write(Buffer.concat([handshakePkt, statusReqPkt]));
    });

    socket.on('data', (chunk) => {
      chunks.push(chunk);
      const buf = Buffer.concat(chunks);
      const pktLen = readVarIntFromBuffer(buf, 0);
      if (!pktLen) return;
      if (buf.length < pktLen.length + pktLen.value) return;
      const pktId = readVarIntFromBuffer(buf, pktLen.length);
      if (!pktId || pktId.value !== 0x00) return finish(null);
      const strLen = readVarIntFromBuffer(buf, pktLen.length + pktId.length);
      if (!strLen) return;
      const jsonStart = pktLen.length + pktId.length + strLen.length;
      if (buf.length < jsonStart + strLen.value) return;
      try {
        const jsonStr = buf.slice(jsonStart, jsonStart + strLen.value).toString('utf8');
        const parsed = JSON.parse(jsonStr);
        const sampleNames = Array.isArray(parsed?.players?.sample)
          ? parsed.players.sample
            .map(p => (p?.name || '').replace(/§[0-9a-fk-or]/gi, '').trim())
            .filter(Boolean)
          : [];
        finish({
          online: Number(parsed?.players?.online ?? 0),
          max: Number(parsed?.players?.max ?? 20),
          sample: sampleNames,
          versionName: parsed?.version?.name || null,
          pingMs: Math.max(1, Date.now() - t0)
        });
      } catch (_) {
        finish(null);
      }
    });

    socket.on('timeout', () => finish(null));
    socket.on('error', () => finish(null));
  });
}

function trackPlayerLineFromStdout(rawLine) {
  const clean = String(rawLine || '').replace(/\x1B\[[0-9;]*[A-Za-z]/g, '');
  const joinMatch = clean.match(/:\s+([A-Za-z0-9_]{2,16})\s+joined the game\b/i)
    || clean.match(/:\s+([A-Za-z0-9_]{2,16})\[\/[^\]]+\]\s+logged in with entity id\b/i);
  if (joinMatch) {
    onlinePlayersSet.add(joinMatch[1]);
    cachedSlp.ts = 0;
    return;
  }
  const leaveMatch = clean.match(/:\s+([A-Za-z0-9_]{2,16})\s+left the game\b/i)
    || clean.match(/:\s+([A-Za-z0-9_]{2,16})\s+lost connection:/i);
  if (leaveMatch) {
    onlinePlayersSet.delete(leaveMatch[1]);
    cachedSlp.ts = 0;
  }
}

async function getServerMetrics() {
  const cfg = getServerConfig();
  const srvDir = getInstanceServerDir(cfg);
  triggerServerDiskRefresh(srvDir);

  const sysCpu = sampleSystemCpu();
  const sysMem = getSystemMemoryInfo();
  const running = !!serverProcess;
  const pid = serverProcess?.pid || null;

  const procUsage = running
    ? await sampleServerProcessUsage(pid, sysCpu.cores)
    : { cpuPct: 0, singleCorePct: 0, rssMb: 0, threads: 0 };

  const allocatedMb = (cfg.ram || 4) * 1024;
  const ramPct = allocatedMb > 0
    ? Math.min(100, Math.round((procUsage.rssMb / allocatedMb) * 1000) / 10)
    : 0;

  const tunnelActive = !!(tunnelProcess && tunnelPublicAddress);
  const checkPort = (!running && tunnelActive) ? (tunnelTargetPort || cfg.port || 25565) : (cfg.port || 25565);
  let slp = null;
  if ((running && serverReady) || tunnelActive) {
    slp = await pingLocalMinecraftServer(checkPort);
  }

  const mergedNames = new Set([...onlinePlayersSet]);
  if (Array.isArray(slp?.sample)) {
    for (const n of slp.sample) mergedNames.add(n);
  }
  const playerList = Array.from(mergedNames);
  const onlineCount = slp ? slp.online : (running ? onlinePlayersSet.size : 0);
  const maxPlayers = slp?.max || cfg.maxPlayers || 12;

  const uptimeSec = (running && serverStartedAt)
    ? Math.max(0, Math.floor((Date.now() - serverStartedAt) / 1000))
    : 0;

  return {
    running,
    starting: isStarting && !serverReady,
    ready: running && serverReady,
    pid,
    uptimeSec,
    startedAt: running ? serverStartedAt : null,
    cpu: {
      processPct: procUsage.cpuPct,
      singleCorePct: procUsage.singleCorePct,
      systemPct: sysCpu.pct,
      cores: sysCpu.cores,
      threads: procUsage.threads
    },
    ram: {
      usedMb: procUsage.rssMb,
      allocatedMb,
      pct: ramPct,
      systemTotalMb: sysMem.totalMb,
      systemUsedMb: sysMem.usedMb,
      systemFreeMb: sysMem.freeMb,
      systemPct: sysMem.pct
    },
    players: {
      online: onlineCount,
      max: maxPlayers,
      list: playerList,
      pingMs: slp?.pingMs || null,
      lanOnly: !running && !!slp
    },
    disk: {
      totalMb: cachedDisk.dir === srvDir ? cachedDisk.totalMb : 0,
      worldMb: cachedDisk.dir === srvDir ? cachedDisk.worldMb : 0
    },
    tunnelActive
  };
}

function stopMetricsLoop() {
  if (metricsInterval) {
    clearInterval(metricsInterval);
    metricsInterval = null;
  }
}

function startMetricsLoop(window) {
  stopMetricsLoop();
  const emitOnce = async () => {
    if (!window || window.isDestroyed?.()) return;
    try {
      const m = await getServerMetrics();
      window.webContents.send('server:metrics', m);
    } catch (_) {}
  };
  emitOnce();
  metricsInterval = setInterval(emitOnce, 1500);
}

function getServerConfig() {
  const defaults = {
    engine: 'paper',
    version: '1.21.11',
    ram: 4,
    port: 25565,
    onlineMode: false,
    autoTunnel: true,
    motd: 'Serwer Kasteusz Launcher',
    gamemode: 'survival',
    difficulty: 'normal',
    pvp: true,
    maxPlayers: 12
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaults, ...data };
    }
  } catch (_) {}
  return defaults;
}

function saveServerConfig(cfg) {
  try {
    const current = getServerConfig();
    const updated = { ...current, ...cfg };
    const dir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (e) {
    console.error('Błąd zapisu server_config:', e);
    return cfg;
  }
}

function getInstanceServerDir(cfg = null) {
  const c = cfg || getServerConfig();
  const safeEngine = String(c.engine || 'paper').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const safeVer = String(c.version || '1.21.11').replace(/[^a-zA-Z0-9._-]/g, '');

  if (safeEngine === 'vanilla' && safeVer === '1.21.11' && fs.existsSync(path.join(LEGACY_SERVER_DIR, 'world'))) {
    return LEGACY_SERVER_DIR;
  }

  return path.join(SERVERS_ROOT, `${safeEngine}-${safeVer}`);
}

function openServerFolder() {
  const dir = getInstanceServerDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  shell.openPath(dir);
  return { success: true, path: dir };
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function resolveServerJava(mcVersion) {
  try {
    const javaManager = require('./javaManager');
    if (typeof javaManager.resolveConsoleJava === 'function') {
      return javaManager.resolveConsoleJava(javaManager.getRequiredJavaMajor(mcVersion));
    }
  } catch (_) {}
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

async function resolveServerDownloadInfo(engine, version) {
  const eng = String(engine || 'paper').toLowerCase();
  const ver = String(version || '1.21.11').trim();

  if (eng === 'paper') {
    const res = await fetch(`https://fill.papermc.io/v3/projects/paper/versions/${encodeURIComponent(ver)}/builds/latest`, {
      headers: UA_HEADERS
    });
    if (!res.ok) {
      throw new Error(`Paper nie wspiera jeszcze wersji ${ver} (HTTP ${res.status}). Wybierz inną wersję lub silnik Fabric / Vanilla.`);
    }
    const data = await res.json();
    const dl = data?.downloads?.['server:default'];
    if (!dl || !dl.url) {
      throw new Error(`Brak pliku Paper dla wersji ${ver}.`);
    }
    return {
      url: dl.url,
      size: dl.size || 0,
      jarName: `paper-${ver}.jar`,
      label: `Paper ${ver} (build #${data.id || 'latest'})`
    };
  }

  if (eng === 'purpur') {
    return {
      url: `https://api.purpurmc.org/v2/purpur/${encodeURIComponent(ver)}/latest/download`,
      size: 0,
      jarName: `purpur-${ver}.jar`,
      label: `Purpur ${ver}`
    };
  }

  if (eng === 'fabric') {
    const loaderRes = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(ver)}`, {
      headers: UA_HEADERS
    });
    if (!loaderRes.ok) {
      throw new Error(`Fabric Server nie obsługuje wersji ${ver}.`);
    }
    const loaders = await loaderRes.json();
    if (!Array.isArray(loaders) || loaders.length === 0) {
      throw new Error(`Brak wersji Fabric Loader dla Minecraft ${ver}.`);
    }
    const loaderVer = loaders[0]?.loader?.version;

    const instRes = await fetch('https://meta.fabricmc.net/v2/versions/installer', { headers: UA_HEADERS });
    const installers = instRes.ok ? await instRes.json() : [];
    const installerVer = installers.find(i => i.stable)?.version || installers[0]?.version || '1.1.2';

    return {
      url: `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(ver)}/${encodeURIComponent(loaderVer)}/${encodeURIComponent(installerVer)}/server/jar`,
      size: 0,
      jarName: `fabric-server-${ver}.jar`,
      label: `Fabric Server ${ver} (Loader ${loaderVer})`
    };
  }

  // Default: Official Mojang Vanilla Server
  const manifestRes = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
    headers: UA_HEADERS
  });
  if (!manifestRes.ok) {
    throw new Error('Nie udało się pobrać listy wersji z serwerów Mojang.');
  }
  const manifest = await manifestRes.json();
  const verEntry = (manifest.versions || []).find(v => v.id === ver);
  if (!verEntry || !verEntry.url) {
    throw new Error(`Nie znaleziono oficjalnego serwera Vanilla dla wersji ${ver}.`);
  }

  const verRes = await fetch(verEntry.url, { headers: UA_HEADERS });
  if (!verRes.ok) {
    throw new Error(`Błąd pobierania metadanych Mojang dla ${ver}.`);
  }
  const verJson = await verRes.json();
  const srvDl = verJson?.downloads?.server;
  if (!srvDl || !srvDl.url) {
    throw new Error(`Wersja ${ver} nie posiada oficjalnego pliku server.jar od Mojang.`);
  }

  return {
    url: srvDl.url,
    size: srvDl.size || 0,
    jarName: `vanilla-${ver}.jar`,
    label: `Vanilla ${ver}`
  };
}

async function ensureServerJar(window, cfg) {
  const srvDir = getInstanceServerDir(cfg);
  if (!fs.existsSync(srvDir)) {
    fs.mkdirSync(srvDir, { recursive: true });
  }

  const dlInfo = await resolveServerDownloadInfo(cfg.engine, cfg.version);
  const jarPath = path.join(srvDir, dlInfo.jarName);

  // Backward compatibility if legacy server.jar exists
  if (cfg.engine === 'vanilla' && cfg.version === '1.21.11') {
    const legacyJar = path.join(srvDir, 'server.jar');
    if (fs.existsSync(legacyJar) && fs.statSync(legacyJar).size > 5_000_000) {
      return { jarPath: legacyJar, srvDir, label: dlInfo.label };
    }
  }

  if (fs.existsSync(jarPath) && fs.statSync(jarPath).size > 2_000_000) {
    return { jarPath, srvDir, label: dlInfo.label };
  }

  window?.webContents.send('server:status', {
    status: 'downloading',
    message: `Pobieranie silnika ${dlInfo.label}...`
  });

  const res = await fetch(dlInfo.url, { headers: UA_HEADERS });
  if (!res.ok) {
    throw new Error(`Błąd pobierania ${dlInfo.label}: HTTP ${res.status}`);
  }

  const total = parseInt(res.headers.get('content-length') || String(dlInfo.size || 50_000_000), 10);
  let downloaded = 0;

  if (res.body && typeof res.body.getReader === 'function') {
    const reader = res.body.getReader();
    const chunks = [];
    let lastEmit = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        chunks.push(value);
        downloaded += value.length;
        const now = Date.now();
        if (now - lastEmit > 150) {
          lastEmit = now;
          const pct = total > 0 ? Math.min(99, Math.round((downloaded / total) * 100)) : 50;
          window?.webContents.send('server:download-progress', { pct, downloaded, total });
        }
      }
    }
    fs.writeFileSync(jarPath, Buffer.concat(chunks));
  } else {
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(jarPath, buf);
  }

  window?.webContents.send('server:download-progress', { pct: 100, downloaded: total, total });
  return { jarPath, srvDir, label: dlInfo.label };
}

function applyServerProperties(srvDir, cfg) {
  const eulaPath = path.join(srvDir, 'eula.txt');
  fs.writeFileSync(eulaPath, '# EULA zaakceptowana przez Kasteusz Launcher\neula=true\n', 'utf8');

  const propsPath = path.join(srvDir, 'server.properties');
  const existingMap = new Map();
  if (fs.existsSync(propsPath)) {
    const lines = fs.readFileSync(propsPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        existingMap.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
      }
    }
  }

  existingMap.set('server-port', String(cfg.port || 25565));
  existingMap.set('online-mode', cfg.onlineMode ? 'true' : 'false');
  existingMap.set('motd', cfg.motd || `Serwer Kasteusz Launcher (${cfg.version || '1.21.11'})`);
  existingMap.set('difficulty', cfg.difficulty || 'normal');
  existingMap.set('gamemode', cfg.gamemode || 'survival');
  existingMap.set('pvp', cfg.pvp !== false ? 'true' : 'false');
  existingMap.set('max-players', String(cfg.maxPlayers || 12));
  if (!existingMap.has('enable-command-block')) existingMap.set('enable-command-block', 'true');
  if (!existingMap.has('spawn-protection')) existingMap.set('spawn-protection', '0');
  if (!existingMap.has('view-distance')) existingMap.set('view-distance', '10');
  if (!existingMap.has('simulation-distance')) existingMap.set('simulation-distance', '8');

  const outLines = ['# Plik konfiguracyjny Kasteusz Launcher'];
  for (const [k, v] of existingMap.entries()) {
    outLines.push(`${k}=${v}`);
  }
  fs.writeFileSync(propsPath, outLines.join('\n') + '\n', 'utf8');
}

function ensureTunnelSshKey() {
  const dir = path.dirname(TUNNEL_KEY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(TUNNEL_KEY_PATH)) {
    execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', TUNNEL_KEY_PATH, '-q']);
    try { fs.chmodSync(TUNNEL_KEY_PATH, 0o600); } catch (_) {}
  }
  return TUNNEL_KEY_PATH;
}

function emitTunnelState(window, extra = {}) {
  try {
    if (window && !window.isDestroyed()) {
      window.webContents.send('server:tunnel-status', {
        active: !!(tunnelProcess && tunnelPublicAddress),
        starting: tunnelStarting,
        publicAddress: tunnelPublicAddress,
        targetPort: tunnelTargetPort,
        ...extra
      });
    }
  } catch (_) {}
}

async function startPublicTunnel(window, customPort = null) {
  const cfg = getServerConfig();
  const port = parseInt(customPort || cfg.port || 25565, 10) || 25565;

  if (tunnelProcess && tunnelPublicAddress && tunnelTargetPort === port) {
    return {
      success: true,
      active: true,
      publicAddress: tunnelPublicAddress,
      targetPort: port
    };
  }

  stopPublicTunnel(window, false);
  tunnelDesired = true;
  tunnelTargetPort = port;
  tunnelStarting = true;
  tunnelPublicAddress = null;
  emitTunnelState(window, { message: `Otwieranie tunelu dla portu ${port}...` });

  let keyPath;
  try {
    keyPath = ensureTunnelSshKey();
  } catch (err) {
    tunnelStarting = false;
    tunnelDesired = false;
    emitTunnelState(window, { error: 'Brak narzędzia ssh-keygen w systemie.' });
    throw new Error('Nie znaleziono klienta OpenSSH (ssh / ssh-keygen) wymaganego do tunelu.');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const sshArgs = [
      '-p', '443',
      '-i', keyPath,
      '-o', 'IdentitiesOnly=yes',
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-o', `UserKnownHostsFile=${process.platform === 'win32' ? 'NUL' : '/dev/null'}`,
      '-o', 'ServerAliveInterval=25',
      '-o', 'ServerAliveCountMax=3',
      '-o', 'ExitOnForwardFailure=yes',
      '-T',
      `-R0:127.0.0.1:${port}`,
      'tcp@eu.a.pinggy.io'
    ];

    const proc = spawn('ssh', sshArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    tunnelProcess = proc;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        stopPublicTunnel(window, false);
        reject(new Error('Przekroczono czas łączenia z serwerem tunelowym EU. Spróbuj ponownie.'));
      }
    }, 12000);

    const handleChunk = (chunk) => {
      const raw = chunk.toString();
      const text = raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
      const match = text.match(/tcp:\/\/([a-zA-Z0-9.\-]+:\d+)/i)
        || text.match(/([a-zA-Z0-9.\-]+pinggy[a-zA-Z0-9.\-]*:\d+)/i);
      if (match && match[1] && !tunnelPublicAddress) {
        tunnelPublicAddress = match[1];
        tunnelStarting = false;
        clearTimeout(timeout);
        emitTunnelState(window);
        try {
          window?.webContents.send(
            'server:log',
            `[TUNEL PUBLICZNY] Gotowe! Znajomi spoza Twojej sieci mogą wejść bez Hamachi pod adresem: ${tunnelPublicAddress}`
          );
        } catch (_) {}
        if (!settled) {
          settled = true;
          resolve({
            success: true,
            active: true,
            publicAddress: tunnelPublicAddress,
            targetPort: port
          });
        }
      }
    };

    proc.stdout.on('data', handleChunk);
    proc.stderr.on('data', handleChunk);

    proc.on('error', (err) => {
      clearTimeout(timeout);
      if (tunnelProcess === proc) {
        tunnelProcess = null;
        tunnelStarting = false;
        tunnelPublicAddress = null;
      }
      emitTunnelState(window, { error: err.message });
      if (!settled) {
        settled = true;
        reject(new Error(`Błąd uruchamiania tunelu SSH: ${err.message}`));
      }
    });

    proc.on('close', () => {
      clearTimeout(timeout);
      const wasActive = !!tunnelPublicAddress;
      if (tunnelProcess === proc) {
        tunnelProcess = null;
        tunnelStarting = false;
        tunnelPublicAddress = null;
      }
      emitTunnelState(window);

      if (!settled) {
        settled = true;
        reject(new Error('Połączenie tunelu zostało zamknięte przed przydzieleniem adresu.'));
        return;
      }

      if (tunnelDesired && wasActive) {
        try {
          window?.webContents.send('server:log', '[TUNEL PUBLICZNY] Odświeżanie sesji tunelu...');
        } catch (_) {}
        tunnelReconnectTimer = setTimeout(() => {
          if (tunnelDesired) {
            startPublicTunnel(window, tunnelTargetPort).catch(() => {});
          }
        }, 2000);
      }
    });
  });
}

function stopPublicTunnel(window, logMessage = true) {
  tunnelDesired = false;
  tunnelStarting = false;
  tunnelPublicAddress = null;
  if (tunnelReconnectTimer) {
    clearTimeout(tunnelReconnectTimer);
    tunnelReconnectTimer = null;
  }
  if (tunnelProcess) {
    const p = tunnelProcess;
    tunnelProcess = null;
    try { p.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      try { p.kill('SIGKILL'); } catch (_) {}
    }, 1000);
    if (logMessage) {
      try {
        window?.webContents.send('server:log', '[TUNEL PUBLICZNY] Zamknięto publiczny tunel.');
      } catch (_) {}
    }
  }
  emitTunnelState(window);
  return { success: true, active: false };
}

async function startServer(window) {
  if (serverProcess) {
    throw new Error('Serwer jest już uruchomiony!');
  }
  if (isStarting) {
    throw new Error('Serwer jest w trakcie uruchamiania...');
  }

  isStarting = true;
  const cfg = getServerConfig();

  try {
    window?.webContents.send('server:status', {
      status: 'preparing',
      message: `Przygotowywanie serwera ${String(cfg.engine || 'paper').toUpperCase()} ${cfg.version}...`
    });

    const { jarPath, srvDir, label } = await ensureServerJar(window, cfg);
    applyServerProperties(srvDir, cfg);

    const localIp = getLocalIp();
    const ram = cfg.ram || 4;
    const minRam = Math.min(ram, 2);
    const javaBin = resolveServerJava(cfg.version);
    const javaArgs = [
      `-Xmx${ram}G`,
      `-Xms${minRam}G`,
      '-XX:+UseG1GC',
      '-XX:+ParallelRefProcEnabled',
      '-XX:MaxGCPauseMillis=200',
      '-jar',
      jarPath,
      'nogui'
    ];

    window?.webContents.send('server:status', {
      status: 'starting',
      message: `Uruchamianie ${label} (${ram} GB RAM)...`
    });
    window?.webContents.send('server:log', `[Kasteusz Host] Silnik: ${label} • Katalog: ${srvDir}`);

    serverStartedAt = Date.now();
    serverReady = false;
    onlinePlayersSet.clear();
    cachedSlp = { port: null, ts: 0, data: null };

    serverProcess = spawn(javaBin, javaArgs, {
      cwd: srvDir,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    startMetricsLoop(window);

    if (cfg.autoTunnel !== false) {
      startPublicTunnel(window, cfg.port || 25565).catch((tErr) => {
        window?.webContents.send('server:log', `[TUNEL] Nie udało się otworzyć tunelu automatycznie: ${tErr.message}`);
      });
    }

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        window?.webContents.send('server:log', line.trim());
        trackPlayerLineFromStdout(line);
        if (line.includes('Done (') && line.includes('For help, type "help"')) {
          isStarting = false;
          serverReady = true;
          cachedSlp.ts = 0;
          window?.webContents.send('server:status', {
            status: 'running',
            message: `Serwer ${label} działa!`,
            ip: localIp,
            port: cfg.port || 25565,
            engine: cfg.engine,
            version: cfg.version
          });
          emitTunnelState(window);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) {
        window?.webContents.send('server:log', `[STDERR] ${text}`);
      }
    });

    serverProcess.on('close', (code) => {
      serverProcess = null;
      isStarting = false;
      serverStartedAt = null;
      serverReady = false;
      onlinePlayersSet.clear();
      cachedSlp = { port: null, ts: 0, data: null };
      stopMetricsLoop();
      if (tunnelProcess && tunnelTargetPort === (cfg.port || 25565)) {
        stopPublicTunnel(window, false);
      }
      window?.webContents.send('server:status', { status: 'stopped', code });
      window?.webContents.send('server:log', `[Kasteusz Host] Serwer został zatrzymany (kod: ${code}).`);
      getServerMetrics().then((m) => {
        if (window && !window.isDestroyed?.()) {
          window.webContents.send('server:metrics', m);
        }
      }).catch(() => {});
    });

    return { success: true, localIp, port: cfg.port, engine: cfg.engine, version: cfg.version };
  } catch (err) {
    isStarting = false;
    serverProcess = null;
    serverStartedAt = null;
    serverReady = false;
    stopMetricsLoop();
    window?.webContents.send('server:status', { status: 'error', message: err.message });
    throw err;
  }
}

function stopServer(window = null) {
  stopPublicTunnel(window, false);
  if (!serverProcess) return { success: true, message: 'Serwer nie jest uruchomiony.' };
  try {
    serverProcess.stdin.write('stop\n');
    setTimeout(() => {
      if (serverProcess) {
        try { serverProcess.kill('SIGKILL'); } catch (_) {}
      }
    }, 5000);
    return { success: true, message: 'Wysyłanie polecenia zatrzymania...' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

function sendServerCommand(cmd) {
  if (!serverProcess) throw new Error('Serwer nie jest uruchomiony.');
  if (!cmd || !cmd.trim()) return;
  const cleanCmd = cmd.trim().replace(/^\//, '');
  serverProcess.stdin.write(`${cleanCmd}\n`);
  return { success: true, command: cleanCmd };
}

function getServerStatus() {
  const cfg = getServerConfig();
  return {
    running: !!serverProcess,
    starting: isStarting,
    localIp: getLocalIp(),
    port: cfg.port || 25565,
    config: cfg,
    serverDir: getInstanceServerDir(cfg),
    tunnel: {
      active: !!(tunnelProcess && tunnelPublicAddress),
      starting: tunnelStarting,
      publicAddress: tunnelPublicAddress,
      targetPort: tunnelTargetPort
    }
  };
}

module.exports = {
  getServerConfig,
  saveServerConfig,
  getInstanceServerDir,
  startServer,
  stopServer,
  sendServerCommand,
  getServerStatus,
  getServerMetrics,
  getLocalIp,
  openServerFolder,
  startPublicTunnel,
  stopPublicTunnel
};
