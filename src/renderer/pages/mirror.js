// src/renderer/pages/mirror.js — Screen Mirroring Page
// Allows selecting native screens/windows via desktopCapturer,
// casting them to a peer device, or receiving cast streams
// with fullscreen and annotation tools support.

import { webrtcService } from '../services/webrtc.js';
import { socketService } from '../services/socket.js';
import { deviceService } from '../services/device.js';
import { showToast } from '../components/toast.js';
import { createAnnotationCanvas } from '../components/annotation-canvas.js';

let activeTab = 'share'; // 'share' or 'receive'
let selectedSourceId = null;
let sourcesList = [];
let localMirrorStream = null;
let remoteMirrorStream = null;
let currentTargetId = null;
let statsInterval = null;
let annotator = null;
let streamCleanup = null;
let statsCleanup = null;
let connectionCleanup = null;
let miniWidgetCleanup = null;
let fullscreenLeftCleanup = null;

export function render() {
  return `
    <div class="fade-in-up flex column gap-md" style="height: 100%;">
      <!-- Top Header / Tabs -->
      <div class="card flex justify-between align-center" style="padding: 16px 24px;">
        <h2 style="font-size: 1.3rem; font-weight: 700;">Screen Mirroring</h2>
        
        <!-- Tab selector buttons -->
        <div class="flex gap-sm" style="background: rgba(0,0,0,0.2); padding: 4px; border-radius: var(--radius-md);">
          <button id="tab-btn-share" class="btn ${activeTab === 'share' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.85rem; border: none;">Share Screen</button>
          <button id="tab-btn-receive" class="btn ${activeTab === 'receive' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.85rem; border: none;">Receive Feed</button>
        </div>
      </div>

      <!-- PAGE CONTENT AREA -->
      <div id="mirror-panel-content" style="flex-grow: 1;">
        <!-- Dynamic content goes here based on selected tab -->
      </div>
    </div>
  `;
}

