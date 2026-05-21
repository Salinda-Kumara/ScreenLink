// src/renderer/pages/dashboard.js — Dashboard Page
// Renders the main user interface with quick action cards,
// local room code, and connection panel.

import { socketService } from '../services/socket.js';
import { deviceService } from '../services/device.js';
import { showToast } from '../components/toast.js';

let activeRoomCode = '';

export function render() {
  const localDev = deviceService.getLocalDevice() || { name: 'This Device', ip: '127.0.0.1', platform: 'win32' };
  const platformName = localDev.platform.includes('win') ? 'Windows' : localDev.platform.includes('darwin') ? 'macOS' : 'Linux';

  return `
    <div class="fade-in-up">
      <!-- Welcome Hero Section -->
      <div class="section welcome-hero" style="position: relative; overflow: hidden; padding: 40px; border-radius: var(--radius-lg); background: linear-gradient(180deg, rgba(145, 90, 255, 0.08) 0%, rgba(63, 185, 255, 0.03) 100%); margin-bottom: 32px; border: var(--glass-border);">
        <!-- Particle background nodes -->
        <div class="hero-particle float" style="position: absolute; width: 10px; height: 10px; background: var(--accent-blue); border-radius: 50%; opacity: 0.2; top: 15%; left: 10%; filter: blur(1px);"></div>
        <div class="hero-particle float delay-2" style="position: absolute; width: 15px; height: 15px; background: var(--accent-purple); border-radius: 50%; opacity: 0.15; top: 60%; left: 85%; filter: blur(2px);"></div>
        <div class="hero-particle float delay-4" style="position: absolute; width: 8px; height: 8px; background: var(--accent-blue); border-radius: 50%; opacity: 0.3; top: 80%; left: 30%;"></div>
        
        <h1 class="text-gradient" style="font-size: 2.5rem; font-weight: 800; margin-bottom: 8px; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ScreenLink</h1>
        <p style="font-size: 1.1rem; color: var(--text-secondary); max-width: 600px; margin-bottom: 24px;">Seamless screen collaboration and secure file exchange. Connect easily across your local network.</p>
        
        <div class="flex gap-md align-center" style="margin-bottom: 24px;">
          <div class="flex gap-md align-center" style="font-size: 0.9rem; color: var(--text-secondary); background: rgba(0,0,0,0.2); padding: 12px 20px; border-radius: var(--radius-md); width: fit-content;">
            <div class="flex align-center gap-sm">
              <span class="status-dot online"></span>
              <span>Device: <strong>${localDev.name}</strong> (${platformName})</span>
            </div>
            <span style="opacity: 0.3;">|</span>
            <div>IP: <strong>${localDev.ip}</strong></div>
          </div>
        </div>

        <button id="btn-hero-share" class="btn btn-primary flex align-center gap-sm" style="padding: 16px 40px; font-size: 1.1rem; font-weight: 700; border-radius: var(--radius-md); letter-spacing: 0.5px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          Share your Screen
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-3 section" style="margin-bottom: 32px;">
        <div class="card flex align-center gap-md">
          <div class="card-icon flex-center" style="width: 48px; height: 48px; border-radius: 50%; background: rgba(145, 90, 255, 0.1); color: var(--accent-purple);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Discovered Devices</div>
            <div id="stat-devices-count" style="font-size: 1.5rem; font-weight: 700; color: #fff;">0</div>
          </div>
        </div>

        <div class="card flex align-center gap-md">
          <div class="card-icon flex-center" style="width: 48px; height: 48px; border-radius: 50%; background: rgba(63, 185, 255, 0.1); color: var(--accent-blue);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Room Code</div>
            <div id="stat-room-code" style="font-size: 1.5rem; font-weight: 700; color: var(--accent-blue); letter-spacing: 1px;">------</div>
          </div>
        </div>

        <div class="card flex align-center gap-md">
          <div class="card-icon flex-center" style="width: 48px; height: 48px; border-radius: 50%; background: rgba(52, 211, 153, 0.1); color: var(--success);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          </div>
          <div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Signaling Server</div>
            <div id="stat-server-port" style="font-size: 1.2rem; font-weight: 700; color: var(--success);">Active</div>
          </div>
        </div>
      </div>



      <!-- Quick Actions Grid -->
      <div class="section">
        <h2 class="section-title" style="font-size: 1.3rem; font-weight: 700; margin-bottom: 16px;">Quick Actions</h2>
        <div class="grid grid-4">
          <!-- Screen Mirror -->
          <div class="action-card card text-center" id="action-mirror" style="cursor: pointer; padding: 24px;">
            <div class="action-icon flex-center" style="width: 56px; height: 56px; border-radius: 12px; background: var(--accent-gradient); color: #fff; margin: 0 auto 16px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </div>
            <div class="action-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">Screen Mirror</div>
            <div class="action-desc" style="font-size: 0.8rem; color: var(--text-secondary);">Cast your screen or windows in real-time</div>
          </div>

          <!-- File Transfer -->
          <div class="action-card card text-center" id="action-file" style="cursor: pointer; padding: 24px;">
            <div class="action-icon flex-center" style="width: 56px; height: 56px; border-radius: 12px; background: var(--accent-gradient); color: #fff; margin: 0 auto 16px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div class="action-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">File Transfer</div>
            <div class="action-desc" style="font-size: 0.8rem; color: var(--text-secondary);">Direct P2P wireless file sharing</div>
          </div>

          <!-- Camera -->
          <div class="action-card card text-center" id="action-camera" style="cursor: pointer; padding: 24px;">
            <div class="action-icon flex-center" style="width: 56px; height: 56px; border-radius: 12px; background: var(--accent-gradient); color: #fff; margin: 0 auto 16px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <div class="action-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">Live Camera</div>
            <div class="action-desc" style="font-size: 0.8rem; color: var(--text-secondary);">Mirror your camera stream to peers</div>
          </div>

          <!-- Gallery -->
          <div class="action-card card text-center" id="action-gallery" style="cursor: pointer; padding: 24px;">
            <div class="action-icon flex-center" style="width: 56px; height: 56px; border-radius: 12px; background: var(--accent-gradient); color: #fff; margin: 0 auto 16px auto;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <div class="action-title" style="font-weight: 600; font-size: 1rem; margin-bottom: 8px;">Media Gallery</div>
            <div class="action-desc" style="font-size: 0.8rem; color: var(--text-secondary);">Browse received photos & videos</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const localDev = deviceService.getLocalDevice();
  const serverPort = window.mirrorcast ? await window.mirrorcast.getServerPort() : 3489;
  
  // Update port display
  const portEl = document.getElementById('stat-server-port');
  if (portEl) {
    portEl.innerText = `Port ${serverPort}`;
  }

  // Hook connect and register
  try {
    if (!socketService.isConnected()) {
      activeRoomCode = await socketService.connectToLocal();
    } else {
      activeRoomCode = socketService.getRoomCode();
    }
    
    const codeEl = document.getElementById('stat-room-code');
    if (codeEl) codeEl.innerText = activeRoomCode || '------';
  } catch (err) {
    console.error('[Dashboard] socket registration error:', err);
    showToast('Failed to connect to signaling server', 'error');
  }

  // Share your Screen hero button → navigate to Screen Mirror
  const btnHeroShare = document.getElementById('btn-hero-share');
  if (btnHeroShare) {
    btnHeroShare.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('navigate', { detail: { page: 'mirror' } }));
    });
  }

  // Quick Action Navigation Hooks
  const quickActions = [
    { id: 'action-mirror', page: 'mirror' },
    { id: 'action-file', page: 'file-transfer' },
    { id: 'action-camera', page: 'camera' },
    { id: 'action-gallery', page: 'gallery' },
  ];

  quickActions.forEach((act) => {
    const el = document.getElementById(act.id);
    if (el) {
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('navigate', { detail: { page: act.page } }));
      });
    }
  });
}

export function destroy() {
  // No active listeners to clean up
}
