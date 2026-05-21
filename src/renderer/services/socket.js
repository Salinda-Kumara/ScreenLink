// src/renderer/services/socket.js — Socket.io Client Wrapper
// Manages the connection to the built-in signaling server,
// room management, and relay of WebRTC signaling events.

import { showToast } from '../components/toast.js';

class SocketService {
  constructor() {
    this.socket = null;
    this.roomCode = null;
    this.deviceId = null;
    this.listeners = new Map();
    this.connected = false;
    this.currentUrl = null;
  }

  /**
   * Connect to the signaling server.
   * @param {string} serverUrl — base URL (e.g. 'http://localhost:3489' or 'http://192.168.1.5:3489')
   * @returns {Promise<boolean>} Resolves when connection is established
   */
  connect(serverUrl) {
    return new Promise((resolve, reject) => {
      if (this.socket && this.connected && this.currentUrl === serverUrl) {
        resolve(true);
        return;
      }

      if (this.socket) {
        this.disconnect();
      }

      this.currentUrl = serverUrl;

      console.log(`[Socket] Connecting to signaling server at: ${serverUrl}`);

      if (!window.io) {
        const errMsg = 'Socket.io client library not loaded. Check script tag in index.html';
        console.error(`[Socket] ${errMsg}`);
        showToast(errMsg, 'error');
        reject(new Error(errMsg));
        return;
      }

      let isTimedOut = false;
      const connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          isTimedOut = true;
          console.warn(`[Socket] Connection timed out after 5 seconds to: ${serverUrl}`);
          this.disconnect();
          reject(new Error('Connection timed out. This is usually caused by:\n1. Windows Defender Firewall blocking TCP port 3489 on the receiver.\n2. Both devices not being on the exact same Wi-Fi network/subnet.\n3. Virtual network adapter (VirtualBox, Docker, WSL, VPN) conflicts.'));
        }
      }, 5000);

      this.socket = window.io(serverUrl, {
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 3000,
        timeout: 4500,
      });

      this.socket.on('connect', () => {
        if (isTimedOut) return;
        clearTimeout(connectionTimeout);
        this.connected = true;
        this.deviceId = this.socket.id;
        console.log(`[Socket] Connected. Device ID / Socket ID: ${this.deviceId}`);
        this.trigger('connectionChange', true);
        resolve(true);
      });

