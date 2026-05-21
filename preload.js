// preload.js — Context Bridge for ScreenLink
// Exposes a curated API to the renderer process while keeping
// nodeIntegration disabled and contextIsolation enabled.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorcast', {

  // ── Screen Capture ──────────────────────────────────────────────
  /**
   * Fetches available screen and window sources for capture.
   * @returns {Promise<Array<{id: string, name: string, thumbnail: string}>>}
   */
  getSources: () => ipcRenderer.invoke('get-sources'),

  // ── File Transfer ───────────────────────────────────────────────
  /**
   * Opens a native file picker and returns the selected file's metadata + data.
   * @returns {Promise<{name: string, path: string, size: number, data: Buffer} | null>}
   */
  selectFile: () => ipcRenderer.invoke('select-file'),

  /**
   * Opens a native save dialog and writes the received buffer to disk.
   * @param {ArrayBuffer|Uint8Array} buffer — the file contents
   * @param {string} name — suggested filename
   * @returns {Promise<{success: boolean, filePath?: string, reason?: string}>}
   */
  saveFile: (buffer, name) => ipcRenderer.invoke('save-file', buffer, name),

  // ── Network Info ────────────────────────────────────────────────
  /**
   * Returns the local machine's network details.
   * @returns {Promise<{ip: string, hostname: string, platform: string}>}
   */
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),

  // ── Window Controls (frameless window) ──────────────────────────
  /** Minimize the app window. */
  minimize: () => ipcRenderer.send('window-minimize'),

  /** Toggle maximize / unmaximize the app window. */
  maximize: () => ipcRenderer.send('window-maximize'),

  /** Close the app window (minimizes to tray). */
  close: () => ipcRenderer.send('window-close'),

  // ── Tray Actions ────────────────────────────────────────────────
  /**
   * Registers a listener for actions triggered from the system tray menu.
   * @param {(action: string) => void} callback
   */
  onTrayAction: (callback) => {
    ipcRenderer.on('tray-action', (_event, action) => callback(action));
  },

  // ── Server Info ─────────────────────────────────────────────────
  /**
   * Returns the port the signaling server is listening on.
   * @returns {Promise<number>}
   */
  getServerPort: () => ipcRenderer.invoke('get-server-port'),

  /**
   * Opens a URL in the system's default external browser.
   * @param {string} url
   */
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  /**
   * Fetches LAN-discovered devices snapshot from the main process.
   * @returns {Promise<Array<Object>>}
   */
  getLanDevices: () => ipcRenderer.invoke('get-lan-devices'),

  /**
   * Registers a listener for LAN device changes.
   * @param {(devices: Array<Object>) => void} callback
   */
  onLanDevicesUpdated: (callback) => {
    const subscription = (_event, devices) => callback(devices);
    ipcRenderer.on('lan-devices-updated', subscription);
    return () => ipcRenderer.removeListener('lan-devices-updated', subscription);
  },

  /**
   * Updates the broadcasted room code of this device.
   * @param {string} code
   */
  updateRoomCode: (code) => ipcRenderer.send('update-room-code', code),

  // ── Mini Widget Controls ─────────────────────────────────────────
  /**
   * Shows the floating screen share mini widget.
   * @param {boolean} isPaused - initial paused state
   */
  showMiniWidget: (isPaused) => ipcRenderer.send('show-mini-widget', isPaused),

  /** Hides/closes the screen share mini widget. */
  hideMiniWidget: () => ipcRenderer.send('hide-mini-widget'),

  /**
   * Sends an action from the mini-widget back to the main process.
   * @param {string} action - 'pause' or 'stop'
   */
  sendMiniWidgetAction: (action) => ipcRenderer.send('mini-widget-action', action),

  /**
   * Updates/synchronizes the state of the mini-widget (e.g. paused state) from the main window.
   * @param {Object} state - {isPaused: boolean}
   */
  updateMiniWidgetState: (state) => ipcRenderer.send('update-mini-widget-state', state),

  /**
   * Registers a listener in the main app window for actions triggered by the widget.
   * @param {(action: string) => void} callback
   */
  onMiniWidgetTrigger: (callback) => {
    const subscription = (_event, action) => callback(action);
    ipcRenderer.on('mini-widget-trigger', subscription);
    return () => ipcRenderer.removeListener('mini-widget-trigger', subscription);
  },

  /**
   * Registers a listener in the mini-widget window for state changes sent from the main window.
   * @param {(state: {isPaused: boolean}) => void} callback
   */
  onMiniWidgetStateUpdate: (callback) => {
    const subscription = (_event, state) => callback(state);
    ipcRenderer.on('mini-widget-state-update', subscription);
    return () => ipcRenderer.removeListener('mini-widget-state-update', subscription);
  },

  // ── Native Fullscreen APIs ───────────────────────────────────────
  /**
   * Toggles native full screen mode for the main window.
   * @param {boolean} flag - true to enter fullscreen, false to exit
   */
  setFullScreen: (flag) => ipcRenderer.send('window-fullscreen', flag),

  /**
   * Queries if the main window is currently in native full screen mode.
   * @returns {Promise<boolean>}
   */
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),

  /**
   * Registers a listener for when the main window leaves native full screen mode.
   * @param {() => void} callback
   * @returns {() => void} unsubscribe function
   */
  onFullscreenLeft: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('window-fullscreen-left', subscription);
    return () => ipcRenderer.removeListener('window-fullscreen-left', subscription);
  },
});
