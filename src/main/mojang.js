const FALLBACK_VERSIONS = [
  { id: '1.21.11', type: 'release', releaseTime: '2026-10-25' },
  { id: '1.21.4', type: 'release', releaseTime: '2024-12-03' },
  { id: '1.21.1', type: 'release', releaseTime: '2024-08-08' },
  { id: '1.20.4', type: 'release', releaseTime: '2023-12-07' },
  { id: '1.20.1', type: 'release', releaseTime: '2023-06-12' },
  { id: '1.19.4', type: 'release', releaseTime: '2023-03-14' },
  { id: '1.18.2', type: 'release', releaseTime: '2022-02-28' },
  { id: '1.16.5', type: 'release', releaseTime: '2021-01-15' },
  { id: '1.12.2', type: 'release', releaseTime: '2017-09-18' },
  { id: '1.8.9', type: 'release', releaseTime: '2015-12-09' }
];

let cachedVersions = null;
let lastFetchTime = 0;

async function getAvailableVersions() {
  const now = Date.now();
  if (cachedVersions && now - lastFetchTime < 3600000) {
    return cachedVersions;
  }

  try {
    const res = await fetch('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json', {
      headers: { 'User-Agent': 'KasteuszLauncher/1.0' }
    });
    if (res.ok) {
      const data = await res.json();
      let releases = (data.versions || [])
        .filter(v => v.type === 'release')
        .map(v => ({
          id: v.id,
          type: v.type,
          releaseTime: v.releaseTime ? v.releaseTime.split('T')[0] : ''
        }));
      
      // Upewnij się że 1.21.11 jest na szczycie listy
      if (!releases.some(r => r.id === '1.21.11')) {
        releases.unshift({ id: '1.21.11', type: 'release', releaseTime: '2026-10-25' });
      }

      cachedVersions = {
        latest: '1.21.11',
        releases: releases.slice(0, 30) // 30 ostatnich wydań
      };
      lastFetchTime = now;
      return cachedVersions;
    }
  } catch (err) {
    console.warn('Nie udało się pobrać wersji z Mojang, używam listy wbudowanej:', err.message);
  }

  return {
    latest: '1.21.11',
    releases: FALLBACK_VERSIONS
  };
}

module.exports = {
  getAvailableVersions
};