function renderShareTab() {
  const activeRoomCode = socketService.getRoomCode();
  const isConnected = socketService.isConnected() && socketService.currentUrl && !socketService.currentUrl.includes('localhost');
  const devices = deviceService.getDevices();
  const options = devices.map(d => `<option value="${d.id}">${d.name} (${d.ip})</option>`).join('');

  return `
    <div class="grid grid-3" style="height: 100%;">
      <!-- Column 1: Sources Capture Select (2/3 width) -->
      <div class="card flex column" style="grid-column: span 2; min-height: 480px;">
        <div class="card-header" style="margin-bottom: 16px;">
          <div class="card-title">1. Select Screen or Window</div>
          <button id="btn-refresh-sources" class="btn btn-secondary flex align-center gap-xs" style="padding: 6px 12px; font-size: 0.8rem;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Refresh
          </button>
        </div>

        <div id="sources-grid" class="grid grid-3" style="flex-grow: 1; overflow-y: auto; max-height: 400px; padding-bottom: 10px;">
          <!-- Loaded dynamically -->
          <div class="flex-center text-secondary" style="grid-column: span 3; padding: 40px 0;">Loading sources...</div>
        </div>
      </div>

      <!-- Column 2: Cast Settings & Connection (1/3 width) -->
      <div class="card flex column gap-md" style="min-height: 480px;">
        <div class="card-title">2. Choose Receiver</div>
        
        ${!isConnected ? `
          <!-- Manual Connection Input -->
          <div class="flex column gap-sm" style="padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
            <label style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">Enter Receiver Room Code</label>
            <div class="input-group" style="display: flex; gap: 8px;">
              <input type="text" id="input-mirror-code" class="input" placeholder="6-Digit Code" maxlength="6" style="flex-grow: 1; text-align: center; font-size: 1.1rem; font-weight: 600; letter-spacing: 2px; width: 60%;" />
              <button id="btn-connect-mirror" class="btn btn-primary" style="padding: 10px 16px;">Connect</button>
            </div>
          </div>
        ` : `
          <!-- Connected Status -->
          <div class="flex column gap-sm" style="padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
            <div style="background: rgba(52, 211, 153, 0.08); border: 1px solid rgba(52, 211, 153, 0.2); padding: 12px; border-radius: var(--radius-md); font-size: 0.85rem;" class="flex column gap-xs">
              <div class="flex align-center gap-xs text-success" style="font-weight: 600;">
                <span class="status-dot online"></span>
                <span>Connected to Receiver</span>
              </div>
              <div style="color: var(--text-secondary); margin-top: 4px;">Room Code: <strong style="color: var(--accent-blue);">${activeRoomCode}</strong></div>
            </div>
            <button id="btn-disconnect-mirror" class="btn btn-danger" style="padding: 8px; font-size: 0.8rem; margin-top: 4px; width: 100%;">Disconnect</button>
          </div>
        `}

        <div class="flex column gap-sm" id="select-mirror-target-wrapper" style="${!isConnected ? 'display: none;' : ''}">
          <label style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">Select Target Device</label>
          <select id="select-mirror-target" class="input" style="width: 100%;">
            ${isConnected ? options : `<option value="">-- Choose device on same room --</option>${options}`}
          </select>
        </div>

        <!-- Audio Share Switch -->
        <div class="flex align-center justify-between" id="audio-share-wrapper" style="padding: 12px; background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-top: 4px; width: 100%;">
          <div class="flex column gap-xs" style="text-align: left;">
            <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-secondary);">Share System Audio</span>
            <span style="font-size: 0.7rem; color: var(--text-tertiary); line-height: 1.2;">Stream computer audio with screen</span>
          </div>
          <label class="switch">
            <input type="checkbox" id="checkbox-share-audio">
            <span class="slider"></span>
          </label>
        </div>

        <div style="flex-grow: 1; margin-top: 10px;" class="flex column gap-md flex-center text-center">
          <div id="mirror-preview-box" class="video-container" style="display: none; width: 100%; border-radius: var(--radius-md);">
            <video id="local-mirror-video" autoplay muted style="width: 100%; height: 100%; object-fit: contain;"></video>
          </div>
          
          <div id="mirror-placeholder" style="color: var(--text-tertiary);" class="flex column flex-center gap-sm">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <div style="font-size: 0.85rem;" id="mirror-placeholder-text">
              ${!isConnected ? 'Connect using Receiver Code to start mirror' : 'Select screen and target to start mirror'}
            </div>
          </div>
        </div>

        <div class="flex gap-sm">
          <button id="btn-start-mirror" class="btn btn-primary" style="flex-grow: 1;" disabled>Cast Screen</button>
          <button id="btn-stop-mirror" class="btn btn-danger" style="display: none; flex-grow: 1;">Stop Mirror</button>
        </div>
      </div>
    </div>
  `;
}

