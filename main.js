// main.js — Electron Main Process for ScreenLink
// Manages the BrowserWindow, system tray, IPC communication,
// and bootstraps the signaling + discovery servers.

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  desktopCapturer,
  nativeImage,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { createSignalingServer } = require('./src/server/signaling');
const { createDiscoveryService } = require('./src/server/discovery');

// ─── Constants ───────────────────────────────────────────────────────
const SIGNALING_PORT = 3489;
const DISCOVERY_PORT = 3490;
const ICON_PATH = path.join(__dirname, 'assets', 'icon.png');

// ─── Globals ─────────────────────────────────────────────────────────
let mainWindow = null;
let miniWidgetWindow = null;
let tray = null;
let signalingServer = null;
let discoveryService = null;
let isQuitting = false;

// ─── Single Instance Lock ────────────────────────────────────────────
// Prevent multiple instances of the app from running simultaneously.
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // If a second instance is launched, focus the existing window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(initialize);
}

// ─── Initialization ─────────────────────────────────────────────────
async function initialize() {
  createMainWindow();
  createSystemTray();
  registerIpcHandlers();
  await startServices();
}

// ─── Main Window ─────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,                   // Frameless for custom title bar
    icon: ICON_PATH,
    backgroundColor: '#0f0a1e',     // Dark background to prevent white flash
    show: false,                    // Wait until ready-to-show
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  // Show window gracefully once the renderer is painted
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });



  // Native fullscreen change listener to notify renderer
  mainWindow.on('leave-full-screen', () => {
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('window-fullscreen-left');
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ─── System Tray ─────────────────────────────────────────────────────
function createSystemTray() {
  const trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
  tray = new Tray(trayIcon);
  tray.setToolTip('ScreenLink');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Screen Mirror',
      click: () => {
        showAndNotify('screen-mirror');
      },
    },
    {
      label: 'File Transfer',
      click: () => {
        showAndNotify('file-transfer');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click on tray icon restores the window
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

/**
 * Shows the main window and sends a tray action to the renderer.
 * @param {string} action — the action identifier (e.g. 'screen-mirror')
 */
function showAndNotify(action) {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.send('tray-action', action);
  }
}

// ─── IPC Handlers ────────────────────────────────────────────────────
function registerIpcHandlers() {

  // ── Open External URL ──
  ipcMain.handle('open-external', async (_event, url) => {
    const { shell } = require('electron');
    await shell.openExternal(url);
  });

  // ── Screen / Window capture sources ──
  ipcMain.handle('get-sources', async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
      });

      return sources.map((source) => ({
        id: source.id,
        name: source.name,
        thumbnail: source.thumbnail.toDataURL(),
      }));
    } catch (err) {
      console.error('[IPC] get-sources error:', err);
      return [];
    }
  });

  // ── File selection ──
  ipcMain.handle('select-file', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        title: 'Select a file to send',
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      const filePath = result.filePaths[0];
      const stats = fs.statSync(filePath);
      const data = fs.readFileSync(filePath);

      return {
        name: path.basename(filePath),
        path: filePath,
        size: stats.size,
        data: data,    // Sent as Buffer; serialized automatically by Electron IPC
      };
    } catch (err) {
      console.error('[IPC] select-file error:', err);
      return null;
    }
  });

  // ── File saving ──
  ipcMain.handle('save-file', async (_event, buffer, defaultName) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: defaultName || 'download',
        title: 'Save received file',
      });

      if (result.canceled || !result.filePath) {
        return { success: false, reason: 'cancelled' };
      }

      // Convert to Buffer if it arrives as an ArrayBuffer / Uint8Array
      const fileBuffer = Buffer.from(buffer);
      fs.writeFileSync(result.filePath, fileBuffer);

      return { success: true, filePath: result.filePath };
    } catch (err) {
      console.error('[IPC] save-file error:', err);
      return { success: false, reason: err.message };
    }
  });

  // ── Network information ──
  ipcMain.handle('get-network-info', () => {
    try {
      const localIp = getLocalIPv4();
      return {
        ip: localIp,
        hostname: os.hostname(),
        platform: os.platform(),
      };
    } catch (err) {
      console.error('[IPC] get-network-info error:', err);
      return { ip: '127.0.0.1', hostname: 'unknown', platform: os.platform() };
    }
  });

  // ── Window controls (frameless window) ──
  ipcMain.on('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-maximize', () => {
    if (mainWindow) {
      mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
    }
  });

  ipcMain.on('window-close', () => {
    // Triggers the 'close' event handler which hides instead of quitting
    if (mainWindow) mainWindow.close();
  });

  // Native fullscreen control handlers
  ipcMain.on('window-fullscreen', (_event, flag) => {
    if (mainWindow) {
      mainWindow.setFullScreen(flag);
    }
  });

  ipcMain.handle('is-fullscreen', () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
  });

  // ── Signaling server port ──
  ipcMain.handle('get-server-port', () => {
    return signalingServer ? signalingServer.port : SIGNALING_PORT;
  });

  // ── LAN discovered devices list ──
  ipcMain.handle('get-lan-devices', () => {
    return discoveryService ? discoveryService.getDevices() : [];
  });

  // ── Update local room code in UDP broadcast ──
  ipcMain.on('update-room-code', (_event, roomCode) => {
    if (discoveryService) {
      discoveryService.updateRoomCode(roomCode);
    }
  });

  // ── Mini Widget Control Handlers ──
  ipcMain.on('show-mini-widget', (_event, isPaused) => {
    try {
      createMiniWidgetWindow(isPaused);
    } catch (err) {
      console.error('[IPC] show-mini-widget error:', err);
    }
  });

  ipcMain.on('hide-mini-widget', () => {
    if (miniWidgetWindow) {
      try {
        miniWidgetWindow.close();
      } catch (e) {}
      miniWidgetWindow = null;
    }
  });

  ipcMain.on('mini-widget-action', (_event, action) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mini-widget-trigger', action);
    }
  });

  ipcMain.on('update-mini-widget-state', (_event, state) => {
    if (miniWidgetWindow && !miniWidgetWindow.isDestroyed()) {
      miniWidgetWindow.webContents.send('mini-widget-state-update', state);
    }
  });
}

