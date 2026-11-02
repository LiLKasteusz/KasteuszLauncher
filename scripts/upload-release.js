const fs = require('fs');
const https = require('https');
const path = require('path');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
const version = pkg.version;

let token = process.env.GH_TOKEN;
const tokenFile = path.join(__dirname, '../.github_token');
if (!token && fs.existsSync(tokenFile)) {
  token = fs.readFileSync(tokenFile, 'utf8').trim();
}
if (!token) {
  console.error('[BŁĄD] Brak tokena GitHub. Ustaw zmienną GH_TOKEN lub utwórz plik .github_token.');
  process.exit(1);
}
const owner = 'LiLKasteusz';
const repo = 'KasteuszLauncher';

function apiRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`API Error ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

async function getOrCreateRelease() {
  console.log(`[Release] Sprawdzanie wydania v${version} na GitHubie...`);
  try {
    const existing = await apiRequest({
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/releases/tags/v${version}`,
      method: 'GET',
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'KasteuszLauncher-Release',
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (existing && existing.id) {
      console.log(`[Release] Znaleziono istniejące wydanie ID: ${existing.id}`);
      return existing;
    }
  } catch (_) {}

  console.log(`[Release] Tworzenie nowego wydania v${version}...`);
  return await apiRequest({
    hostname: 'api.github.com',
    path: `/repos/${owner}/${repo}/releases`,
    method: 'POST',
    headers: {
      'Authorization': `token ${token}`,
      'User-Agent': 'KasteuszLauncher-Release',
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github.v3+json'
    }
  }, {
    tag_name: `v${version}`,
    target_commitish: 'main',
    name: `Kasteusz Launcher v${version}`,
    body: `### Kasteusz Launcher v${version}\n\nAutomatyczna aktualizacja dla Windows i Linux.`,
    draft: false,
    prerelease: false
  });
}

function uploadAsset(releaseId, filePath, fileName, contentType = 'application/octet-stream') {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      console.warn(`[Skip] Plik nie istnieje: ${filePath}`);
      return resolve(null);
    }
    const stat = fs.statSync(filePath);
    console.log(`[Upload] Wysyłanie ${fileName} (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);

    const req = https.request({
      hostname: 'uploads.github.com',
      port: 443,
      path: `/repos/${owner}/${repo}/releases/${releaseId}/assets?name=${encodeURIComponent(fileName)}`,
      method: 'POST',
      headers: {
        'Authorization': `token ${token}`,
        'Content-Type': contentType,
        'Content-Length': stat.size,
        'User-Agent': 'KasteuszLauncher-Release'
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[Upload OK] Pomyślnie wysłano: ${fileName}`);
          resolve(JSON.parse(data));
        } else {
          console.error(`[Upload Error] ${fileName}: HTTP ${res.statusCode}`);
          resolve(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error(`[Upload Request Error] ${fileName}:`, e.message);
      resolve(null);
    });

    fs.createReadStream(filePath).pipe(req);
  });
}

async function main() {
  const distDir = path.join(__dirname, '../dist');
  const release = await getOrCreateRelease();
  const relId = release.id;

  const files = [
    { file: path.join(distDir, 'latest.yml'), name: 'latest.yml', type: 'text/yaml' },
    { file: path.join(distDir, 'latest-linux.yml'), name: 'latest-linux.yml', type: 'text/yaml' },
    { file: path.join(distDir, `KasteuszLauncher-Setup-${version}.exe.blockmap`), name: `KasteuszLauncher-Setup-${version}.exe.blockmap` },
    { file: path.join(distDir, `KasteuszLauncher-Setup-${version}.exe`), name: `KasteuszLauncher-Setup-${version}.exe` },
    { file: path.join(distDir, `KasteuszLauncher-${version}.AppImage`), name: `KasteuszLauncher-${version}.AppImage` },
    { file: path.join(distDir, `KasteuszLauncher-${version}.deb`), name: `KasteuszLauncher-${version}.deb` }
  ];

  for (const item of files) {
    if (Array.isArray(release.assets)) {
      const existing = release.assets.find(a => a.name === item.name);
      if (existing) {
        console.log(`[Clean] Usuwanie poprzedniej wersji pliku ${item.name} (ID: ${existing.id})...`);
        try {
          await apiRequest({
            hostname: 'api.github.com',
            path: `/repos/${owner}/${repo}/releases/assets/${existing.id}`,
            method: 'DELETE',
            headers: {
              'Authorization': `token ${token}`,
              'User-Agent': 'KasteuszLauncher-Release',
              'Accept': 'application/vnd.github.v3+json'
            }
          });
        } catch (_) {}
      }
    }
    await uploadAsset(relId, item.file, item.name, item.type);
  }

  console.log(`\n🎉 Gotowe! Wydanie v${version} jest w pełni opublikowane i dostępne dla graczy.`);
  console.log(`🔗 Link do wydania: https://github.com/${owner}/${repo}/releases/tag/v${version}`);
}

main().catch(err => {
  console.error('[Błąd publikacji]:', err);
  process.exit(1);
});