function renderReceiveTab() {
  const activeRoomCode = socketService.getRoomCode() || '------';

  return `
    <div class="card flex column align-center flex-center" style="min-height: 500px; padding: 20px; position: relative;">
      <!-- Main view video element container -->
      <div id="remote-video-container" class="video-container" style="display: none; width: 100%; height: 100%; max-width: 960px; position: relative;">
        <video id="remote-mirror-video" autoplay></video>
        
        <!-- Floating Canvas Overlay for Drawing Annotations -->
        <div id="annotation-overlay-target" style="position: absolute; inset: 0; pointer-events: none; z-index: 10;"></div>

        <!-- Video overlay panel -->
        <div class="mirror-controls-overlay flex justify-between" style="position: absolute; bottom: 16px; left: 16px; right: 16px; padding: 12px 24px; border-radius: var(--radius-md); background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); z-index: 20; opacity: 0; transition: opacity 0.3s ease;">
          <div class="flex align-center gap-sm text-secondary" style="font-size: 0.8rem;">
            <span class="status-dot online"></span>
            <span id="remote-mirror-stats">1920x1080 | 30 FPS | 10 ms</span>
          </div>

          <div class="flex gap-sm">
            <button id="btn-toggle-draw" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">Draw</button>
            <button id="btn-toggle-fit" class="btn btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;">Fill</button>
            <button id="btn-remote-fullscreen" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;">Fullscreen</button>
          </div>
        </div>
      </div>

      <!-- Placeholder until stream connects -->
      <div id="receive-placeholder" class="flex column flex-center gap-sm text-center" style="color: var(--text-tertiary); padding: 40px 0; width: 100%;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="animation: breathe 3s infinite;"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        <h3 style="font-size: 1.1rem; color: var(--text-secondary); margin-top: 10px;">Ready to Receive</h3>
        
        <!-- Beautiful Premium Room Code Display -->
        <div style="margin: 20px 0; padding: 20px; background: rgba(255,255,255,0.03); border: 1px dashed var(--border-active); border-radius: var(--radius-lg); max-width: 360px; width: 100%;" class="flex column gap-sm align-center">
          <div style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 1px; color: var(--text-secondary);">Your Screen Share Code</div>
          <div id="receive-room-code" class="text-gradient" style="font-size: 2.5rem; font-weight: 800; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 4px; padding: 4px 16px;">
            ${activeRoomCode}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-tertiary); line-height: 1.4;">Enter this code on the sending device to mirror instantly.</div>
        </div>

        <p style="font-size: 0.85rem; max-width: 320px; color: var(--text-tertiary);">Awaiting connection and casting stream...</p>
      </div>
    </div>
  `;
}

export async function init() {
  setupTabListeners();

  // If remote stream is active, show receive tab by default
  const activeStream = webrtcService.getRemoteStream();
  if (activeStream) {
    activeTab = 'receive';
  } else {
    activeTab = 'share';
  }

  await switchTab(activeTab);

  // Hook remote streaming events
  streamCleanup = webrtcService.onRemoteStream((targetId, stream) => {
    console.log('[MirrorPage] Remote stream received from peer:', targetId);
    remoteMirrorStream = stream;
    
    // Switch to receive tab automatically
    switchTab('receive');
  });

  // Connection State stats
  statsCleanup = webrtcService.onStats((targetId, stats) => {
    const statsEl = document.getElementById('remote-mirror-stats');
    if (statsEl) {
      statsEl.innerText = `${stats.resolution} | ${stats.fps} FPS | Latency: ${stats.latency}`;
    }
  });

  // Connection state change listener to clean up video feed immediately on disconnection
  connectionCleanup = webrtcService.onConnectionStateChange((targetId, state) => {
    console.log(`[MirrorPage] Connection state changed for ${targetId}: ${state}`);
    if (state === 'closed' || state === 'disconnected' || state === 'failed') {
      console.log('[MirrorPage] Peer disconnected or closed connection. Restoring receive view.');
      
      // Auto exit fullscreen on stream termination
      if (window.mirrorcast && window.mirrorcast.setFullScreen) {
        document.body.classList.remove('app-fullscreen');
        window.mirrorcast.setFullScreen(false);
      }
      
      // Restore receive view to placeholder state
      if (activeTab === 'receive') {
        const container = document.getElementById('remote-video-container');
        const video = document.getElementById('remote-mirror-video');
        const placeholder = document.getElementById('receive-placeholder');
        
        if (container && video && placeholder) {
          video.srcObject = null;
          container.style.display = 'none';
          placeholder.style.display = 'flex';
        }
      }
    }
  });

  // Native fullscreen escape listener
  if (window.mirrorcast && window.mirrorcast.onFullscreenLeft) {
    if (fullscreenLeftCleanup) {
      try { fullscreenLeftCleanup(); } catch (e) {}
      fullscreenLeftCleanup = null;
    }
    fullscreenLeftCleanup = window.mirrorcast.onFullscreenLeft(() => {
      console.log('[MirrorPage] Native fullscreen left (e.g. Esc pressed)');
      document.body.classList.remove('app-fullscreen');
    });
  }

  // Floating mini widget action controls listener
  if (window.mirrorcast && window.mirrorcast.onMiniWidgetTrigger) {
    if (miniWidgetCleanup) {
      try { miniWidgetCleanup(); } catch (e) {}
      miniWidgetCleanup = null;
    }
    
    miniWidgetCleanup = window.mirrorcast.onMiniWidgetTrigger((action) => {
      console.log('[MirrorPage] Action from mini-widget:', action);
      if (action === 'stop') {
        const btnStop = document.getElementById('btn-stop-mirror');
        if (btnStop) {
          btnStop.click();
        } else {
          webrtcService.stopScreenShare();
          if (currentTargetId) {
            webrtcService.closeConnection(currentTargetId);
          }
          if (window.mirrorcast.hideMiniWidget) {
            window.mirrorcast.hideMiniWidget();
          }
        }
      } else if (action === 'pause') {
        const isPaused = webrtcService.togglePauseScreenShare();
        if (window.mirrorcast.updateMiniWidgetState) {
          window.mirrorcast.updateMiniWidgetState({ isPaused });
        }
        showToast(isPaused ? 'Casting paused' : 'Casting resumed', 'info');
      }
    });
  }
}

