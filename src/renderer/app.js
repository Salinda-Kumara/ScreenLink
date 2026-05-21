// src/renderer/app.js — Application Bootstrap & Router
// Manages primary layouts, page navigation routers, sidebar rendering,
// custom titlebar actions, and general device lifecycle states.

import { init as initTitlebar } from './components/titlebar.js';
import { init as initSidebar, setActive } from './components/sidebar.js';
import { deviceService } from './services/device.js';
import { socketService } from './services/socket.js';
import { webrtcService } from './services/webrtc.js';
import { fileTransferService } from './services/file-transfer.js';
import { showToast } from './components/toast.js';

// Import Pages
import * as dashboard from './pages/dashboard.js';
import * as devices from './pages/devices.js';
import * as mirror from './pages/mirror.js';
import * as camera from './pages/camera.js';
import * as fileTransfer from './pages/file-transfer.js';
import * as gallery from './pages/gallery.js';
import * as settings from './pages/settings.js';

const pages = {
  dashboard,
  devices,
  mirror,
  camera,
  'file-transfer': fileTransfer,
  gallery,
  settings,
};

let currentPage = null;

/**
 * Programmatic routing function.
 * @param {string} pageId — active page target id
 */
function navigate(pageId) {
  // If leaving the mirror page, exit fullscreen cleanly
  if (currentPage === 'mirror' && pageId !== 'mirror') {
    if (window.mirrorcast && window.mirrorcast.setFullScreen) {
      document.body.classList.remove('app-fullscreen');
      window.mirrorcast.setFullScreen(false);
    }
  }

  if (currentPage && pages[currentPage]) {
    try {
      pages[currentPage].destroy();
    } catch (e) {
      console.error(`Error destroying page ${currentPage}:`, e);
    }
  }

  currentPage = pageId;
  const page = pages[pageId];

  if (!page) {
    console.error(`Page not found: ${pageId}`);
    return;
  }

  const contentEl = document.getElementById('content');
  if (contentEl) {
    contentEl.innerHTML = page.render();
    try {
      page.init();
    } catch (e) {
      console.error(`Error initializing page ${pageId}:`, e);
    }
  }

  setActive(pageId);
}

// ── Application Initialization ─────────────────────────────────────
async function bootstrap() {
  console.log('[ScreenLink] Bootstrap initialized...');

  // 1. Initialize core state Services
  await deviceService.init();
  webrtcService.init();
  fileTransferService.init();

  // Global stream receiver handler
  webrtcService.onRemoteStream((targetId, stream) => {
    console.log('[App] Global remote stream received from peer:', targetId);
    // Only navigate if not already on the mirror page
    // to avoid destroying/re-creating it (which causes race conditions with fullscreen)
    if (currentPage !== 'mirror') {
      navigate('mirror');
    }
  });

  // 2. Initialize UI layout shells (titlebar and sidebar toggler)
  initTitlebar();
  initSidebar(navigate);

  // 3. Mount default Dashboard landing page
  navigate('dashboard');

  // 4. Programmatic Custom Event Router
  window.addEventListener('navigate', (e) => {
    if (e.detail && e.detail.page) {
      navigate(e.detail.page);
    }
  });

  // 5. System Tray action events from Electron main bridge
  if (window.mirrorcast) {
    window.mirrorcast.onTrayAction((action) => {
      console.log(`[Tray] Action received in renderer: ${action}`);
      if (action === 'screen-mirror') {
        navigate('mirror');
      } else if (action === 'file-transfer') {
        navigate('file-transfer');
      }
    });
  }

  // Restore saved accent themes
  const savedAccent = localStorage.getItem('theme_accent');
  if (savedAccent) {
    applyThemeVariables(savedAccent);
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

// Kick off
document.addEventListener('DOMContentLoaded', bootstrap);
