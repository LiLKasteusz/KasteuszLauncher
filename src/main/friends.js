const fs = require('fs');
const path = require('path');
const presence = require('./presence');

const FRIENDS_FILE = path.join(
  require('os').homedir(),
  '.kasteuszlauncher',
  'friends.json'
);

function loadStored() {
  try {
    if (!fs.existsSync(FRIENDS_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf8'));
    if (!Array.isArray(data)) return [];
    return data
      .filter(f => f && f.username)
      .map(f => ({ username: String(f.username), addedAt: f.addedAt || null, isFav: !!f.isFav }));
  } catch (e) {
    return [];
  }
}

function saveFriends(friends) {
  try {
    const dir = path.dirname(FRIENDS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const clean = friends.map(f => ({ username: f.username, addedAt: f.addedAt || null, isFav: !!f.isFav }));
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(clean, null, 2), 'utf8');
  } catch (e) {
    console.error('Blad zapisu znajomych:', e);
  }
}

async function enrich(stored) {
  const map = await presence.fetchPresenceMap();
  const list = stored.map(f => {
    const p = map.get(f.username.toLowerCase());
    const online = !!(p && p.online);
    const srvMatch = online && p.status ? String(p.status).match(/^Na serwerze\s+(\S+)/i) : null;
    return {
      ...f,
      serverIp: srvMatch && srvMatch[1] !== 'Lokalny' ? srvMatch[1] : null,
      online,
      status: online ? (p.status || 'Online w launcherze') : 'Offline',
      lastSeen: p ? p.ts : null
    };
  });
  list.sort((a, b) => (Number(b.online) - Number(a.online)) || a.username.localeCompare(b.username));
  return list;
}

async function getFriends() {
  return enrich(loadStored());
}

async function addFriend(username) {
  if (!username) throw new Error('Podaj poprawny nick gracza.');
  const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16);
  if (!clean || clean.length < 2) throw new Error('Nick gracza musi miec co najmniej 2 znaki (dozwolone litery, cyfry, _).');

  const friends = loadStored();
  if (friends.some(f => f.username.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Gracz ${clean} jest juz na liscie Twoich znajomych.`);
  }

  friends.unshift({ username: clean, addedAt: Date.now(), isFav: false });
  saveFriends(friends);
  return enrich(friends);
}

async function removeFriend(username) {
  const target = (username || '').toLowerCase();
  const friends = loadStored().filter(f => f.username.toLowerCase() !== target);
  saveFriends(friends);
  return enrich(friends);
}

module.exports = {
  getFriends,
  addFriend,
  removeFriend
};