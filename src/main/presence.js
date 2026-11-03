const { app, ipcMain } = require('electron');
const net = require('net');
const os = require('os');
const config = require('./config');

const PRESENCE_TOPIC = 'kasteusz_presence_prod';
const ANNOUNCEMENT_TOPIC = 'kasteusz_announcements_prod';
const SERVER_HOST = '89.144.32.13';
const SERVER_PORT = 23008;

let mainWindow = null;
let heartbeatInterval = null;
let announcementInterval = null;
let isGameRunning = false;
let currentGameLabel = null;
let lastSeenAnnouncementId = null;

function isOwnerAccount(account) {
  if (!account) return false;
  const OWNER_UUID = 'c78190c60bda425e9feea980e541479';
  const OWNER_NAMES = ['mcqueen420_', 'mcqueen420', 'kasteusz'];
  const uuid = String(account.uuid || '').replace(/-/g, '').toLowerCase();
  const name = String(account.username || account.name || '').trim().toLowerCase();
  return uuid === OWNER_UUID || OWNER_NAMES.includes(name);
}

function writeVarInt(value) {
  const bytes = [];
  let v = value >>> 0;
  while (true) {
    if ((v & ~0x7F) === 0) { bytes.push(v); break; }
    bytes.push((v & 0x7F) | 0x80);
    v >>>= 7;
  }
  return Buffer.from(bytes);
}

function readVarIntFromBuffer(buf, offset = 0) {
  let res = 0, shift = 0, cursor = offset;
  while (cursor < buf.length) {
    const b = buf[cursor++];
    res |= (b & 0x7F) << shift;
    if ((b & 0x80) === 0) return { value: res, length: cursor - offset };
    shift += 7;
    if (shift >= 35) return null;
  }
  return null;
}

function pingSzkolneSmp(timeoutMs = 3500) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (val) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(val);
    };

    const t0 = Date.now();
    const socket = net.createConnection({ host: SERVER_HOST, port: SERVER_PORT });
    socket.setNoDelay(true);
    socket.setTimeout(timeoutMs);

    const chunks = [];
    socket.on('connect', () => {
      const hostBuf = Buffer.from(SERVER_HOST, 'utf8');
      const portBuf = Buffer.alloc(2);
      portBuf.writeUInt16BE(SERVER_PORT & 0xFFFF, 0);
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
      if (!pktLen || buf.length < pktLen.length + pktLen.value) return;
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
          online: true,
          playersCount: Number(parsed?.players?.online ?? 0),
          maxPlayers: Number(parsed?.players?.max ?? 20),
          sample: sampleNames,
          version: parsed?.version?.name || 'Paper 1.21.11',
          pingMs: Math.max(1, Date.now() - t0)
        });
      } catch (_) {
        finish(null);
      }
    });

    socket.on('timeout', () => finish({ online: false, playersCount: 0, maxPlayers: 20, sample: [], version: null, pingMs: null }));
    socket.on('error', () => finish({ online: false, playersCount: 0, maxPlayers: 20, sample: [], version: null, pingMs: null }));
  });
}

function getSystemOsName() {
  const p = process.platform;
  if (p === 'win32') return 'Windows';
  if (p === 'darwin') return 'macOS';
  return 'Linux';
}

async function sendPresenceHeartbeat(statusOverride = null, isOffline = false) {
  try {
    const acc = config.getActiveAccount ? config.getActiveAccount() : null;
    const cfg = config.getConfig ? config.getConfig() : {};
    const username = acc?.username || acc?.name || 'Gracz';
    const isOwner = isOwnerAccount(acc);

    let status = statusOverride;
    if (!status) {
      status = isGameRunning ? `W grze (${currentGameLabel || 'Minecraft'})` : 'W menu głównym';
    }

    const payload = {
      user: username,
      uuid: acc?.uuid || '',
      isOwner: isOwner,
      status: status,
      os: getSystemOsName(),
      ver: app.getVersion() || '2.5.1',
      ramGb: Number(cfg.memoryMax || 4),
      ts: Date.now(),
      offline: !!isOffline
    };

    await fetch(`https://ntfy.sh/${PRESENCE_TOPIC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (_) {
    // Fail silently in background
  }
}

async function checkAnnouncements() {
  try {
    const res = await fetch(`https://ntfy.sh/${ANNOUNCEMENT_TOPIC}/json?poll=1&since=12h`);
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n').filter(Boolean);
    if (!lines.length) return;

    let newest = null;
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        if (item.event === 'message' && item.message) {
          if (!newest || item.time > newest.time) {
            newest = item;
          }
        }
      } catch (_) {}
    }

    if (newest && newest.id !== lastSeenAnnouncementId) {
      lastSeenAnnouncementId = newest.id;
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('presence:announcement', {
          id: newest.id,
          title: newest.title || 'Wiadomość od Właściciela (Kasteusz)',
          message: newest.message,
          time: (newest.time || 0) * 1000
        });
      }
    }
  } catch (_) {}
}

let presenceCache = { ts: 0, map: new Map() };

async function fetchPresenceMap(maxAgeMs = 3 * 60 * 1000) {
  const now = Date.now();
  if (now - presenceCache.ts < 20000) return presenceCache.map;
  const map = new Map();
  try {
    const res = await fetch(`https://ntfy.sh/${PRESENCE_TOPIC}/json?poll=1&since=10m`);
    if (res.ok) {
      const lines = (await res.text()).trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          if (row.event !== 'message' || !row.message) continue;
          const data = JSON.parse(row.message);
          if (!data || !data.user) continue;
          const key = String(data.user).toLowerCase();
          const prev = map.get(key);
          if (!prev || data.ts > prev.ts) map.set(key, data);
        } catch (_) {}
      }
    }
  } catch (_) {}
  for (const [k, p] of map.entries()) {
    map.set(k, { ...p, online: !p.offline && (now - p.ts) < maxAgeMs });
  }
  presenceCache = { ts: now, map };
  return map;
}

