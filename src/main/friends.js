const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const FRIENDS_FILE = path.join(
  require('os').homedir(),
  '.kasteuszlauncher',
  'friends.json'
);

const DEFAULT_FRIENDS = [
  { username: 'Zlovuss', status: 'W grze na szkolnesmp.com.pl', online: true, isFav: true },
  { username: 'Kasteusz', status: 'W grze na szkolnesmp.com.pl', online: true, isFav: true },
  { username: 'synek21', status: 'Offline', online: false, isFav: false }
];

function getFriends() {
  try {
    if (!fs.existsSync(FRIENDS_FILE)) {
      saveFriends(DEFAULT_FRIENDS);
      return DEFAULT_FRIENDS;
    }
    const data = JSON.parse(fs.readFileSync(FRIENDS_FILE, 'utf8'));
    return Array.isArray(data) ? data : DEFAULT_FRIENDS;
  } catch (e) {
    return DEFAULT_FRIENDS;
  }
}

function saveFriends(friends) {
  try {
    const dir = path.dirname(FRIENDS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(friends, null, 2), 'utf8');
  } catch (e) {
    console.error('Błąd zapisu znajomych:', e);
  }
}

function addFriend(username) {
  if (!username) throw new Error('Podaj poprawny nick gracza.');
  const clean = username.trim().replace(/[^a-zA-Z0-9_]/g, '').substring(0, 16);
  if (!clean || clean.length < 2) throw new Error('Nick gracza musi mieć co najmniej 2 znaki (dozwolone litery, cyfry, _).');

  const friends = getFriends();
  if (friends.some(f => f.username.toLowerCase() === clean.toLowerCase())) {
    throw new Error(`Gracz ${clean} jest już na liście Twoich znajomych.`);
  }

  const newFriend = {
    username: clean,
    status: 'Online',
    online: true,
    addedAt: Date.now()
  };

  friends.unshift(newFriend);
  saveFriends(friends);
  return friends;
}

function removeFriend(username) {
  let friends = getFriends();
  friends = friends.filter(f => f.username.toLowerCase() !== (username || '').toLowerCase());
  saveFriends(friends);
  return friends;
}

module.exports = {
  getFriends,
  addFriend,
  removeFriend
};
