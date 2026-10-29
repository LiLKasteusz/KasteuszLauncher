const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { app } = require('electron');

const SERVER_DIR = path.join(
  process.env.HOME || app?.getPath('userData') || '.',
  '.kasteuszlauncher',
  'server'
);
const CONFIG_FILE = path.join(
  process.env.HOME || app?.getPath('userData') || '.',
  '.kasteuszlauncher',
  'server_config.json'
);

const DEFAULT_SERVER_URL = 'https://piston-data.mojang.com/v1/objects/64bb6d763bed0a9f1d632ec347938594144943ed/server.jar';

let serverProcess = null;
let isStarting = false;

function getServerConfig() {
  const defaults = {
    version: '1.21.11',
    ram: 2,
    port: 25565,
    onlineMode: false,
    motd: 'Serwer KasteuszLauncher (1.21.11)',
    gamemode: 'survival',
    difficulty: 'normal',
    pvp: true,
    maxPlayers: 10
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      return { ...defaults, ...data };
    }
  } catch (e) {}
  return defaults;
}

function saveServerConfig(cfg) {
  try {
    const current = getServerConfig();
    const updated = { ...current, ...cfg };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (e) {
    console.error('Błąd zapisu server_config:', e);
    return cfg;
  }
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

async function ensureServerJar(window) {
  if (!fs.existsSync(SERVER_DIR)) {
    fs.mkdirSync(SERVER_DIR, { recursive: true });
  }

  const jarPath = path.join(SERVER_DIR, 'server.jar');
  if (fs.existsSync(jarPath) && fs.statSync(jarPath).size > 10000000) {
    return jarPath;
  }

  window?.webContents.send('server:status', { status: 'downloading', message: 'Pobieranie oficjalnego pliku server.jar 1.21.11...' });

  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(jarPath);
    https.get(DEFAULT_SERVER_URL, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Błąd pobierania server.jar: HTTP ${res.statusCode}`));
      }
      const total = parseInt(res.headers['content-length'] || '56000000', 10);
      let downloaded = 0;

      res.on('data', (chunk) => {
        downloaded += chunk.length;
        const pct = Math.round((downloaded / total) * 100);
        window?.webContents.send('server:download-progress', { pct, downloaded, total });
      });

      res.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(jarPath));
      });
    }).on('error', (err) => {
      fs.unlink(jarPath, () => {});
      reject(err);
    });
  });
}

function applyServerProperties(cfg) {
  const eulaPath = path.join(SERVER_DIR, 'eula.txt');
  fs.writeFileSync(eulaPath, '# EULA zaakceptowana przez KasteuszLauncher\neula=true\n', 'utf8');

  const propsPath = path.join(SERVER_DIR, 'server.properties');
  const content = `# Plik konfiguracyjny wygenerowany przez KasteuszLauncher
server-port=${cfg.port || 25565}
online-mode=${cfg.onlineMode ? 'true' : 'false'}
motd=${cfg.motd || 'Serwer KasteuszLauncher'}
difficulty=${cfg.difficulty || 'normal'}
gamemode=${cfg.gamemode || 'survival'}
pvp=${cfg.pvp ? 'true' : 'false'}
max-players=${cfg.maxPlayers || 10}
enable-command-block=true
spawn-protection=0
view-distance=10
simulation-distance=8
sync-chunk-writes=false
`;
  fs.writeFileSync(propsPath, content, 'utf8');
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
    window?.webContents.send('server:status', { status: 'preparing', message: 'Weryfikacja plików serwera 1.21.11...' });
    await ensureServerJar(window);
    applyServerProperties(cfg);

    const jarPath = path.join(SERVER_DIR, 'server.jar');
    const localIp = getLocalIp();
    const ram = cfg.ram || 2;
    const javaArgs = [
      `-Xmx${ram}G`,
      `-Xms1G`,
      '-XX:+UseG1GC',
      '-jar',
      jarPath,
      'nogui'
    ];

    window?.webContents.send('server:status', { status: 'starting', message: `Uruchamianie silnika Minecraft (${ram}GB RAM)...` });
    window?.webContents.send('server:log', `[KasteuszLauncher Host] Start serwera: java ${javaArgs.join(' ')}`);

    serverProcess = spawn('/usr/bin/java', javaArgs, {
      cwd: SERVER_DIR,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (data) => {
      const text = data.toString();
      const lines = text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        window?.webContents.send('server:log', line.trim());
        if (line.includes('Done (') && line.includes('For help, type "help"')) {
          isStarting = false;
          window?.webContents.send('server:status', {
            status: 'running',
            message: 'Serwer działa pomyślnie!',
            ip: localIp,
            port: cfg.port || 25565
          });
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
      window?.webContents.send('server:status', { status: 'stopped', code });
      window?.webContents.send('server:log', `[KasteuszLauncher Host] Serwer został zatrzymany (kod: ${code}).`);
    });

    return { success: true, localIp, port: cfg.port };
  } catch (err) {
    isStarting = false;
    serverProcess = null;
    window?.webContents.send('server:status', { status: 'error', message: err.message });
    throw err;
  }
}

function stopServer() {
  if (!serverProcess) return { success: true, message: 'Serwer nie jest uruchomiony.' };
  try {
    serverProcess.stdin.write('stop\n');
    setTimeout(() => {
      if (serverProcess) {
        try { serverProcess.kill('SIGKILL'); } catch (e) {}
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
    config: cfg
  };
}

module.exports = {
  getServerConfig,
  saveServerConfig,
  startServer,
  stopServer,
  sendServerCommand,
  getServerStatus,
  getLocalIp
};
