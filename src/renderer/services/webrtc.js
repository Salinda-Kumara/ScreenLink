// src/renderer/services/webrtc.js — WebRTC Peer-to-Peer Manager
// Manages screen/camera capture, media streams, data channels for files,
// and handle P2P WebRTC connection lifecycle.

import { socketService } from './socket.js';
import { showToast } from '../components/toast.js';

class WebRTCService {
  constructor() {
    // targetId (string) -> RTCPeerConnection
    this.connections = new Map();
    // targetId (string) -> RTCDataChannel
    this.dataChannels = new Map();
    
    this.socket = null;
    this.localStream = null;
    this.localCameraStream = null;
    this.remoteStream = null;

    // Listeners
    this.streamListeners = new Set();
    this.fileProgressListeners = new Set();
    this.fileReceivedListeners = new Set();
    this.connectionStateListeners = new Set();
    this.statsListeners = new Set();

    // File transfer reception temp state: targetId -> { metadata, chunks: [], receivedSize: 0 }
    this.incomingFiles = new Map();

    // ICE Servers (Google STUN)
    this.rtcConfig = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    };
  }

  /**
   * Initialize with socket signaling.
   */
  init() {
    this.socket = socketService;

    // Hook into socket signaling events
    this.socket.on('offer', async (data) => {
      await this.handleOffer(data.callerId, data.sdp);
    });

    this.socket.on('answer', async (data) => {
      await this.handleAnswer(data.answererId, data.sdp);
    });

    this.socket.on('ice-candidate', async (data) => {
      await this.handleIceCandidate(data.senderId, data.candidate);
    });

    this.socket.on('device-left', (data) => {
      if (data && data.id) {
        console.log(`[WebRTC] Peer device left: ${data.id}. Closing connection.`);
        this.closeConnection(data.id);
      }
    });
  }

  /**
   * Create or retrieve an RTCPeerConnection for a target device.
   * @param {string} targetId
   * @returns {RTCPeerConnection}
   */
  createConnection(targetId) {
    if (this.connections.has(targetId)) {
      return this.connections.get(targetId);
    }

    console.log(`[WebRTC] Creating RTCPeerConnection for device ${targetId}`);
    const pc = new RTCPeerConnection(this.rtcConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.sendIceCandidate(targetId, event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state change for ${targetId}: ${pc.connectionState}`);
      this.triggerConnectionStateChange(targetId, pc.connectionState);

      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closeConnection(targetId);
      }
    };

    // When remote media track arrives
    pc.ontrack = (event) => {
      console.log(`[WebRTC] Received remote stream track from ${targetId}`);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.triggerStream(targetId, event.streams[0]);
      }
    };

    // When remote creates a data channel (receiver side)
    pc.ondatachannel = (event) => {
      const channel = event.channel;
      if (channel.label === 'fileTransfer') {
        console.log(`[WebRTC] Incoming file transfer data channel established for ${targetId}`);
        this.setupDataChannel(targetId, channel);
      }
    };

    this.connections.set(targetId, pc);

    // Setup performance stats checking loop
    this.startStatsMonitor(targetId, pc);

    return pc;
  }

  /**
   * Close a specific connection and clean up.
   * @param {string} targetId
   */
  closeConnection(targetId) {
    console.log(`[WebRTC] Closing peer connection with ${targetId}`);
    
    const dc = this.dataChannels.get(targetId);
    if (dc) {
      try { dc.close(); } catch(e) {}
      this.dataChannels.delete(targetId);
    }

    const pc = this.connections.get(targetId);
    if (pc) {
      try { pc.close(); } catch(e) {}
      this.connections.delete(targetId);
    }

    this.remoteStream = null;
    this.incomingFiles.delete(targetId);
    this.triggerConnectionStateChange(targetId, 'closed');
  }

  closeAll() {
    for (const targetId of this.connections.keys()) {
      this.closeConnection(targetId);
    }
    this.stopScreenShare();
    this.stopCameraShare();
  }

  /**
   * Screen Capturer for Electron/Browser P2P.
   * @param {string} sourceId — screen/window source ID from desktopCapturer
   * @param {string} targetId — peer socket ID to send to
   */
  async startScreenShare(sourceId, targetId, shareAudio = false) {
    try {
      this.stopScreenShare();

      console.log(`[WebRTC] Requesting screen share capture for sourceId: ${sourceId}, shareAudio: ${shareAudio}`);
      
      const constraints = {
        audio: shareAudio ? {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
          }
        } : false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId,
            minWidth: 1280,
            maxWidth: 1920,
            minHeight: 720,
            maxHeight: 1080,
            minFrameRate: 15,
            maxFrameRate: 30,
          }
        }
      };

      // In Electron desktop environment, we use getDisplayMedia or custom getUserMedia with constraints.
      // chromeMediaSource is standard in Electron for desktopCapturer.
      // Implement a robust fallback in case audio capture fails.
      try {
        this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (audioErr) {
        if (shareAudio) {
          console.warn('[WebRTC] Screen capture with audio failed, falling back to video only:', audioErr);
          showToast('Audio share not supported for this source. Casting video only.', 'warning');
          constraints.audio = false;
          this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
        } else {
          throw audioErr;
        }
      }
      console.log('[WebRTC] Got local screen capture stream');

      const pc = this.createConnection(targetId);

      // Add local stream tracks to PeerConnection
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });

      // Create WebRTC Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.sendOffer(targetId, pc.localDescription);
      
      showToast('Screen mirroring started!', 'success');
      return this.localStream;
    } catch (err) {
      console.error('[WebRTC] Screen share failed:', err);
      showToast(`Mirroring failed: ${err.message}`, 'error');
      throw err;
    }
  }

  stopScreenShare() {
    if (this.localStream) {
      console.log('[WebRTC] Stopping local screen share tracks');
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }

  /**
   * Toggles the enabled state of all tracks in the local screen share stream (pausing/resuming).
   * @returns {boolean} - the new paused state (true = paused, false = active)
   */
  togglePauseScreenShare() {
    if (!this.localStream) return false;

    const tracks = this.localStream.getTracks();
    if (tracks.length === 0) return false;

    // Check current state based on the first track
    const isCurrentlyPaused = !tracks[0].enabled;
    const newPausedState = !isCurrentlyPaused;

    // Toggle all tracks (e.g. video & audio) to the opposite state
    tracks.forEach(track => {
      track.enabled = isCurrentlyPaused; // If disabled, enable it (resume); if enabled, disable it (pause)
    });

    console.log(`[WebRTC] Local tracks set to enabled: ${isCurrentlyPaused}. New paused state: ${newPausedState}`);
    return newPausedState;
  }

  /**
   * Queries if the screen share is currently paused.
   * @returns {boolean}
   */
  isScreenSharePaused() {
    if (!this.localStream) return false;
    const tracks = this.localStream.getTracks();
    if (tracks.length === 0) return false;
    return !tracks[0].enabled;
  }

  /**
   * Camera Mirroring.
   */
  async startCameraShare(deviceId, targetId) {
    try {
      this.stopCameraShare();

      console.log(`[WebRTC] Requesting camera capture for deviceId: ${deviceId}`);
      const constraints = {
        audio: true,
        video: deviceId ? { deviceId: { exact: deviceId } } : true
      };

      this.localCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('[WebRTC] Got local camera stream');

      const pc = this.createConnection(targetId);

      this.localCameraStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localCameraStream);
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.socket.sendOffer(targetId, pc.localDescription);
      
      showToast('Camera streaming started!', 'success');
      return this.localCameraStream;
    } catch (err) {
      console.error('[WebRTC] Camera share failed:', err);
      showToast(`Camera capture failed: ${err.message}`, 'error');
      throw err;
    }
  }

  stopCameraShare() {
    if (this.localCameraStream) {
      console.log('[WebRTC] Stopping local camera stream tracks');
      this.localCameraStream.getTracks().forEach(track => track.stop());
      this.localCameraStream = null;
    }
  }

  /**
   * Create DataChannel and initiate file transfer.
   */
  async sendFile(targetId, fileMeta, fileDataBuffer, onProgress) {
    try {
      const pc = this.createConnection(targetId);
      
      // Create data channel if not exists
      let dc = this.dataChannels.get(targetId);
      if (!dc) {
        dc = pc.createDataChannel('fileTransfer', { ordered: true });
        this.setupDataChannel(targetId, dc);
        this.dataChannels.set(targetId, dc);
      }

      // If connection not established, negotiate
      if (pc.iceConnectionState === 'new') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.socket.sendOffer(targetId, pc.localDescription);
      }

      // Wait for data channel to open
      if (dc.readyState !== 'open') {
        console.log('[WebRTC] Waiting for file DataChannel to open...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('DataChannel open timeout')), 10000);
          dc.onopen = () => {
            clearTimeout(timeout);
            resolve();
          };
        });
      }

      console.log('[WebRTC] DataChannel open. Sending file chunks...');

      // Send File Metadata
      dc.send(JSON.stringify({
        type: 'meta',
        name: fileMeta.name,
        size: fileMeta.size,
        mimeType: fileMeta.mimeType || 'application/octet-stream'
      }));

      // Chunk file into 64KB pieces
      const CHUNK_SIZE = 64 * 1024; // 64KB
      const rawData = fileDataBuffer;
      let offset = 0;

      const sendChunk = () => {
        while (offset < rawData.length) {
          // Check bufferedAmount limit (avoid WebRTC congestion)
          if (dc.bufferedAmount > 16 * 1024 * 1024) { // 16MB limit
            setTimeout(sendChunk, 50);
            return;
          }

          const end = Math.min(offset + CHUNK_SIZE, rawData.length);
          const chunk = rawData.slice(offset, end);
          dc.send(chunk);
          
          offset = end;
          if (onProgress) {
            onProgress(offset, rawData.length);
          }
        }

        // File transfer completed
        dc.send(JSON.stringify({ type: 'end' }));
        console.log(`[WebRTC] Sent file completely: ${fileMeta.name}`);
      };

      sendChunk();

    } catch (err) {
      console.error('[WebRTC] File send failed:', err);
      showToast(`File send failed: ${err.message}`, 'error');
      throw err;
    }
  }

  // ── Connection Handlers ───────────────────────────────────────────

  async handleOffer(callerId, sdp) {
    try {
      console.log(`[WebRTC] Handling incoming offer from ${callerId}`);
      const pc = this.createConnection(callerId);
      
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.sendAnswer(callerId, pc.localDescription);
    } catch (err) {
      console.error('[WebRTC] Handle offer failed:', err);
    }
  }

  async handleAnswer(answererId, sdp) {
    try {
      console.log(`[WebRTC] Handling incoming answer from ${answererId}`);
      const pc = this.connections.get(answererId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
    } catch (err) {
      console.error('[WebRTC] Handle answer failed:', err);
    }
  }

  async handleIceCandidate(senderId, candidate) {
    try {
      const pc = this.connections.get(senderId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('[WebRTC] Failed to add ICE candidate:', err);
    }
  }

  // ── DataChannel Setups ─────────────────────────────────────────────

  setupDataChannel(targetId, channel) {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log(`[WebRTC] Data channel with ${targetId} opened`);
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel with ${targetId} closed`);
    };

    channel.onerror = (error) => {
      console.error(`[WebRTC] Data channel error with ${targetId}:`, error);
    };

    // Receive incoming data chunks/messages
    channel.onmessage = (event) => {
      const { data } = event;

      // Handle Text message (JSON Metadata)
      if (typeof data === 'string') {
        try {
          const msg = JSON.parse(data);
          if (msg.type === 'meta') {
            console.log(`[WebRTC] File incoming metadata from ${targetId}:`, msg);
            this.incomingFiles.set(targetId, {
              metadata: msg,
              chunks: [],
              receivedSize: 0
            });
            this.triggerFileProgress(targetId, 0, msg.size);
          } else if (msg.type === 'end') {
            console.log(`[WebRTC] File incoming end from ${targetId}`);
            this.assembleAndTriggerFile(targetId);
          }
        } catch (e) {
          console.error('[WebRTC] Failed to parse message string:', e);
        }
      } 
      // Handle Binary message (Chunk)
      else if (data instanceof ArrayBuffer) {
        const transfer = this.incomingFiles.get(targetId);
        if (transfer) {
          transfer.chunks.push(data);
          transfer.receivedSize += data.byteLength;
          this.triggerFileProgress(targetId, transfer.receivedSize, transfer.metadata.size);
        } else {
          console.error('[WebRTC] Received binary chunk but no active metadata transfer found!');
        }
      }
    };
  }

  assembleAndTriggerFile(targetId) {
    const transfer = this.incomingFiles.get(targetId);
    if (!transfer) return;

    console.log(`[WebRTC] Reassembling file of size: ${transfer.receivedSize} bytes`);
    
    // Create combined Blob
    const blob = new Blob(transfer.chunks, { type: transfer.metadata.mimeType });
    const file = {
      name: transfer.metadata.name,
      size: transfer.receivedSize,
      mimeType: transfer.metadata.mimeType,
      blob: blob
    };

    // Trigger listeners
    this.triggerFileReceived(targetId, file);
    
    // Clean up
    this.incomingFiles.delete(targetId);
  }

  // ── Performance Monitor (GetStats) ────────────────────────────────

  startStatsMonitor(targetId, pc) {
    const checkStats = async () => {
      if (!this.connections.has(targetId) || pc.signalingState === 'closed') {
        return;
      }

      try {
        const stats = await pc.getStats();
        let resolution = 'N/A';
        let fps = 'N/A';
        let bitrate = '0 Kbps';
        let latency = '0 ms';

        stats.forEach((report) => {
          // Video stats
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight) {
              resolution = `${report.frameWidth}x${report.frameHeight}`;
            }
            if (report.framesPerSecond) {
              fps = Math.round(report.framesPerSecond);
            }
            if (report.bytesReceived) {
              // Bitrate since last read could be calculated, simple placeholder/approximation
              bitrate = `${Math.round((report.bytesReceived * 8) / 1024 / 1024)} Mbps`;
            }
          }
          // Candidate-pair stats for round trip latency
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (report.currentRoundTripTime) {
              latency = `${Math.round(report.currentRoundTripTime * 1000)} ms`;
            }
          }
        });

        this.triggerStats(targetId, {
          resolution,
          fps,
          bitrate,
          latency
        });

        setTimeout(checkStats, 2000);
      } catch (err) {
        console.error('[WebRTC] Stats failed:', err);
      }
    };

    setTimeout(checkStats, 2000);
  }

  // ── Listener Triggers ──────────────────────────────────────────────

  onRemoteStream(callback) {
    this.streamListeners.add(callback);
    return () => this.streamListeners.delete(callback);
  }

  onFileProgress(callback) {
    this.fileProgressListeners.add(callback);
    return () => this.fileProgressListeners.delete(callback);
  }

  onFileReceived(callback) {
    this.fileReceivedListeners.add(callback);
    return () => this.fileReceivedListeners.delete(callback);
  }

  onConnectionStateChange(callback) {
    this.connectionStateListeners.add(callback);
    return () => this.connectionStateListeners.delete(callback);
  }

  onStats(callback) {
    this.statsListeners.add(callback);
    return () => this.statsListeners.delete(callback);
  }

  triggerStream(targetId, stream) {
    for (const cb of this.streamListeners) cb(targetId, stream);
  }

  triggerFileProgress(targetId, received, total) {
    for (const cb of this.fileProgressListeners) cb(targetId, received, total);
  }

  triggerFileReceived(targetId, file) {
    for (const cb of this.fileReceivedListeners) cb(targetId, file);
  }

  triggerConnectionStateChange(targetId, state) {
    for (const cb of this.connectionStateListeners) cb(targetId, state);
  }

  triggerStats(targetId, stats) {
    for (const cb of this.statsListeners) cb(targetId, stats);
  }

  getConnections() {
    return this.connections;
  }

  getRemoteStream() {
    return this.remoteStream;
  }
}

export const webrtcService = new WebRTCService();
