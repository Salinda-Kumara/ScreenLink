// src/server/discovery.js — UDP LAN Discovery Service for ScreenLink
// Broadcasts this device's presence on the LAN and listens for other
// ScreenLink instances. Devices auto-expire after 10 seconds of silence.

const dgram = require('dgram');

// How often (ms) to broadcast our presence
const BROADCAST_INTERVAL_MS = 3000;

// How long (ms) before a silent device is considered gone
const DEVICE_EXPIRY_MS = 10000;

// Unique message type to filter out unrelated UDP traffic
const MESSAGE_TYPE = 'mirrorcast-announce';

/**
 * Creates a LAN discovery service.
 *
 * @param {number} port          — UDP port to bind to (e.g. 3490)
 * @param {number} serverPort    — the signaling server TCP port (e.g. 3489)
 * @param {{ name: string, platform: string, ip: string }} deviceInfo
 * @returns {{
 *   start: () => void,
 *   stop: () => void,
 *   getDevices: () => Array<Object>,
 *   onDeviceFound: (cb: (device: Object) => void) => void,
 *   onDeviceLost:  (cb: (device: Object) => void) => void,
 * }}
 */
function createDiscoveryService(port, serverPort, deviceInfo) {
  let socket = null;
  let broadcastTimer = null;
  let cleanupTimer = null;
  let running = false;

  // ip → { name, platform, ip, serverPort, lastSeen }
  const discoveredDevices = new Map();

  // Event callbacks
  const onFoundCallbacks = [];
  const onLostCallbacks = [];

  // ── Broadcast Payload ──────────────────────────────────────────
  function buildAnnouncement() {
    return JSON.stringify({
      type: MESSAGE_TYPE,
      name: deviceInfo.name,
      platform: deviceInfo.platform,
      ip: deviceInfo.ip,
      serverPort: serverPort,
      roomCode: deviceInfo.roomCode || '',
      timestamp: Date.now(),
    });
  }

  // ── Start ──────────────────────────────────────────────────────
  function start() {
    if (running) return;
    running = true;

    socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
      console.error(`[Discovery] Socket error: ${err.message}`);
      // Attempt to recover by restarting after a short delay
      stop();
      setTimeout(() => {
        if (!running) start();
      }, 5000);
    });

    socket.on('message', (msg, rinfo) => {
      handleMessage(msg, rinfo);
    });

    socket.bind(port, () => {
      try {
        socket.setBroadcast(true);
        console.log(`[Discovery] Bound to port ${port}, broadcasting enabled`);
      } catch (err) {
        console.error(`[Discovery] Failed to enable broadcast: ${err.message}`);
      }

      // Start periodic broadcast
      broadcastTimer = setInterval(sendBroadcast, BROADCAST_INTERVAL_MS);
      // Send one immediately
      sendBroadcast();

      // Start periodic cleanup of expired devices
      cleanupTimer = setInterval(cleanupExpired, DEVICE_EXPIRY_MS / 2);
    });
  }

  // ── Stop ───────────────────────────────────────────────────────
  function stop() {
    running = false;

    if (broadcastTimer) {
      clearInterval(broadcastTimer);
      broadcastTimer = null;
    }

    if (cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }

    if (socket) {
      try {
        socket.close();
      } catch (err) {
        // Socket may already be closed
      }
      socket = null;
    }

    discoveredDevices.clear();
  }

  // ── Send Broadcast ─────────────────────────────────────────────
  function sendBroadcast() {
    if (!socket || !running) return;

    const message = Buffer.from(buildAnnouncement());

    try {
      socket.send(message, 0, message.length, port, '255.255.255.255', (err) => {
        if (err) {
          console.error(`[Discovery] Broadcast send error: ${err.message}`);
        }
      });
    } catch (err) {
      console.error(`[Discovery] Broadcast exception: ${err.message}`);
    }
  }

  // ── Handle Incoming Message ────────────────────────────────────
  function handleMessage(msg, rinfo) {
    try {
      const data = JSON.parse(msg.toString());

      // Ignore messages that aren't ours
      if (data.type !== MESSAGE_TYPE) return;

      // Ignore our own broadcasts
      if (data.ip === deviceInfo.ip) return;

      const key = data.ip;
      const isNew = !discoveredDevices.has(key);

      const device = {
        name: data.name,
        platform: data.platform,
        ip: data.ip,
        serverPort: data.serverPort,
        roomCode: data.roomCode || '',
        lastSeen: Date.now(),
      };

      discoveredDevices.set(key, device);

      if (isNew) {
        for (const cb of onFoundCallbacks) {
          try { cb(device); } catch (e) { /* swallow callback errors */ }
        }
      }
    } catch (err) {
      // Silently ignore malformed messages from other services
    }
  }

  // ── Cleanup Expired Devices ────────────────────────────────────
  function cleanupExpired() {
    const now = Date.now();

    for (const [key, device] of discoveredDevices) {
      if (now - device.lastSeen > DEVICE_EXPIRY_MS) {
        discoveredDevices.delete(key);
        for (const cb of onLostCallbacks) {
          try { cb(device); } catch (e) { /* swallow callback errors */ }
        }
      }
    }
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    start,
    stop,

    /**
     * Returns a snapshot array of all currently-known LAN devices.
     * @returns {Array<{ name: string, platform: string, ip: string, serverPort: number }>}
     */
    getDevices() {
      return Array.from(discoveredDevices.values()).map((d) => ({
        name: d.name,
        platform: d.platform,
        ip: d.ip,
        serverPort: d.serverPort,
        roomCode: d.roomCode || '',
      }));
    },

    /**
     * Dynamically update the local device's shareable room code.
     * @param {string} code
     */
    updateRoomCode(code) {
      deviceInfo.roomCode = code;
      sendBroadcast();
    },

    /**
     * Register a callback for when a new device is discovered.
     * @param {(device: Object) => void} callback
     */
    onDeviceFound(callback) {
      if (typeof callback === 'function') {
        onFoundCallbacks.push(callback);
      }
    },

    /**
     * Register a callback for when a device expires (no broadcast for 10s).
     * @param {(device: Object) => void} callback
     */
    onDeviceLost(callback) {
      if (typeof callback === 'function') {
        onLostCallbacks.push(callback);
      }
    },
  };
}

module.exports = { createDiscoveryService };