function setupTabListeners() {
  const btnShare = document.getElementById('tab-btn-share');
  const btnReceive = document.getElementById('tab-btn-receive');

  if (btnShare && btnReceive) {
    btnShare.addEventListener('click', () => switchTab('share'));
    btnReceive.addEventListener('click', () => switchTab('receive'));
  }
}

async function switchTab(tab) {
  activeTab = tab;
  
  const btnShare = document.getElementById('tab-btn-share');
  const btnReceive = document.getElementById('tab-btn-receive');
  const panel = document.getElementById('mirror-panel-content');

  if (!panel) return;

  if (tab === 'share') {
    if (btnShare) btnShare.className = 'btn btn-primary';
    if (btnReceive) btnReceive.className = 'btn btn-secondary';
    panel.innerHTML = renderShareTab();
    await initShareTab();
  } else {
    if (btnShare) btnShare.className = 'btn btn-secondary';
    if (btnReceive) btnReceive.className = 'btn btn-primary';
    panel.innerHTML = renderReceiveTab();
    await initReceiveTab();
  }
}

// ── SHARE TAB FUNCTIONS ─────────────────────────────────────────────

async function initShareTab() {
  const grid = document.getElementById('sources-grid');
  const btnRefresh = document.getElementById('btn-refresh-sources');
  const btnStart = document.getElementById('btn-start-mirror');
  const btnStop = document.getElementById('btn-stop-mirror');
  const targetSelect = document.getElementById('select-mirror-target');

  const btnConnect = document.getElementById('btn-connect-mirror');
  const inputCode = document.getElementById('input-mirror-code');
  const btnDisconnect = document.getElementById('btn-disconnect-mirror');

  // 1. If connected, retrieve active room devices dynamically to populate select
  const isConnected = socketService.isConnected() && socketService.currentUrl && !socketService.currentUrl.includes('localhost');
  if (isConnected && targetSelect) {
    try {
      const roomDevices = await socketService.getDevices();
      if (roomDevices.length > 0) {
        // Auto-select the first (receiver) device — no empty placeholder
        targetSelect.innerHTML = roomDevices.map((d, i) => 
          `<option value="${d.id}"${i === 0 ? ' selected' : ''}>${d.name} (${d.ip})</option>`
        ).join('');
      } else {
        targetSelect.innerHTML = '<option value="">-- No devices found in room --</option>';
      }
    } catch (err) {
      console.error('[MirrorPage] Failed to fetch room devices:', err);
    }
  }

  const refreshSources = async () => {
    if (!grid) return;
    grid.innerHTML = '<div class="flex-center text-secondary" style="grid-column: span 3; padding: 40px 0;"><svg class="spin" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;"><circle cx="12" cy="12" r="10"/><path d="M12 2v4"/></svg> Scanning sources...</div>';
    
    if (window.mirrorcast) {
      sourcesList = await window.mirrorcast.getSources();
    } else {
      sourcesList = [
        { id: 'screen:0', name: 'Primary Screen', thumbnail: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' }
      ];
    }

    grid.innerHTML = '';
    if (sourcesList.length === 0) {
      grid.innerHTML = '<div class="flex-center text-secondary" style="grid-column: span 3; padding: 40px 0;">No capture sources found. Check capture permissions.</div>';
      return;
    }

    sourcesList.forEach((source) => {
      const isSelected = selectedSourceId === source.id;
      
      const item = document.createElement('div');
      item.className = `card flex column gap-xs cursor-pointer ${isSelected ? 'active' : ''}`;
      item.style.padding = '8px';
      item.style.border = isSelected ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)';
      item.style.borderRadius = 'var(--radius-md)';
      
      item.innerHTML = `
        <div style="aspect-ratio: 16/9; overflow: hidden; border-radius: var(--radius-sm); position: relative; background: #000;">
          <img src="${source.thumbnail}" style="width: 100%; height: 100%; object-fit: cover;" />
        </div>
        <div style="font-size: 0.8rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 4px;" title="${source.name}">${source.name}</div>
      `;

      item.addEventListener('click', () => {
        // Clear previous selection
        const prev = grid.querySelector('.active');
        if (prev) {
          prev.classList.remove('active');
          prev.style.border = '1px solid var(--border-subtle)';
        }
        
        selectedSourceId = source.id;
        item.classList.add('active');
        item.style.border = '2px solid var(--accent-purple)';

        validateCastInputs();
      });

      grid.appendChild(item);
    });
  };

  const validateCastInputs = () => {
    if (selectedSourceId && targetSelect && targetSelect.value) {
      if (btnStart) btnStart.disabled = false;
    } else {
      if (btnStart) btnStart.disabled = true;
    }
  };

  // Check if we're already casting (user navigated away and came back)
  const activeLocalStream = webrtcService.localStream;
  if (activeLocalStream && activeLocalStream.active) {
    // Restore the casting UI state
    const previewBox = document.getElementById('mirror-preview-box');
    const placeholder = document.getElementById('mirror-placeholder');
    const video = document.getElementById('local-mirror-video');

    if (previewBox && placeholder && video) {
      placeholder.style.display = 'none';
      previewBox.style.display = 'block';
      video.srcObject = activeLocalStream;
    }

    if (btnStart) btnStart.style.display = 'none';
    if (btnStop) btnStop.style.display = 'block';

    localMirrorStream = activeLocalStream;
  }

  if (btnRefresh) btnRefresh.addEventListener('click', refreshSources);
  if (targetSelect) targetSelect.addEventListener('change', validateCastInputs);

  // Hook connect button
  if (btnConnect && inputCode) {
    btnConnect.addEventListener('click', async () => {
      const code = inputCode.value.trim();
      if (code.length !== 6 || isNaN(code)) {
        showToast('Please enter a valid 6-digit code', 'warning');
        return;
      }

      btnConnect.disabled = true;
      btnConnect.innerText = 'Connecting...';
      showToast(`Searching for Room ${code} on LAN...`, 'info');
      
      const lanDevices = window.mirrorcast ? await window.mirrorcast.getLanDevices() : [];
      const targetDevice = lanDevices.find(d => d.roomCode === code);
      
      if (targetDevice) {
        showToast(`Found ${targetDevice.name}! Connecting...`, 'info');
        const url = `http://${targetDevice.ip}:${targetDevice.serverPort}`;
        const connected = await socketService.connectToRemote(url, code);
        if (connected) {
          showToast('Connected successfully!', 'success');
          // Re-initialize tab
          await switchTab('share');
        } else {
          btnConnect.disabled = false;
          btnConnect.innerText = 'Connect';
        }
      } else {
        showToast('Room Code not found on local network. Make sure both devices are on the same Wi-Fi/network and ScreenLink is open.', 'warning');
        btnConnect.disabled = false;
        btnConnect.innerText = 'Connect';
      }
    });
  }

  // Hook disconnect button
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', async () => {
      showToast('Disconnecting from receiver...', 'warning');
      await socketService.connectToLocal();
      await switchTab('share');
    });
  }

  // Cast Action
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      currentTargetId = targetSelect.value;
      if (!selectedSourceId || !currentTargetId) return;

      const shareAudioCheckbox = document.getElementById('checkbox-share-audio');
      const shareAudio = shareAudioCheckbox ? shareAudioCheckbox.checked : false;

      try {
        btnStart.disabled = true;
        btnStart.innerText = 'Connecting...';
        
        localMirrorStream = await webrtcService.startScreenShare(selectedSourceId, currentTargetId, shareAudio);
        
        // Show Local Preview box
        const previewBox = document.getElementById('mirror-preview-box');
        const placeholder = document.getElementById('mirror-placeholder');
        const video = document.getElementById('local-mirror-video');
        
        if (previewBox && placeholder && video) {
          placeholder.style.display = 'none';
          previewBox.style.display = 'block';
          video.srcObject = localMirrorStream;
        }

        // Display the floating screen share mini widget on desktop
        if (window.mirrorcast && window.mirrorcast.showMiniWidget) {
          window.mirrorcast.showMiniWidget(false);
        }

        btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'block';
      } catch (err) {
        btnStart.disabled = false;
        btnStart.innerText = 'Cast Screen';
      }
    });
  }

  // Stop Action
  if (btnStop) {
    btnStop.addEventListener('click', () => {
      webrtcService.stopScreenShare();
      if (currentTargetId) {
        webrtcService.closeConnection(currentTargetId);
      }

      // Hide the floating widget from the desktop
      if (window.mirrorcast && window.mirrorcast.hideMiniWidget) {
        window.mirrorcast.hideMiniWidget();
      }

      // Restore button views
      if (btnStop) btnStop.style.display = 'none';
      if (btnStart) {
        btnStart.style.display = 'block';
        btnStart.disabled = false;
        btnStart.innerText = 'Cast Screen';
      }

      const previewBox = document.getElementById('mirror-preview-box');
      const placeholder = document.getElementById('mirror-placeholder');
      const video = document.getElementById('local-mirror-video');
      
      if (previewBox && placeholder && video) {
        video.srcObject = null;
        previewBox.style.display = 'none';
        placeholder.style.display = 'flex';
      }

      showToast('Screen mirror stopped.', 'info');
    });
  }

  // Run initial sources search
  await refreshSources();
  validateCastInputs();
}

