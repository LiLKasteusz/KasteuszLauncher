const { app, BrowserWindow } = require('electron');

const MS_CLIENT_ID = '00000000402b5328';
const MS_REDIRECT_URI = 'https://login.live.com/oauth20_desktop.srf';
const MS_AUTH_URL = `https://login.live.com/oauth20_authorize.srf?client_id=${MS_CLIENT_ID}&response_type=code&scope=service::user.auth.xboxlive.com::MBI_SSL&redirect_uri=${encodeURIComponent(MS_REDIRECT_URI)}`;

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: true });
  win.webContents.on('will-navigate', (e, url) => console.log('[will-navigate]', url));
  win.webContents.on('will-redirect', (e, url) => console.log('[will-redirect]', url));
  win.webContents.on('did-navigate', (e, url) => console.log('[did-navigate]', url));
  win.webContents.on('did-fail-load', (e, code, desc, url) => console.log('[fail-load]', code, desc, url));
  win.loadURL(MS_AUTH_URL);

  setTimeout(() => {
    console.log('[DEBUG CURRENT URL]', win.webContents.getURL());
    app.quit();
  }, 3500);
});
