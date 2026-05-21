// src/renderer/pages/file-transfer.js — File Transfer Page
// Handles dragging/dropping files, native file select IPC dialogs,
// accept/decline file modals, progress trackers, and speeds.
// Shows available devices with connect/disconnect to target device.

import { fileTransferService } from '../services/file-transfer.js';
import { deviceService } from '../services/device.js';
import { socketService } from '../services/socket.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';

let updateQueueListener = null;
let transferCompleteListener = null;
let devicesChangeListener = null;
let selectedFile = null;

export function render() {
  const isConnected = socketService.isConnected() && socketService.currentUrl && !socketService.currentUrl.includes('localhost');

  return `
    <div class="fade-in-up flex column gap-md" style="height: 100%;">

      <!-- Connection Section -->
      <div class="card flex align-center justify-between" style="padding: 16px 24px;">
        <div class="flex align-center gap-md">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent-purple);">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 12 15 15"/>
          </svg>
          <div>
            <div style="font-weight: 600; font-size: 1.1rem;">File Transfer</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Send and receive files securely over LAN</div>
          </div>
        </div>
        <div class="flex align-center gap-sm">
          ${isConnected 
            ? `<span class="badge badge-success">Connected</span>
               <button id="btn-ft-disconnect" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.75rem;">Disconnect</button>`
            : '<span class="badge badge-warning">Not Connected</span>'
          }
        </div>
      </div>

      ${!isConnected ? renderDevicesList() : renderTransferUI()}
    </div>
  `;
}

function renderDevicesList() {
  return `
    <!-- Available Devices to Connect -->
    <div class="card flex column gap-md" style="flex-grow: 1; min-height: 400px;">
      <div class="card-header">
        <div class="card-title flex align-center gap-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5.636 18.364a9 9 0 0 1 0-12.728"/>
            <path d="M18.364 5.636a9 9 0 0 1 0 12.728"/>
            <path d="M8.464 15.536a5 5 0 0 1 0-7.072"/>
            <path d="M15.536 8.464a5 5 0 0 1 0 7.072"/>
            <circle cx="12" cy="12" r="1"/>
          </svg>
          <span>Select a device to connect</span>
        </div>
        <button id="btn-ft-refresh" class="btn btn-secondary" style="padding: 6px 14px; font-size: 0.75rem;">Refresh</button>
      </div>

      <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.5;">
        Connect to a nearby device to start sending or receiving files. The target device will need to accept your connection request.
      </p>

      <div id="ft-devices-list" class="flex column gap-sm" style="flex-grow: 1; overflow-y: auto; max-height: calc(100vh - 360px);">
        <div class="flex column flex-center gap-sm" style="color: var(--text-tertiary); padding: 40px 0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; animation: pulse 2s infinite;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <div style="font-size: 0.9rem;">Scanning for devices...</div>
        </div>
      </div>
    </div>
  `;
}

function renderTransferUI() {
  const devices = deviceService.getDevices();
  const options = devices.map(d => `<option value="${d.id}">${d.name} (${d.ip})</option>`).join('');

  return `
    <div class="grid grid-3" style="flex-grow: 1;">
      <!-- Upload area & targets (2/3 width) -->
      <div class="card flex column gap-md" style="grid-column: span 2; min-height: 420px;">
        <div class="card-title">Send Files</div>

        <!-- Drag & Drop Zone -->
        <div id="drop-zone" class="drop-zone flex column flex-center gap-md" style="flex-grow: 1; min-height: 200px; cursor: pointer;">
          <div class="drop-zone-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div>
            <div style="font-size: 1rem; font-weight: 600; margin-bottom: 4px;" id="drop-zone-text">Drag files here or click to browse</div>
            <div style="font-size: 0.8rem; color: var(--text-tertiary);">Supports any files up to 100MB</div>
          </div>
        </div>

        <!-- File properties row -->
        <div id="selected-file-row" style="display: none; padding: 12px 16px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); justify-content: space-between; align-items: center;">
          <div class="flex align-center gap-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-purple);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style="font-size: 0.9rem; font-weight: 500;" id="label-selected-name">file.txt</div>
            <div style="font-size: 0.8rem; color: var(--text-tertiary);" id="label-selected-size">0 KB</div>
          </div>
          <button id="btn-clear-file" class="btn-icon" style="background: none; border: none; color: var(--error); cursor: pointer;">&#x2715;</button>
        </div>

        <!-- Select Target -->
        <div class="grid grid-2 align-center">
          <div class="flex column gap-xs">
            <label style="font-size: 0.8rem; color: var(--text-secondary);">Target Device</label>
            <select id="select-file-target" class="input" style="width: 100%;">
              ${options.length > 0 ? options : '<option value="">-- No devices available --</option>'}
            </select>
          </div>

          <div style="text-align: right; margin-top: 18px;">
            <button id="btn-send-file" class="btn btn-primary" style="padding: 10px 32px;" disabled>Send File</button>
          </div>
        </div>
      </div>

      <!-- Queue & History Panel (1/3 width) -->
      <div class="card flex column gap-md" style="min-height: 420px;">
        <div class="card-title">Transfer Status</div>
        
        <div id="transfer-queue-box" class="flex column gap-sm" style="flex-grow: 1; overflow-y: auto; max-height: 380px;">
          <!-- Active list -->
          <div class="text-center text-tertiary" style="padding: 40px 0; font-size: 0.85rem;">No active transfers</div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const isConnected = socketService.isConnected() && socketService.currentUrl && !socketService.currentUrl.includes('localhost');

  // Disconnect button
  const btnDisconnect = document.getElementById('btn-ft-disconnect');
  if (btnDisconnect) {
    btnDisconnect.addEventListener('click', async () => {
      showToast('Disconnecting...', 'warning');
      await socketService.connectToLocal();
      // Re-render page
      const contentEl = document.getElementById('content');
      if (contentEl) {
        contentEl.innerHTML = render();
        init();
      }
    });
  }

  if (!isConnected) {
    // Show device list with connect buttons
    await initDevicesList();
    return;
  }

  // Connected — initialize transfer UI
  initTransferUI();
}