function setupRemoteVideoUI(stream) {
  const container = document.getElementById('remote-video-container');
  const video = document.getElementById('remote-mirror-video');
  const placeholder = document.getElementById('receive-placeholder');

  if (container && video && placeholder) {
    placeholder.style.display = 'none';
    container.style.display = 'block';
    video.srcObject = stream;
    video.play().catch(err => console.error('[MirrorPage] Failed to play video stream:', err));

    // Automatically transition to native full screen mode when sharing starts
    if (window.mirrorcast && window.mirrorcast.setFullScreen) {
      document.body.classList.add('app-fullscreen');
      window.mirrorcast.setFullScreen(true);
    }

    // Hover & Mouse-Movement auto-hide reveal controls
    let mouseTimeout = null;
    let isHoveringControls = false;
    const overlay = container.querySelector('.mirror-controls-overlay');

    const showControls = () => {
      if (overlay) overlay.style.opacity = '1';
      container.style.cursor = 'default';
      
      if (mouseTimeout) {
        clearTimeout(mouseTimeout);
      }
      
      if (isHoveringControls) return; // Keep visible if hovering directly on the control panel!
      
      mouseTimeout = setTimeout(() => {
        if (overlay) overlay.style.opacity = '0';
        container.style.cursor = 'none'; // premium cinematic view
      }, 2500);
    };

    if (overlay) {
      overlay.addEventListener('mouseenter', () => {
        isHoveringControls = true;
        if (mouseTimeout) {
          clearTimeout(mouseTimeout);
        }
        overlay.style.opacity = '1';
        container.style.cursor = 'default';
      });

      overlay.addEventListener('mouseleave', () => {
        isHoveringControls = false;
        showControls();
      });
    }

    container.addEventListener('mousemove', showControls);
    container.addEventListener('mouseenter', showControls);

    container.addEventListener('mouseleave', () => {
      if (overlay) overlay.style.opacity = '0';
      container.style.cursor = 'default';
      if (mouseTimeout) {
        clearTimeout(mouseTimeout);
        mouseTimeout = null;
      }
    });

    // Toggle Annotation drawing overlay
    const btnDraw = document.getElementById('btn-toggle-draw');
    if (btnDraw) {
      if (annotator) {
        annotator.disable();
        annotator = null;
      }
      btnDraw.addEventListener('click', () => {
        const overlayTarget = document.getElementById('annotation-overlay-target');
        if (!annotator && overlayTarget) {
          overlayTarget.style.pointerEvents = 'auto';
          annotator = createAnnotationCanvas(overlayTarget);
          annotator.enable();
          btnDraw.classList.add('btn-primary');
          btnDraw.classList.remove('btn-secondary');
          showToast('Annotation tools active', 'success');
        } else if (annotator) {
          annotator.disable();
          const overlayTarget = document.getElementById('annotation-overlay-target');
          if (overlayTarget) {
            overlayTarget.innerHTML = '';
            overlayTarget.style.pointerEvents = 'none';
          }
          annotator = null;
          btnDraw.classList.remove('btn-primary');
          btnDraw.classList.add('btn-secondary');
        }
      });
    }

    // Toggle Aspect Fit / Fill
    const btnFit = document.getElementById('btn-toggle-fit');
    if (btnFit && video) {
      btnFit.addEventListener('click', () => {
        if (video.style.objectFit === 'cover') {
          video.style.objectFit = 'contain';
          btnFit.innerText = 'Fill';
        } else {
          video.style.objectFit = 'cover';
          btnFit.innerText = 'Fit';
        }
      });
    }

    // Fullscreen Toggle Button Control
    const btnFs = document.getElementById('btn-remote-fullscreen');
    if (btnFs) {
      btnFs.addEventListener('click', () => {
        if (window.mirrorcast && window.mirrorcast.setFullScreen) {
          window.mirrorcast.isFullScreen().then((isFS) => {
            if (isFS) {
              document.body.classList.remove('app-fullscreen');
              window.mirrorcast.setFullScreen(false);
              btnFs.innerText = 'Fullscreen';
            } else {
              document.body.classList.add('app-fullscreen');
              window.mirrorcast.setFullScreen(true);
              btnFs.innerText = 'Exit FS';
            }
          });
        } else {
          // Fallback if not inside Electron environment
          if (container.requestFullscreen) {
            container.requestFullscreen();
          }
        }
      });
    }
  }
}

