// src/renderer/pages/devices.js — Devices Nearby Page
// Shows discovered LAN devices and allows connecting via room codes.

import { deviceService } from '../services/device.js';
import { socketService } from '../services/socket.js';
import { showToast } from '../components/toast.js';
import { createDeviceCard } from '../components/device-card.js';

let updateDevicesListener = null;
let unsubscribeLan = null;
let refreshInterval = null;

export function render() {
  return `
    <div class="fade-in-up flex column gap-md" style="height: 100%;">
      <div class="section">
        <div class="flex justify-between align-center" style="margin-bottom: 20px;">
          <div>
            <h2 class="section-title" style="margin-bottom: 4px;">Devices Nearby</h2>
            <p style="font-size: 0.85rem; color: var(--text-secondary);">Devices discovered on your local network</p>
          </div>
          <div class="flex align-center gap-sm">
            <span class="badge badge-online">Scanning</span>
            <button id="btn-refresh-devices" class="btn btn-secondary" style="padding: 8px 16px; font-size: 0.8rem;">Refresh</button>
          </div>
        </div>

        <div style="background: rgba(63, 185, 255, 0.08); border: 1px solid rgba(63, 185, 255, 0.2); padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.8rem; color: var(--accent-blue); display: flex; align-items: center; gap: 8px; margin-bottom: 20px; line-height: 1.4;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          <span>Ensure other devices are connected to the <strong>same Wi-Fi network</strong> and have ScreenLink open to discover them.</span>
        </div>

        <div id="devices-nearby-list" class="flex column gap-sm" style="max-height: calc(100vh - 260px); overflow-y: auto;">
          <div class="flex column flex-center gap-sm" style="color: var(--text-tertiary); padding: 60px 0;">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; animation: pulse 2s infinite;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
            <div style="font-size: 0.9rem;">Scanning for ScreenLink devices on the LAN...</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const btnRefresh = document.getElementById('btn-refresh-devices');

  const refreshDevices = async () => {
    const listEl = document.getElementById('devices-nearby-list');
    if (!listEl) return;

    // Get LAN discovered devices
    let lanDevices = [];
    if (window.mirrorcast && window.mirrorcast.getLanDevices) {
      lanDevices = await window.mirrorcast.getLanDevices();
    }

    // Get room devices if connected
    let roomDevices = [];
    const isConnected = socketService.isConnected() && socketService.currentUrl && !socketService.currentUrl.includes('localhost');
    if (isConnected) {
      try {
        roomDevices = await socketService.getDevices();
      } catch (e) {}
    }

    // Merge and deduplicate — filter out own device
    const mappedDevices = [];
    const localDevice = deviceService.getLocalDevice();
    const localIp = localDevice ? localDevice.ip : '127.0.0.1';

    // Add active room devices (but not self)
    roomDevices.forEach(rd => {
      if (rd.ip === localIp) return;
      mappedDevices.push({
        id: rd.id,
        name: rd.name,
        platform: rd.platform,
        ip: rd.ip,
        roomCode: rd.roomCode || socketService.getRoomCode(),
        status: 'connected'
      });
    });

    // Add LAN devices not already in room (and not self)
    lanDevices.forEach(ld => {
      if (ld.ip === localIp) return;
      const isAlreadyInRoom = roomDevices.some(rd => rd.ip === ld.ip);
      if (!isAlreadyInRoom) {
        mappedDevices.push({
          id: ld.ip,
          name: ld.name,
          platform: ld.platform,
          ip: ld.ip,
          serverPort: ld.serverPort,
          roomCode: ld.roomCode,
          status: 'online'
        });
      }
    });

    deviceService.setDevices(mappedDevices);

    if (mappedDevices.length === 0) {
      listEl.innerHTML = `
        <div class="flex column flex-center gap-sm" style="color: var(--text-tertiary); padding: 60px 0;">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3; animation: pulse 2s infinite;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <div style="font-size: 0.9rem;">Scanning for ScreenLink devices on the LAN...</div>
          <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 8px;">Make sure other devices are on the same network</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    mappedDevices.forEach((device) => {
      const card = createDeviceCard(
        device,
        async () => {
          showToast(`Connecting to ${device.name}...`, 'info');
          const url = `http://${device.ip}:${device.serverPort}`;
          const connected = await socketService.connectToRemote(url, device.roomCode);
          if (connected) {
            await refreshDevices();
          }
        },
        async () => {
          showToast('Disconnecting from device...', 'warning');
          await socketService.connectToLocal();
          await refreshDevices();
        }
      );
      listEl.appendChild(card);
    });
  };

  // Initial load
  await refreshDevices();

  // Auto-refresh every 5 seconds
  refreshInterval = setInterval(refreshDevices, 5000);

  // Button refresh
  if (btnRefresh) btnRefresh.addEventListener('click', refreshDevices);

  // Socket updates
  socketService.on('device-joined', refreshDevices);
  socketService.on('device-left', refreshDevices);

  // Device state changes
  updateDevicesListener = deviceService.onDevicesChange(() => {
    refreshDevices();
  });

  // LAN discovery updates
  if (window.mirrorcast && window.mirrorcast.onLanDevicesUpdated) {
    unsubscribeLan = window.mirrorcast.onLanDevicesUpdated((devices) => {
      console.log('[Devices] LAN devices update:', devices);
      refreshDevices();
    });
  }
}

export function destroy() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
  if (updateDevicesListener) {
    updateDevicesListener();
    updateDevicesListener = null;
  }
  if (unsubscribeLan) {
    unsubscribeLan();
    unsubscribeLan = null;
  }
  socketService.off('device-joined', null);
  socketService.off('device-left', null);
}