async function initDevicesList() {
  const btnRefresh = document.getElementById('btn-ft-refresh');
  const listEl = document.getElementById('ft-devices-list');

  const refreshList = async () => {
    if (!listEl) return;

    let lanDevices = [];
    if (window.mirrorcast && window.mirrorcast.getLanDevices) {
      lanDevices = await window.mirrorcast.getLanDevices();
    }

    const localDevice = deviceService.getLocalDevice();
    const localIp = localDevice ? localDevice.ip : '127.0.0.1';

    // Filter out self
    const filtered = lanDevices.filter(d => d.ip !== localIp);

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div class="flex column flex-center gap-sm" style="color: var(--text-tertiary); padding: 40px 0;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; animation: pulse 2s infinite;"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
          <div style="font-size: 0.9rem;">No devices found nearby</div>
          <div style="font-size: 0.8rem; margin-top: 4px;">Make sure other devices are on the same network with ScreenLink open</div>
        </div>
      `;
      return;
    }

    listEl.innerHTML = '';
    filtered.forEach(device => {
      const card = document.createElement('div');
      card.className = 'device-card card flex align-center gap-md';
      card.style.padding = '14px 18px';
      card.style.cursor = 'pointer';

      const platformIcon = deviceService.getPlatformIcon(device.platform);

      card.innerHTML = `
        <div class="device-avatar flex-center" style="width: 44px; height: 44px; border-radius: var(--radius-md); background: var(--accent-gradient); color: #fff;">
          ${platformIcon}
        </div>
        <div class="device-info" style="flex-grow: 1;">
          <div class="device-name" style="font-weight: 500; font-size: 0.95rem;">${device.name}</div>
          <div class="device-status" style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 2px;">
            ${device.ip} ${device.roomCode ? '• Room: ' + device.roomCode : ''}
          </div>
        </div>
        <button class="btn btn-primary btn-connect-ft" data-ip="${device.ip}" data-port="${device.serverPort}" data-code="${device.roomCode || ''}" style="padding: 8px 20px; font-size: 0.8rem;">
          Connect
        </button>
      `;

      // Connect handler
      const btn = card.querySelector('.btn-connect-ft');
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.innerText = 'Connecting...';

        try {
          const url = `http://${device.ip}:${device.serverPort}`;
          const connected = await socketService.connectToRemote(url, device.roomCode);
          if (connected) {
            showToast(`Connected to ${device.name}!`, 'success');
            // Re-render page with transfer UI
            const contentEl = document.getElementById('content');
            if (contentEl) {
              contentEl.innerHTML = render();
              init();
            }
          } else {
            showToast(`Failed to connect to ${device.name}`, 'error');
            btn.disabled = false;
            btn.innerText = 'Connect';
          }
        } catch (err) {
          showToast('Connection error', 'error');
          btn.disabled = false;
          btn.innerText = 'Connect';
        }
      });

      listEl.appendChild(card);
    });
  };

  await refreshList();

  if (btnRefresh) btnRefresh.addEventListener('click', refreshList);

  // Listen for device changes
  devicesChangeListener = deviceService.onDevicesChange(() => refreshList());
}