async function initReceiveTab() {
  const activeStream = webrtcService.getRemoteStream();
  if (activeStream) {
    setupRemoteVideoUI(activeStream);
  } else {
    const roomCodeElement = document.getElementById('receive-room-code');
    if (roomCodeElement) {
      roomCodeElement.innerText = '------';
    }
    
    try {
      const code = await socketService.connectToLocal();
      if (roomCodeElement && code) {
        roomCodeElement.innerText = code;
      }
    } catch (err) {
      console.error('[MirrorPage] Error generating fresh room code:', err);
    }
  }
}

export function destroy() {
  if (statsInterval) {
    clearInterval(statsInterval);
    statsInterval = null;
  }
  if (streamCleanup) {
    streamCleanup();
    streamCleanup = null;
  }
  if (statsCleanup) {
    statsCleanup();
    statsCleanup = null;
  }
  if (connectionCleanup) {
    connectionCleanup();
    connectionCleanup = null;
  }
  if (miniWidgetCleanup) {
    try { miniWidgetCleanup(); } catch (e) {}
    miniWidgetCleanup = null;
  }
  if (fullscreenLeftCleanup) {
    try { fullscreenLeftCleanup(); } catch (e) {}
    fullscreenLeftCleanup = null;
  }
  if (window.mirrorcast && window.mirrorcast.hideMiniWidget) {
    window.mirrorcast.hideMiniWidget();
  }
  if (annotator) {
    annotator.disable();
    annotator = null;
  }
}