async function getAdminData() {
  const acc = config.getActiveAccount ? config.getActiveAccount() : null;
  const isOwner = isOwnerAccount(acc);
  if (!isOwner) {
    return { success: false, error: 'Brak uprawnień. Zakładka dostępna wyłącznie dla Właściciela.' };
  }

  // 1. Fetch presence records from ntfy.sh
  const playersMap = new Map();
  try {
    const res = await fetch(`https://ntfy.sh/${PRESENCE_TOPIC}/json?poll=1`);
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const row = JSON.parse(line);
          if (row.event === 'message' && row.message) {
            const data = JSON.parse(row.message);
            if (data && data.user) {
              const uKey = String(data.user).toLowerCase();
              const existing = playersMap.get(uKey);
              if (!existing || data.ts > existing.ts) {
                playersMap.set(uKey, data);
              }
            }
          }
        } catch (_) {}
      }
    }
  } catch (err) {
    console.warn('[Presence] Błąd pobierania graczy:', err.message);
  }

  // 2. Filter out offline players and heartbeats older than 3 minutes (180s)
  const now = Date.now();
  const maxAgeMs = 3 * 60 * 1000;
  const activePlayers = [];

  for (const p of playersMap.values()) {
    if (!p.offline && (now - p.ts) < maxAgeMs) {
      activePlayers.push(p);
    }
  }

  // Ensure current Owner is always shown even if first heartbeat just started
  const ownerNick = acc?.username || 'Mcqueen420_';
  if (!activePlayers.some(p => p.user.toLowerCase() === ownerNick.toLowerCase())) {
    activePlayers.unshift({
      user: ownerNick,
      uuid: acc?.uuid || 'c78190c60bda425e9feea980e541479',
      isOwner: true,
      status: isGameRunning ? `W grze (${currentGameLabel || 'Minecraft'})` : 'W menu głównym',
      os: getSystemOsName(),
      ver: app.getVersion() || '2.5.1',
      ramGb: Number((config.getConfig ? config.getConfig().memoryMax : 4) || 4),
      ts: now,
      offline: false
    });
  }

  // Sort: Owner first, then by lastSeen desc
  activePlayers.sort((a, b) => {
    if (a.isOwner && !b.isOwner) return -1;
    if (!a.isOwner && b.isOwner) return 1;
    return b.ts - a.ts;
  });

  // 3. SLP Ping Szkolne SMP
  const serverData = await pingSzkolneSmp();

  return {
    success: true,
    launcherPlayers: activePlayers,
    serverData: serverData || { online: false, playersCount: 0, maxPlayers: 20, sample: [] },
    timestamp: now
  };
}

async function broadcastAnnouncement(message) {
  const acc = config.getActiveAccount ? config.getActiveAccount() : null;
  if (!isOwnerAccount(acc)) {
    throw new Error('Brak uprawnień właściciela.');
  }

  const clean = String(message || '').trim();
  if (!clean) throw new Error('Treść ogłoszenia nie może być pusta.');

  await fetch(`https://ntfy.sh/${ANNOUNCEMENT_TOPIC}`, {
    method: 'POST',
    headers: {
      'Title': 'Ogloszenie Wlasciciela Kasteusza',
      'Priority': 'urgent',
      'Tags': 'crown,loudspeaker'
    },
    body: clean
  });

  // Also broadcast locally to this window
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('presence:announcement', {
      id: 'local-' + Date.now(),
      title: '👑 Ogłoszenie Właściciela Kasteusza',
      message: clean,
      time: Date.now()
    });
  }

  return { success: true };
}

function initPresence(win) {
  mainWindow = win;

  // Initial heartbeat 1s after launch
  setTimeout(() => {
    sendPresenceHeartbeat();
    checkAnnouncements();
  }, 1000);

  // Periodic heartbeat every 35 seconds
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    sendPresenceHeartbeat();
  }, 35000);

  // Periodic announcement check every 30 seconds
  if (announcementInterval) clearInterval(announcementInterval);
  announcementInterval = setInterval(() => {
    checkAnnouncements();
  }, 30000);

  app.on('before-quit', () => {
    try {
      sendPresenceHeartbeat('Rozłączono', true);
    } catch (_) {}
  });
}

function setWindow(win) {
  mainWindow = win;
}

function setGameActivity(running, label = null) {
  isGameRunning = !!running;
  currentGameLabel = label;
  sendPresenceHeartbeat(isGameRunning ? `W grze (${label || 'Minecraft'})` : 'W menu głównym');
}

function setupPresenceIpc() {
  ipcMain.handle('presence:get-admin-data', async () => {
    return await getAdminData();
  });

  ipcMain.handle('presence:broadcast', async (_e, message) => {
    return await broadcastAnnouncement(message);
  });

  ipcMain.handle('presence:heartbeat', async () => {
    await sendPresenceHeartbeat();
    return { success: true };
  });
}

module.exports = {
  initPresence,
  setWindow,
  setupPresenceIpc,
  setGameActivity,
  sendPresenceHeartbeat,
  fetchPresenceMap,
  isOwnerAccount
};