function initTransferUI() {
  const dropZone = document.getElementById('drop-zone');
  const btnClear = document.getElementById('btn-clear-file');
  const btnSend = document.getElementById('btn-send-file');
  const targetSelect = document.getElementById('select-file-target');

  const validateTransfer = () => {
    if (selectedFile && targetSelect && targetSelect.value) {
      if (btnSend) btnSend.disabled = false;
    } else {
      if (btnSend) btnSend.disabled = true;
    }
  };

  const clearSelection = () => {
    selectedFile = null;
    const fileRow = document.getElementById('selected-file-row');
    if (fileRow) fileRow.style.display = 'none';
    if (dropZone) dropZone.style.display = 'flex';
    validateTransfer();
  };

  const handleSelectedFile = (file) => {
    selectedFile = file;
    
    const fileRow = document.getElementById('selected-file-row');
    const nameEl = document.getElementById('label-selected-name');
    const sizeEl = document.getElementById('label-selected-size');
    
    if (fileRow && nameEl && sizeEl) {
      nameEl.innerText = file.name;
      sizeEl.innerText = formatBytes(file.size);
      
      if (dropZone) dropZone.style.display = 'none';
      fileRow.style.display = 'flex';
    }
    
    validateTransfer();
  };

  // Browse File Action
  if (dropZone) {
    dropZone.addEventListener('click', async () => {
      if (window.mirrorcast) {
        const file = await window.mirrorcast.selectFile();
        if (file) {
          handleSelectedFile({
            name: file.name,
            size: file.size,
            data: file.data,
            type: 'application/octet-stream'
          });
        }
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = (e) => {
          const file = e.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = () => {
              handleSelectedFile({
                name: file.name,
                size: file.size,
                data: reader.result,
                type: file.type
              });
            };
            reader.readAsArrayBuffer(file);
          }
        };
        input.click();
      }
    });
  }

  // Clear Selection
  if (btnClear) btnClear.addEventListener('click', clearSelection);
  if (targetSelect) targetSelect.addEventListener('change', validateTransfer);

  // Send Action
  if (btnSend) {
    btnSend.addEventListener('click', async () => {
      const targetId = targetSelect.value;
      const targetName = targetSelect.options[targetSelect.selectedIndex].text;
      
      if (!selectedFile || !targetId) return;

      try {
        btnSend.disabled = true;
        btnSend.innerText = 'Requesting...';
        
        fileTransferService.requestSendFile(targetId, targetName, selectedFile);
      } catch (err) {
        showToast('Connection issue', 'error');
        btnSend.disabled = false;
        btnSend.innerText = 'Send File';
      }
    });
  }

  // Subscribe to persistent service transfer complete updates
  transferCompleteListener = fileTransferService.onTransferComplete((item) => {
    if (btnSend) {
      btnSend.disabled = false;
      btnSend.innerText = 'Send File';
    }
    if (item.status === 'completed' || item.status === 'declined' || item.status === 'failed') {
      clearSelection();
    }
  });

  // Render/Update active transfers queue
  const refreshQueue = (queue) => {
    const box = document.getElementById('transfer-queue-box');
    if (!box) return;

    const history = fileTransferService.getHistory();
    const items = [...queue, ...history];

    if (items.length === 0) {
      box.innerHTML = '<div class="text-center text-tertiary" style="padding: 40px 0; font-size: 0.85rem;">No active transfers</div>';
      return;
    }

    box.innerHTML = '';
    items.forEach((item) => {
      const isSending = item.direction === 'sending';
      const speedVal = item.speed ? `${formatSpeed(item.speed)}/s` : '';
      const statLabel = item.status === 'transferring' ? `${item.progress}% ${speedVal}` : item.status.toUpperCase();
      
      const row = document.createElement('div');
      row.className = 'transfer-item card flex align-center gap-md';
      row.style.padding = '12px';
      row.style.marginBottom = '8px';
      
      row.innerHTML = `
        <div class="transfer-icon flex-center" style="width: 36px; height: 36px; border-radius: 50%; background: ${isSending ? 'rgba(145, 90, 255, 0.1)' : 'rgba(63, 185, 255, 0.1)'}; color: ${isSending ? 'var(--accent-purple)' : 'var(--accent-blue)'};">
          ${isSending 
            ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>'
            : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>'
          }
        </div>
        <div class="transfer-info" style="flex-grow: 1; overflow: hidden;">
          <div style="font-size: 0.85rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</div>
          <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
            ${isSending ? 'To' : 'From'}: <strong>${item.targetName}</strong> (${formatBytes(item.size)})
          </div>
          ${item.status === 'transferring' 
            ? `<div class="progress-bar" style="margin-top: 8px;"><div class="progress-fill" style="width: ${item.progress}%;"></div></div>`
            : ''
          }
        </div>
        <div style="text-align: right;">
          <span class="badge ${item.status === 'completed' ? 'badge-success' : item.status === 'failed' ? 'badge-error' : 'badge-info'}" style="font-size: 0.65rem;">
            ${statLabel}
          </span>
          ${item.status === 'transferring'
            ? `<button class="btn-cancel" data-id="${item.id}" style="display: block; margin-top: 4px; font-size: 0.6rem; color: var(--error); background: none; border: none; cursor: pointer;">Cancel</button>`
            : ''
          }
        </div>
      `;

      const btnCancel = row.querySelector('.btn-cancel');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => {
          fileTransferService.cancelTransfer(item.id);
        });
      }

      box.appendChild(row);
    });
  };

  // Run initial queue render
  refreshQueue(fileTransferService.getQueue());

  // Listen for progress updates
  updateQueueListener = fileTransferService.onQueueUpdate((queue) => {
    refreshQueue(queue);
  });

  // Auto-select first target if available
  if (targetSelect && targetSelect.options.length > 0 && targetSelect.options[0].value) {
    targetSelect.selectedIndex = 0;
  }
  validateTransfer();
}

// Helper formats
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSec) {
  return formatBytes(bytesPerSec);
}

export function destroy() {
  if (updateQueueListener) {
    updateQueueListener();
    updateQueueListener = null;
  }
  if (transferCompleteListener) {
    transferCompleteListener();
    transferCompleteListener = null;
  }
  if (devicesChangeListener) {
    devicesChangeListener();
    devicesChangeListener = null;
  }
}