// ─── Services ────────────────────────────────────────────────────────
async function startServices() {
  try {
    // Start the Socket.io signaling server
    signalingServer = createSignalingServer(SIGNALING_PORT);
    console.log(`[Main] Signaling server started on port ${signalingServer.port}`);

    // Gather device info for discovery broadcasts
    const localIp = getLocalIPv4();
    const deviceInfo = {
      name: os.hostname(),
      platform: os.platform(),
      ip: localIp,
    };

    // Start the UDP LAN discovery service
    discoveryService = createDiscoveryService(DISCOVERY_PORT, signalingServer.port, deviceInfo);
    discoveryService.start();
    console.log(`[Main] Discovery service started on port ${DISCOVERY_PORT}`);

    const notifyRendererOfLanChange = () => {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('lan-devices-updated', discoveryService.getDevices());
      }
    };

    discoveryService.onDeviceFound((device) => {
      console.log(`[Discovery] Device found: ${device.name} (${device.ip})`);
      notifyRendererOfLanChange();
    });

    discoveryService.onDeviceLost((device) => {
      console.log(`[Discovery] Device lost: ${device.name} (${device.ip})`);
      notifyRendererOfLanChange();
    });
  } catch (err) {
    console.error('[Main] Failed to start services:', err);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Returns the first non-internal IPv4 address, prioritizing physical adapters over virtual ones.
 */
function getLocalIPv4() {
  const interfaces = os.networkInterfaces();
  
  // Pass 1: Try to find a physical (non-virtual) interface
  for (const name of Object.keys(interfaces)) {
    if (isVirtualInterface(name)) continue;
    
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  
  // Pass 2: Fallback to any non-internal IPv4 (including virtual interfaces)
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  
  return '127.0.0.1';
}

/**
 * Helper to identify virtual network interfaces by name keywords.
 */
function isVirtualInterface(name) {
  const lower = name.toLowerCase();
  const virtualKeywords = [
    'virtual', 'vbox', 'vmware', 'virtualbox', 'wsl', 'hyper-v', 
    'docker', 'tailscale', 'zerotier', 'vpn', 'loopback', 
    'vethernet', 'npcap', 'host-only', 'tunnel'
  ];
  return virtualKeywords.some(keyword => lower.includes(keyword));
}

// ─── App Lifecycle ───────────────────────────────────────────────────
app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  // macOS dock click when no windows are open
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  } else if (mainWindow) {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;

  // Clean up floating widget
  if (miniWidgetWindow) {
    try { miniWidgetWindow.close(); } catch(e) {}
    miniWidgetWindow = null;
  }

  // Gracefully shut down services
  if (discoveryService) {
    discoveryService.stop();
    console.log('[Main] Discovery service stopped');
  }

  if (signalingServer && signalingServer.server) {
    signalingServer.server.close();
    console.log('[Main] Signaling server stopped');
  }
});

/**
 * Creates and displays a content-protected, frameless, and floating mini-widget control bar.
 * Positioned top-center of primary screen. contentProtection is enabled so it's invisible to WebRTC capture.
 */
function createMiniWidgetWindow(isPaused) {
  if (miniWidgetWindow && !miniWidgetWindow.isDestroyed()) {
    miniWidgetWindow.show();
    miniWidgetWindow.webContents.send('mini-widget-state-update', { isPaused });
    return;
  }

  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;

  const width = 160;
  const height = 48;
  const x = Math.round((screenWidth - width) / 2);
  const y = 30; // 30px from top of screen

  miniWidgetWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    icon: ICON_PATH,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  });

  // Enable OS-level content protection to prevent it from showing up in any desktop screenshot/capture
  miniWidgetWindow.setContentProtection(true);

  miniWidgetWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'mini-widget.html'));

  miniWidgetWindow.once('ready-to-show', () => {
    miniWidgetWindow.show();
    // Allow page to load before sending state
    setTimeout(() => {
      if (miniWidgetWindow && !miniWidgetWindow.isDestroyed()) {
        miniWidgetWindow.webContents.send('mini-widget-state-update', { isPaused });
      }
    }, 200);
  });

  miniWidgetWindow.on('closed', () => {
    miniWidgetWindow = null;
  });
}