      this.socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error);
        this.connected = false;
        this.trigger('connectionChange', false);
      });

      this.socket.on('reconnect_failed', () => {
        if (isTimedOut) return;
        clearTimeout(connectionTimeout);
        console.warn(`[Socket] Reconnection failed to: ${serverUrl}`);
        this.disconnect();
        reject(new Error('Connection failed. This is usually caused by:\n1. Windows Defender Firewall blocking TCP port 3489 on the receiver.\n2. Both devices not being on the exact same Wi-Fi network/subnet.\n3. Virtual network adapter (VirtualBox, Docker, WSL, VPN) conflicts.'));
      });

      this.socket.on('disconnect', (reason) => {
        console.log(`[Socket] Disconnected. Reason: ${reason}`);
        this.connected = false;
        this.roomCode = null;
        this.trigger('connectionChange', false);
        this.trigger('left-room');
      });

      // Register generic forwards for signaling events
      const forwardEvents = [
        'device-joined',
        'device-left',
        'offer',
        'answer',
        'ice-candidate',
        'file-request',
        'file-response',
      ];

      for (const event of forwardEvents) {
        this.socket.on(event, (data) => {
          console.log(`[Socket] Event received: ${event}`, data);
          this.trigger(event, data);
        });
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.roomCode = null;
      this.deviceId = null;
      this.currentUrl = null;
    }
  }

  /**
   * Register this device with the signaling server.
   * @param {{ name: string, platform: string, ip: string }} deviceInfo
   * @returns {Promise<{ roomCode: string, deviceId: string }>}
   */
  registerDevice(deviceInfo) {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('register-device', deviceInfo, (response) => {
        if (response && response.roomCode) {
          this.roomCode = response.roomCode;
          this.deviceId = response.deviceId;
          console.log(`[Socket] Registered. Assigned Room Code: ${this.roomCode}`);
          this.trigger('room-updated', this.roomCode);
          resolve(response);
        } else {
          reject(new Error('Failed to register device'));
        }
      });
    });
  }

  /**
   * Join an existing room by its 6-digit code.
   * @param {string} roomCode
   * @returns {Promise<{ success: boolean, devices: Array<Object>, reason?: string }>}
   */
  async joinRoom(roomCode) {
    let localDev = null;
    try {
      const { deviceService } = await import('./device.js');
      localDev = deviceService.getLocalDevice();
    } catch (e) {
      console.warn('[Socket] Could not load deviceService dynamically:', e);
    }

    const deviceInfo = localDev ? {
      name: localDev.name,
      platform: localDev.platform,
      ip: localDev.ip
    } : null;

    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      this.socket.emit('join-room', { roomCode, deviceInfo }, (response) => {
        if (response && response.success) {
          this.roomCode = roomCode;
          console.log(`[Socket] Joined Room: ${this.roomCode}`);
          this.trigger('room-updated', this.roomCode);
          resolve(response);
        } else {
          resolve(response || { success: false, reason: 'No response from server' });
        }
      });
    });
  }

  /**
   * Leave the current room.
   * @returns {Promise<boolean>}
   */
  leaveRoom() {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve(false);
        return;
      }

      this.socket.emit('leave-room', (response) => {
        this.roomCode = null;
        console.log('[Socket] Left room');
        this.trigger('room-updated', null);
        this.trigger('left-room');
        resolve(true);
      });
    });
  }

  /**
   * Get a list of all devices in the current room.
   * @returns {Promise<Array<Object>>}
   */
  getDevices() {
    return new Promise((resolve) => {
      if (!this.connected) {
        resolve([]);
        return;
      }

      this.socket.emit('get-devices', (devices) => {
        resolve(devices || []);
      });
    });
  }

  // ── WebRTC Signaling Relays ────────────────────────────────────────

  sendOffer(targetId, sdp) {
    if (this.connected) {
      console.log(`[Socket] Sending WebRTC offer to ${targetId}`);
      this.socket.emit('offer', { targetId, sdp });
    }
  }

  sendAnswer(targetId, sdp) {
    if (this.connected) {
      console.log(`[Socket] Sending WebRTC answer to ${targetId}`);
      this.socket.emit('answer', { targetId, sdp });
    }
  }

  sendIceCandidate(targetId, candidate) {
    if (this.connected) {
      this.socket.emit('ice-candidate', { targetId, candidate });
    }
  }

  sendFileRequest(targetId, fileMeta) {
    if (this.connected) {
      console.log(`[Socket] Sending file transfer request to ${targetId}:`, fileMeta);
      this.socket.emit('file-request', {
        targetId,
        fileName: fileMeta.name,
        fileSize: fileMeta.size,
        fileType: fileMeta.type || 'application/octet-stream',
      });
    }
  }

  sendFileResponse(targetId, accepted) {
    if (this.connected) {
      console.log(`[Socket] Sending file response to ${targetId}: accepted=${accepted}`);
      this.socket.emit('file-response', { targetId, accepted });
    }
  }

  // ── Event Bus ──────────────────────────────────────────────────────

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    const list = this.listeners.get(event);
    const index = list.indexOf(callback);
    if (index !== -1) {
      list.splice(index, 1);
    }
  }

  trigger(event, data) {
    if (!this.listeners.has(event)) return;
    for (const callback of this.listeners.get(event)) {
      try {
        callback(data);
      } catch (err) {
        console.error(`[Socket] Error in listener for event ${event}:`, err);
      }
    }
  }

  /**
   * Disconnects from the current host, connects to the remote host, and joins the room.
   * @param {string} serverUrl
   * @param {string} roomCode
   * @returns {Promise<boolean>}
   */
  async connectToRemote(serverUrl, roomCode) {
    try {
      console.log(`[Socket] Connecting to remote host ${serverUrl} and room ${roomCode}`);
      await this.connect(serverUrl);
      const joinRes = await this.joinRoom(roomCode);
      if (joinRes && joinRes.success) {
        showToast('Connected to remote device!', 'success');
        return true;
      } else {
        throw new Error(joinRes.reason || 'Failed to join remote room');
      }
    } catch (err) {
      console.error('[Socket] Failed remote connection:', err);
      showToast(`Connection failed: ${err.message}`, 'error');
      // Reconnect to local as fallback
      await this.connectToLocal();
      return false;
    }
  }

  /**
   * Fallback: connects back to our local signaling server and registers.
   * @returns {Promise<string>} returns the new room code
   */
  async connectToLocal() {
    try {
      this.disconnect(); // Disconnect first to ensure a completely fresh connection and room code every time!
      const serverPort = window.mirrorcast ? await window.mirrorcast.getServerPort() : 3489;
      const localUrl = `http://localhost:${serverPort}`;
      console.log(`[Socket] Reconnecting to local loopback: ${localUrl}`);
      await this.connect(localUrl);
      
      const { deviceService } = await import('./device.js');
      const localDev = deviceService.getLocalDevice();
      const reg = await this.registerDevice({
        name: localDev.name,
        platform: localDev.platform,
        ip: localDev.ip
      });
      
      // Update UDP discovery with our new room code!
      if (window.mirrorcast && window.mirrorcast.updateRoomCode) {
        window.mirrorcast.updateRoomCode(reg.roomCode);
      }
      
      return reg.roomCode;
    } catch (err) {
      console.error('[Socket] Reconnect to local failed:', err);
      return null;
    }
  }

  isConnected() {
    return this.connected;
  }

  getRoomCode() {
    return this.roomCode;
  }

  getSocketId() {
    return this.deviceId;
  }
}

export const socketService = new SocketService();
