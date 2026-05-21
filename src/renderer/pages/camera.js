// src/renderer/pages/camera.js — Camera Mirroring Page
// Integrates client webcams, camera select options, live stream casting
// via WebRTC to peers, and snapshot capturing features.

import { webrtcService } from '../services/webrtc.js';
import { deviceService } from '../services/device.js';
import { showToast } from '../components/toast.js';

let localCamStream = null;
let currentTargetId = null;

export function render() {
  const devices = deviceService.getDevices();
  const options = devices.map(d => `<option value="${d.id}">${d.name} (${d.ip})</option>`).join('');

  return `
    <div class="fade-in-up grid grid-3" style="height: 100%;">
      <!-- Camera Preview Area (2/3 width) -->
      <div class="card flex column" style="grid-column: span 2; min-height: 480px; position: relative;">
        <div class="card-header" style="margin-bottom: 16px;">
          <div class="card-title">Live Camera Capture</div>
          <div class="flex gap-sm">
            <button id="btn-flip-cam" class="btn btn-secondary flex align-center gap-xs" style="padding: 6px 12px; font-size: 0.8rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
              Mirror View
            </button>
            <button id="btn-snapshot" class="btn btn-secondary flex align-center gap-xs" style="padding: 6px 12px; font-size: 0.8rem;" disabled>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M14.31 8l5.74 9.94M9.69 8h11.48M7.38 12l5.74-9.94M9.69 16L3.95 6.06M14.31 16H2.83M16.62 12l-5.74 9.94"/></svg>
              Snapshot
            </button>
          </div>
        </div>

        <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center;" class="glass">
          <div id="camera-video-container" class="video-container" style="display: none; width: 100%; border-radius: var(--radius-md);">
            <video id="camera-mirror-video" autoplay muted style="transform: scaleX(-1);"></video>
          </div>

          <div id="camera-placeholder" style="color: var(--text-tertiary);" class="flex column flex-center gap-sm text-center">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            <div style="font-size: 0.85rem; max-width: 250px; margin-top: 10px;">Select webcam and target to begin broadcasting camera feed.</div>
          </div>
        </div>
      </div>

      <!-- Settings & Controls Panel (1/3 width) -->
      <div class="card flex column gap-md" style="min-height: 480px;">
        <div class="card-title">Setup Camera Stream</div>
        
        <div class="flex column gap-sm">
          <label style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">Select Camera</label>
          <select id="select-camera-source" class="input" style="width: 100%;">
            <option value="">-- Choose webcam --</option>
          </select>
        </div>

        <div class="flex column gap-sm">
          <label style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">Select Target Receiver</label>
          <select id="select-camera-target" class="input" style="width: 100%;">
            <option value="">-- Choose target device --</option>
            ${options}
          </select>
        </div>

        <div style="flex-grow: 1;"></div>

        <div class="flex gap-sm">
          <button id="btn-start-camera" class="btn btn-primary" style="flex-grow: 1;" disabled>Start Stream</button>
          <button id="btn-stop-camera" class="btn btn-danger" style="display: none; flex-grow: 1;">Stop Stream</button>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const camSelect = document.getElementById('select-camera-source');
  const targetSelect = document.getElementById('select-camera-target');
  const btnStart = document.getElementById('btn-start-camera');
  const btnStop = document.getElementById('btn-stop-camera');
  const btnFlip = document.getElementById('btn-flip-cam');
  const btnSnap = document.getElementById('btn-snapshot');
  const video = document.getElementById('camera-mirror-video');

  const populateCameras = async () => {
    if (!camSelect) return;
    try {
      // Trigger camera permission
      await navigator.mediaDevices.getUserMedia({ video: true }).then(s => s.getTracks().forEach(t => t.stop()));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      camSelect.innerHTML = '<option value="">-- Choose webcam --</option>';
      videoDevices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `Camera ${index + 1}`;
        camSelect.appendChild(option);
      });
    } catch (err) {
      console.error('[CameraPage] Failed to enumerate webcams:', err);
      showToast('Camera capture permission denied', 'warning');
    }
  };

  const validateInputs = () => {
    if (camSelect && targetSelect && camSelect.value && targetSelect.value) {
      if (btnStart) btnStart.disabled = false;
    } else {
      if (btnStart) btnStart.disabled = true;
    }
  };

  if (camSelect) camSelect.addEventListener('change', validateInputs);
  if (targetSelect) targetSelect.addEventListener('change', validateInputs);

  // Flip Cam
  if (btnFlip && video) {
    let flipped = true;
    btnFlip.addEventListener('click', () => {
      flipped = !flipped;
      video.style.transform = flipped ? 'scaleX(-1)' : 'scaleX(1)';
    });
  }

  // Snapshot
  if (btnSnap && video) {
    btnSnap.addEventListener('click', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');

      // Mirror snap if flipped
      if (video.style.transform === 'scaleX(-1)') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Download PNG
      const link = document.createElement('a');
      link.download = `snapshot-${Date.now()}.png`;
      link.href = canvas.toDataURL();
      link.click();
      showToast('Snapshot saved!', 'success');
    });
  }

  // Start Cam Mirror
  if (btnStart) {
    btnStart.addEventListener('click', async () => {
      const camId = camSelect.value;
      currentTargetId = targetSelect.value;
      if (!camId || !currentTargetId) return;

      try {
        btnStart.disabled = true;
        btnStart.innerText = 'Connecting...';
        
        localCamStream = await webrtcService.startCameraShare(camId, currentTargetId);
        
        const previewBox = document.getElementById('camera-video-container');
        const placeholder = document.getElementById('camera-placeholder');
        
        if (previewBox && placeholder && video) {
          placeholder.style.display = 'none';
          previewBox.style.display = 'block';
          video.srcObject = localCamStream;
        }

        if (btnSnap) btnSnap.disabled = false;
        btnStart.style.display = 'none';
        if (btnStop) btnStop.style.display = 'block';
      } catch (err) {
        btnStart.disabled = false;
        btnStart.innerText = 'Start Stream';
      }
    });
  }

  // Stop Cam Mirror
  if (btnStop) {
    btnStop.addEventListener('click', () => {
      webrtcService.stopCameraShare();
      if (currentTargetId) {
        webrtcService.closeConnection(currentTargetId);
      }

      if (btnStop) btnStop.style.display = 'none';
      if (btnStart) {
        btnStart.style.display = 'block';
        btnStart.disabled = false;
        btnStart.innerText = 'Start Stream';
      }

      if (btnSnap) btnSnap.disabled = true;

      const previewBox = document.getElementById('camera-video-container');
      const placeholder = document.getElementById('camera-placeholder');
      
      if (previewBox && placeholder && video) {
        video.srcObject = null;
        previewBox.style.display = 'none';
        placeholder.style.display = 'flex';
      }

      showToast('Camera mirroring stopped.', 'info');
    });
  }

  await populateCameras();
}

export function destroy() {
  webrtcService.stopCameraShare();
}
