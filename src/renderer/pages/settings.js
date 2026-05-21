// src/renderer/pages/settings.js — Settings Page
// Allows modifying local device identity tags, editing local storage name caches,
// reviewing connection port details, and toggling application interface colors.

import { deviceService } from '../services/device.js';
import { showToast } from '../components/toast.js';

export function render() {
  const localDev = deviceService.getLocalDevice() || { name: 'This Device', ip: '127.0.0.1' };
  const currentName = localStorage.getItem('device_name') || localDev.name;
  
  return `
    <div class="fade-in-up flex column gap-md" style="max-width: 800px; margin: 0 auto;">
      <h2 style="font-size: 1.5rem; font-weight: 700; margin-bottom: 8px;">Settings</h2>
      
      <!-- Section 1: Device Settings -->
      <div class="card flex column gap-md">
        <div class="card-title flex align-center gap-xs">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
          <span>Device Customization</span>
        </div>

        <div class="flex column gap-sm">
          <label style="font-size: 0.85rem; color: var(--text-secondary);">Device Name</label>
          <div class="input-group" style="display: flex; gap: 8px;">
            <input type="text" id="input-device-name" class="input" value="${currentName}" style="flex-grow: 1;" placeholder="Enter device name" />
            <button id="btn-save-device-name" class="btn btn-primary" style="padding: 10px 24px;">Save</button>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-tertiary);">This name will be visible to other devices on the local network.</span>
        </div>
      </div>

      <!-- Section 2: Connection details -->
      <div class="card flex column gap-md">
        <div class="card-title flex align-center gap-xs">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="10" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Network & System</span>
        </div>

        <div class="grid grid-2" style="gap: 16px;">
          <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Local IP Address</div>
            <div style="font-size: 1rem; font-weight: 600; color: #fff;">${localDev.ip}</div>
          </div>

          <div style="background: rgba(0,0,0,0.15); padding: 12px; border-radius: var(--radius-md);">
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px;">Signaling Server Port</div>
            <div style="font-size: 1rem; font-weight: 600; color: #fff;" id="label-settings-port">3489 (LAN Active)</div>
          </div>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5; margin-top: 10px;">
          <strong>Discovery:</strong> Mirrors and file sharing work locally. Ensure target devices are connected to the same Wi-Fi network and have ScreenLink launched.
        </div>
      </div>

      <!-- Section 3: Interface Themes -->
      <div class="card flex column gap-md">
        <div class="card-title flex align-center gap-xs">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2v20"/><path d="M12 12h10"/></svg>
          <span>Appearance Accent</span>
        </div>

        <div class="flex gap-md" style="margin-top: 8px;">
          <div class="theme-accent-circle" data-accent="purple" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #915AFF, #3FB9FF); cursor: pointer; border: 2px solid #fff; box-shadow: 0 0 10px rgba(145,90,255,0.4);"></div>
          <div class="theme-accent-circle" data-accent="emerald" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #34d399, #60a5fa); cursor: pointer; border: 2px solid transparent;"></div>
          <div class="theme-accent-circle" data-accent="rose" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #f43f5e, #fb923c); cursor: pointer; border: 2px solid transparent;"></div>
          <div class="theme-accent-circle" data-accent="cyber" style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #ff007f, #00f0ff); cursor: pointer; border: 2px solid transparent;"></div>
        </div>
      </div>

      <!-- Section 4: About App details -->
      <div class="card flex column gap-sm text-center" style="padding: 32px;">
        <div style="margin-bottom: 12px;">
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="14" y="8" width="34" height="24" rx="3" stroke="url(#aboutGrad)" stroke-width="2.5" fill="none" opacity="0.5"/>
            <rect x="20" y="32" width="22" height="2" rx="1" fill="url(#aboutGrad)" opacity="0.5"/>
            <rect x="22" y="18" width="34" height="24" rx="3" stroke="url(#aboutGrad)" stroke-width="2.5" fill="none"/>
            <rect x="28" y="42" width="22" height="2" rx="1" fill="url(#aboutGrad)"/>
            <path d="M39 10 C39 10, 44 4, 50 4" stroke="url(#aboutGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.4"/>
            <path d="M39 10 C39 10, 46 0, 55 0" stroke="url(#aboutGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.25"/>
            <path d="M39 10 C39 10, 42 7, 45 7.5" stroke="url(#aboutGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
            <circle cx="39" cy="11" r="2" fill="url(#aboutGrad)"/>
            <defs>
              <linearGradient id="aboutGrad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stop-color="#915AFF"/>
                <stop offset="100%" stop-color="#3FB9FF"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <h3 class="text-gradient" style="font-size: 1.4rem; font-weight: 800; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">ScreenLink</h3>
        <div style="font-size: 0.85rem; font-weight: 500; color: var(--text-secondary); margin-top: 2px;">v1.0</div>
        <p style="font-size: 0.85rem; color: var(--text-secondary); max-width: 480px; margin: 12px auto 0 auto; line-height: 1.6;">
          Seamless screen collaboration and secure file exchange.
        </p>
        <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle);">
          <div style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;"><a href="#" id="link-linkedin" style="color: var(--accent-blue); text-decoration: none; cursor: pointer;">© 2026 Salinda Wickramasinghe</a></div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 6px;">Dev@Salinda v1.0</div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const btnSave = document.getElementById('btn-save-device-name');
  const inputName = document.getElementById('input-device-name');
  const portEl = document.getElementById('label-settings-port');

  // Load port
  if (window.mirrorcast && portEl) {
    const port = await window.mirrorcast.getServerPort();
    portEl.innerText = `${port} (LAN Active)`;
  }

  // Save device name
  if (btnSave && inputName) {
    btnSave.addEventListener('click', () => {
      const name = inputName.value.trim();
      if (!name) {
        showToast('Please enter a valid name', 'warning');
        return;
      }
      
      deviceService.updateLocalName(name);
      showToast('Device name saved successfully!', 'success');
    });
  }

  // LinkedIn profile link
  const linkedinLink = document.getElementById('link-linkedin');
  if (linkedinLink) {
    linkedinLink.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.mirrorcast && window.mirrorcast.openExternal) {
        window.mirrorcast.openExternal('https://www.linkedin.com/in/salinda-kumara/');
      } else {
        window.open('https://www.linkedin.com/in/salinda-kumara/', '_blank');
      }
    });
  }

  // Accent Switcher
  const swatches = document.querySelectorAll('.theme-accent-circle');
  swatches.forEach((swatch) => {
    swatch.addEventListener('click', () => {
      // Clear borders
      swatches.forEach(s => s.style.border = '2px solid transparent');
      swatch.style.border = '2px solid #fff';
      
      const theme = swatch.getAttribute('data-accent');
      applyThemeVariables(theme);
      localStorage.setItem('theme_accent', theme);
      showToast(`Accent theme set to: ${theme.toUpperCase()}`, 'success');
    });
  });

  // Restore saved accent
  const savedAccent = localStorage.getItem('theme_accent');
  if (savedAccent) {
    const match = Array.from(swatches).find(s => s.getAttribute('data-accent') === savedAccent);
    if (match) {
      swatches.forEach(s => s.style.border = '2px solid transparent');
      match.style.border = '2px solid #fff';
      applyThemeVariables(savedAccent);
    }
  }
}

function applyThemeVariables(accent) {
  const root = document.documentElement;
  
  if (accent === 'purple') {
    root.style.setProperty('--accent-purple', '#915AFF');
    root.style.setProperty('--accent-blue', '#3FB9FF');
    root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #915AFF, #3FB9FF)');
    root.style.setProperty('--border-active', 'rgba(145,90,255,0.3)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(145,90,255,0.15)');
  } else if (accent === 'emerald') {
    root.style.setProperty('--accent-purple', '#34d399');
    root.style.setProperty('--accent-blue', '#60a5fa');
    root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #34d399, #60a5fa)');
    root.style.setProperty('--border-active', 'rgba(52,211,153,0.3)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(52,211,153,0.15)');
  } else if (accent === 'rose') {
    root.style.setProperty('--accent-purple', '#f43f5e');
    root.style.setProperty('--accent-blue', '#fb923c');
    root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #f43f5e, #fb923c)');
    root.style.setProperty('--border-active', 'rgba(244,63,94,0.3)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(244,63,94,0.15)');
  } else if (accent === 'cyber') {
    root.style.setProperty('--accent-purple', '#ff007f');
    root.style.setProperty('--accent-blue', '#00f0ff');
    root.style.setProperty('--accent-gradient', 'linear-gradient(135deg, #ff007f, #00f0ff)');
    root.style.setProperty('--border-active', 'rgba(255,0,127,0.3)');
    root.style.setProperty('--shadow-glow', '0 0 20px rgba(255,0,127,0.15)');
  }
}

export function destroy() {}
