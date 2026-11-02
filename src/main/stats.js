const fs = require('fs');
const path = require('path');
const config = require('./config');

const STATS_FILE = path.join(config.APP_DIR, 'stats.json');

const DEFAULT_STATS = {
  totalPlaytimeMinutes: 120, // 2h początkowe
  totalLaunches: 15,
  lastPlayed: Date.now(),
  history: []
};

let currentSessionStart = null;
let currentVersion = null;

function getStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      const data = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
      return { ...DEFAULT_STATS, ...data };
    }
  } catch (err) {
    console.warn('Błąd odczytu stats.json:', err);
  }
  return { ...DEFAULT_STATS };
}

function saveStats(stats) {
  try {
    if (!fs.existsSync(config.APP_DIR)) {
      fs.mkdirSync(config.APP_DIR, { recursive: true });
    }
    fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2), 'utf8');
    return stats;
  } catch (err) {
    console.error('Błąd zapisu stats.json:', err);
    return stats;
  }
}

function recordLaunch(version) {
  currentSessionStart = Date.now();
  currentVersion = version;

  const stats = getStats();
  stats.totalLaunches = (stats.totalLaunches || 0) + 1;
  stats.lastPlayed = Date.now();
  saveStats(stats);
  return stats;
}

function recordClose() {
  const stats = getStats();
  if (currentSessionStart) {
    const elapsedMinutes = Math.max(1, Math.round((Date.now() - currentSessionStart) / 60000));
    stats.totalPlaytimeMinutes = (stats.totalPlaytimeMinutes || 0) + elapsedMinutes;
    stats.lastPlayed = Date.now();

    if (!Array.isArray(stats.history)) stats.history = [];
    stats.history.unshift({
      date: new Date().toISOString(),
      minutes: elapsedMinutes,
      version: currentVersion || '1.21.11'
    });
    if (stats.history.length > 25) {
      stats.history = stats.history.slice(0, 25);
    }

    currentSessionStart = null;
    currentVersion = null;
    saveStats(stats);
  }
  return stats;
}

function getRankTitle(minutes, username = '', uuid = '') {
  const clean = String(username || '').trim().toLowerCase();
  const cleanUuid = String(uuid || '').replace(/-/g, '').toLowerCase();
  if (
    clean === 'mcqueen420_' ||
    clean === 'mcqueen420' ||
    clean === 'kasteusz' ||
    cleanUuid === 'c78190c60bda425e9feea980e541479'
  ) {
    return '👑 Właściciel';
  }
  const hours = (minutes || 0) / 60;
  if (hours >= 100) return 'Legenda Kasteusza 👑';
  if (hours >= 50) return 'Mistrz Szkolne SMP ⚔️';
  if (hours >= 20) return 'Zygzak McQueen #95 ⚡';
  if (hours >= 10) return 'Weteran Fabric 💎';
  if (hours >= 2) return 'Zaawansowany Gracz ⭐';
  return 'Nowicjusz Kasteusza 🎮';
}

module.exports = {
  getStats,
  recordLaunch,
  recordClose,
  getRankTitle
};
