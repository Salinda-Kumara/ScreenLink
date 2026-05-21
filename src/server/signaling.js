// src/server/signaling.js — Socket.io Signaling Server for ScreenLink
// Handles WebRTC offer/answer/ICE relay, room management,
// device registration, and file transfer signaling.

const express = require('express');
const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

/**
 * Creates and starts the signaling server.
 * @param {number} port — TCP port to listen on
 * @returns {{ app: express.Application, server: http.Server, io: SocketIOServer, port: number }}
 */
function createSignalingServer(port) {
  const app = express();
  const server = http.createServer(app);

  const io = new SocketIOServer(server, {
    cors: {
      origin: '*',           // Allow all origins for LAN usage
      methods: ['GET', 'POST'],
    },
    // Increase max buffer size for file metadata payloads
    maxHttpBufferSize: 1e8,  // 100 MB
  });

  // ── State ────────────────────────────────────────────────────────
  // roomCode (string) → Set<socketId>
  const rooms = new Map();

  // socketId → { id, name, platform, ip, roomCode }
  const devices = new Map();

  // ── Helpers ──────────────────────────────────────────────────────

  /**
   * Generates a random 6-digit numeric room code that isn't already in use.
   * @returns {string}
   */
  function generateRoomCode() {
    let code;
    do {
      code = String(Math.floor(100000 + Math.random() * 900000));
    } while (rooms.has(code));
    return code;
  }

  /**
   * Returns an array of device info objects for every socket in a given room,
   * optionally excluding one socket ID.
   * @param {string} roomCode
   * @param {string} [excludeId]
   * @returns {Array<Object>}
   */
  function getDevicesInRoom(roomCode, excludeId) {
    const members = rooms.get(roomCode);
    if (!members) return [];

    const list = [];
    for (const sid of members) {
      if (sid === excludeId) continue;
      const device = devices.get(sid);
      if (device) list.push(device);
    }
    return list;
  }

  /**
   * Removes a socket from its room, cleans up empty rooms, and notifies
   * remaining members.
   * @param {import('socket.io').Socket} socket
   */
  function removeFromRoom(socket) {
    const device = devices.get(socket.id);
    if (!device || !device.roomCode) return;

    const { roomCode } = device;
    const members = rooms.get(roomCode);

    if (members) {
      members.delete(socket.id);

      // Notify remaining members that this device left
      for (const sid of members) {
        io.to(sid).emit('device-left', { id: device.id, name: device.name });
      }

      // Clean up empty rooms
      if (members.size === 0) {
        rooms.delete(roomCode);
        console.log(`[Signaling] Room ${roomCode} deleted (empty)`);
      }
    }

    device.roomCode = null;
  }

  // ── Socket.io Connection Handler ─────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`[Signaling] Client connected: ${socket.id}`);

    // ── Register Device ──
    // The client sends its info; we auto-create a room for it.
    socket.on('register-device', (info, callback) => {
      const roomCode = generateRoomCode();

      const device = {
        id: socket.id,
        name: info.name || 'Unknown Device',
        platform: info.platform || 'unknown',
        ip: info.ip || socket.handshake.address,
        roomCode: roomCode,
      };

      devices.set(socket.id, device);

      // Create the room and add this socket
      rooms.set(roomCode, new Set([socket.id]));
      socket.join(roomCode);

      console.log(`[Signaling] Device registered: ${device.name} → Room ${roomCode}`);

      // Acknowledge with the room code and device id
      if (typeof callback === 'function') {
        callback({ roomCode, deviceId: socket.id });
      }
    });

    // ── Join Room ──
    socket.on('join-room', (data, callback) => {
      const { roomCode, deviceInfo } = data;

      if (!rooms.has(roomCode)) {
        if (typeof callback === 'function') {
          callback({ success: false, reason: 'Room not found' });
        }
        return;
      }

      // Leave current room first (if any)
      removeFromRoom(socket);

      // Update device record (register if not exists, e.g. for remote connection)
      let device = devices.get(socket.id);
      if (!device) {
        const info = deviceInfo || {};
        device = {
          id: socket.id,
          name: info.name || 'Remote Device',
          platform: info.platform || 'unknown',
          ip: info.ip || socket.handshake.address,
          roomCode: roomCode,
        };
        devices.set(socket.id, device);
      } else {
        device.roomCode = roomCode;
      }

      rooms.get(roomCode).add(socket.id);
      socket.join(roomCode);

      // Notify existing members that a new device joined
      const existingDevices = getDevicesInRoom(roomCode, socket.id);
      for (const sid of rooms.get(roomCode)) {
        if (sid !== socket.id) {
          io.to(sid).emit('device-joined', {
            id: device.id,
            name: device.name,
            platform: device.platform,
            ip: device.ip,
          });
        }
      }

      console.log(`[Signaling] ${device.name} joined Room ${roomCode}`);

      if (typeof callback === 'function') {
        callback({ success: true, devices: existingDevices });
      }
    });

    // ── Leave Room ──
    socket.on('leave-room', (callback) => {
      removeFromRoom(socket);

      if (typeof callback === 'function') {
        callback({ success: true });
      }
    });

    // ── Get Devices ──
    socket.on('get-devices', (callback) => {
      const device = devices.get(socket.id);
      if (!device || !device.roomCode) {
        if (typeof callback === 'function') {
          callback([]);
        }
        return;
      }

      const list = getDevicesInRoom(device.roomCode);
      if (typeof callback === 'function') {
        callback(list);
      }
    });

    // ── WebRTC Signaling: Offer ──
    socket.on('offer', (data) => {
      const { targetId, sdp } = data;
      io.to(targetId).emit('offer', {
        callerId: socket.id,
        sdp: sdp,
      });
    });

    // ── WebRTC Signaling: Answer ──
    socket.on('answer', (data) => {
      const { targetId, sdp } = data;
      io.to(targetId).emit('answer', {
        answererId: socket.id,
        sdp: sdp,
      });
    });

    // ── WebRTC Signaling: ICE Candidate ──
    socket.on('ice-candidate', (data) => {
      const { targetId, candidate } = data;
      io.to(targetId).emit('ice-candidate', {
        senderId: socket.id,
        candidate: candidate,
      });
    });

    // ── File Transfer: Request ──
    socket.on('file-request', (data) => {
      const { targetId, fileName, fileSize, fileType } = data;
      io.to(targetId).emit('file-request', {
        senderId: socket.id,
        senderName: (devices.get(socket.id) || {}).name || 'Unknown',
        fileName: fileName,
        fileSize: fileSize,
        fileType: fileType,
      });
    });

    // ── File Transfer: Response (accept / decline) ──
    socket.on('file-response', (data) => {
      const { targetId, accepted } = data;
      io.to(targetId).emit('file-response', {
        responderId: socket.id,
        responderName: (devices.get(socket.id) || {}).name || 'Unknown',
        accepted: accepted,
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', (reason) => {
      console.log(`[Signaling] Client disconnected: ${socket.id} (${reason})`);
      removeFromRoom(socket);
      devices.delete(socket.id);
    });
  });

  // ── Health-check endpoint ──
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      rooms: rooms.size,
      devices: devices.size,
    });
  });

  // ── Start listening ──
  server.listen(port, '0.0.0.0', () => {
    console.log(`[Signaling] Server listening on 0.0.0.0:${port}`);
  });

  return { app, server, io, port };
}

module.exports = { createSignalingServer };
