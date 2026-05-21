// src/renderer/services/device.js — Device Manager
// Manages local device identification and a list of discovered peers.

class DeviceService {
  constructor() {
    this.localDevice = null;
    this.devices = [];
    this.listeners = new Set();
  }

  /**
   * Initialize local device details.
   */
  async init() {
    try {
      if (window.mirrorcast) {
        const netInfo = await window.mirrorcast.getNetworkInfo();
        this.localDevice = {
          id: 'local',
          name: localStorage.getItem('device_name') || netInfo.hostname || 'My Device',
          platform: netInfo.platform || 'windows',
          ip: netInfo.ip || '127.0.0.1',
          status: 'online',
        };
      } else {
        // Fallback for browser tests
        this.localDevice = {
          id: 'local',
          name: localStorage.getItem('device_name') || 'Browser Device',
          platform: 'unknown',
          ip: '127.0.0.1',
          status: 'online',
        };
      }
      console.log('[Device] Local device initialized:', this.localDevice);
    } catch (err) {
      console.error('[Device] Init failed:', err);
    }
  }

  getLocalDevice() {
    return this.localDevice;
  }

  updateLocalName(newName) {
    if (this.localDevice) {
      this.localDevice.name = newName;
      localStorage.setItem('device_name', newName);
      this.triggerChange();
    }
  }

  getDevices() {
    return this.devices;
  }

  setDevices(newDevices) {
    this.devices = newDevices.map(d => ({
      ...d,
      status: d.status || 'online',
    }));
    this.triggerChange();
  }

  addDevice(device) {
    const exists = this.devices.find(d => d.id === device.id);
    if (!exists) {
      this.devices.push({
        ...device,
        status: device.status || 'online',
      });
      console.log('[Device] Device added:', device.name);
      this.triggerChange();
    }
  }

  removeDevice(deviceId) {
    const initialLen = this.devices.length;
    this.devices = this.devices.filter(d => d.id !== deviceId);
    if (this.devices.length !== initialLen) {
      console.log('[Device] Device removed:', deviceId);
      this.triggerChange();
    }
  }

  updateDevice(deviceId, updates) {
    const device = this.devices.find(d => d.id === deviceId);
    if (device) {
      Object.assign(device, updates);
      console.log('[Device] Device updated:', deviceId, updates);
      this.triggerChange();
    }
  }

  onDevicesChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  triggerChange() {
    for (const callback of this.listeners) {
      try {
        callback([...this.devices]);
      } catch (err) {
        console.error('[Device] Error in devices change listener:', err);
      }
    }
  }

  /**
   * Helper to return SVG icons based on the operating system.
   * @param {string} platform — 'win32', 'darwin', 'android', 'ios', 'linux'
   * @returns {string} SVG path/tag string
   */
  getPlatformIcon(platform) {
    const pf = (platform || '').toLowerCase();
    
    // Windows icon
    if (pf.includes('win')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 5.54l6.5-.82v5.78H3V5.54zm0 6.46h6.5v5.78L3 16.96v-4.96zM10.5 4.58L21 3v8h-10.5V4.58zm0 14.84V12H21v8l-10.5-1.58z"/>
      </svg>`;
    }
    
    // Mac / Apple icon
    if (pf.includes('mac') || pf.includes('darwin') || pf.includes('ios') || pf.includes('apple')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.56 2.95-1.39z"/>
      </svg>`;
    }
    
    // Android icon
    if (pf.includes('android')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 11h2v2H7zm8 0h2v2h-2zm-5.83-4.38L8.1 4.7a.5.5 0 0 0-.7.7l1.08 1.81a9.92 9.92 0 0 0-3.32 5.09h13.68a9.92 9.92 0 0 0-3.32-5.09l1.08-1.81a.5.5 0 0 0-.7-.7l-1.07 1.92A9.9 9.9 0 0 0 10 6.62zM5 14h14v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z"/>
      </svg>`;
    }
    
    // Linux icon
    if (pf.includes('linux')) {
      return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2zm1 14.5c0 .83-.67 1.5-1.5 1.5s-1.5-.67-1.5-1.5.67-1.5 1.5-1.5 1.5.67 1.5 1.5zm-1-4.5c0-.55-.45-1-1-1h-1a1 1 0 0 1 0-2h2a2 2 0 0 1 2 2c0 1.11-.9 2-2 2H12v1H11v-2h1z"/>
      </svg>`;
    }
    
    // Generic display icon
    return `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 2H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h7l-2 3v1h8v-1l-2-3h7c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 12H3V4h18v10z"/>
    </svg>`;
  }
}

export const deviceService = new DeviceService();
