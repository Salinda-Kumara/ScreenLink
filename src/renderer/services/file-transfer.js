// src/renderer/services/file-transfer.js — File Transfer Queue Service
// Manages the queue for both sending and receiving files, calculates
// transfer speeds, ETAs, statuses, and logs file transfer history.

import { webrtcService } from './webrtc.js';
import { socketService } from './socket.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';

class FileTransferService {
  constructor() {
    this.webrtc = null;
    // Array of { id, name, size, progress, speed, status, direction, targetId, targetName, startTime, elapsed }
    this.queue = [];
    this.history = [];
    this.listeners = new Set();
    this.completeListeners = new Set();

    // Speed calculation helpers: transferId -> { lastBytes, lastTime }
    this.speedTrackers = new Map();
    // Cache pending outgoing files: targetId -> fileObj
    this.pendingSends = new Map();
  }

  /**
   * Initialize file transfer.
   */
  init() {
    this.webrtc = webrtcService;

    // Register incoming progress updates from WebRTC
    this.webrtc.onFileProgress((targetId, received, total) => {
      // Incoming file (receiving)
      let item = this.queue.find(x => x.targetId === targetId && x.direction === 'receiving' && x.status === 'transferring');
      if (!item) {
        // If not found in queue, it means it's a new transfer starting
        // Wait for metadata metadata to push the item
        return;
      }

      this.updateProgress(item.id, received);
    });

    // Register file fully received
    this.webrtc.onFileReceived(async (targetId, file) => {
      console.log('[FileTransfer] File received successfully:', file);
      
      let item = this.queue.find(x => x.targetId === targetId && x.direction === 'receiving' && x.status === 'transferring');
      if (item) {
        item.status = 'completed';
        item.progress = 100;
        item.speed = 0;
        
        // Save file locally via Electron IPC
        if (window.mirrorcast) {
          // Read blob as ArrayBuffer to pass through Electron bridge
          const arrayBuffer = await file.blob.arrayBuffer();
          const buffer = new Uint8Array(arrayBuffer);
          const saveResult = await window.mirrorcast.saveFile(buffer, file.name);
          if (saveResult.success) {
            showToast(`File saved to ${saveResult.filePath}`, 'success');
            item.localPath = saveResult.filePath;
          } else {
            showToast(`File download cancelled / failed`, 'warning');
            item.status = 'failed';
          }
        } else {
          // Browser fallback: standard download link
          const url = URL.createObjectURL(file.blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name;
          a.click();
          URL.revokeObjectURL(url);
          showToast(`Downloaded ${file.name}`, 'success');
        }

        // Add received file to global gallery state (for Gallery page)
        this.addToGallery(file);

        // Move to history
        this.moveToHistory(item);
        this.triggerComplete(item);
      }
      this.triggerUpdate();
    });

    // Hook socket responses for file request approval
    socketService.on('file-response', async (data) => {
      const fileObj = this.pendingSends.get(data.responderId);
      if (data.accepted && fileObj) {
        showToast(`${data.responderName} accepted file transfer. Sending...`, 'success');
        this.pendingSends.delete(data.responderId);
        await this.sendFile(data.responderId, data.responderName, fileObj);
      } else {
        showToast(`${data.responderName} declined file transfer.`, 'warning');
        this.pendingSends.delete(data.responderId);
        this.triggerComplete({ targetId: data.responderId, status: 'declined' });
      }
    });

    // Hook incoming socket signaling file-requests (Receiver prompt)
    socketService.on('file-request', (data) => {
      showModal({
        title: 'Incoming File Request',
        content: `
          <div style="text-align: center; padding: 10px 0;">
            <div style="font-size: 2.5rem; margin-bottom: 12px;">📁</div>
            <p><strong>${data.senderName}</strong> wants to send you a file:</p>
            <div style="margin: 16px 0; padding: 12px; background: rgba(0,0,0,0.2); border-radius: var(--radius-md); word-break: break-all;">
              <p><strong>${data.fileName}</strong></p>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">Size: ${this.formatBytes(data.fileSize)}</p>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-tertiary);">Do you want to accept this transfer?</p>
          </div>
        `,
        buttons: [
          {
            text: 'Accept',
            class: 'btn-primary',
            onClick: () => {
              hideModal();
              socketService.sendFileResponse(data.senderId, true);
              showToast('Preparing to receive file...', 'info');
              
              // Queue receiving transfer progress UI row
              this.registerIncomingTransfer(
                data.senderId,
                data.senderName,
                data.fileName,
                data.fileSize,
                data.fileType
              );
            }
          },
          {
            text: 'Decline',
            class: 'btn-secondary',
            onClick: () => {
              hideModal();
              socketService.sendFileResponse(data.senderId, false);
              showToast('Declined incoming transfer', 'warning');
            }
          }
        ]
      });
    });
  }

  requestSendFile(targetId, targetName, fileObj) {
    this.pendingSends.set(targetId, fileObj);
    socketService.sendFileRequest(targetId, {
      name: fileObj.name,
      size: fileObj.size,
      type: fileObj.type
    });
    showToast('Requesting permission to send file...', 'info');
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Start sending a file to a target device.
   * @param {string} targetId — target socket ID
   * @param {string} targetName — human readable name of target device
   * @param {{ name: string, size: number, path?: string, data: Buffer|ArrayBuffer }} fileObj
   */
  async sendFile(targetId, targetName, fileObj) {
    const transferId = 'tx-' + Math.random().toString(36).substr(2, 9);
    
    const newItem = {
      id: transferId,
      name: fileObj.name,
      size: fileObj.size,
      progress: 0,
      speed: 0,
      status: 'queued',
      direction: 'sending',
      targetId: targetId,
      targetName: targetName,
      startTime: Date.now(),
      elapsed: 0,
    };

    this.queue.push(newItem);
    this.triggerUpdate();

    // Trigger Webrtc file transfer
    try {
      newItem.status = 'transferring';
      this.speedTrackers.set(transferId, { lastBytes: 0, lastTime: Date.now() });
      this.triggerUpdate();

      await this.webrtc.sendFile(
        targetId,
        { name: fileObj.name, size: fileObj.size, mimeType: fileObj.type },
        fileObj.data,
        (sentBytes, totalBytes) => {
          this.updateProgress(transferId, sentBytes);
        }
      );

      // Finish sending
      newItem.status = 'completed';
      newItem.progress = 100;
      newItem.speed = 0;
      showToast(`File "${fileObj.name}" sent successfully!`, 'success');
      this.moveToHistory(newItem);
      this.triggerComplete(newItem);
    } catch (err) {
      console.error('[FileTransfer] Failed to send file:', err);
      newItem.status = 'failed';
      newItem.speed = 0;
      showToast(`Failed to send "${fileObj.name}": ${err.message}`, 'error');
    }
    
    this.triggerUpdate();
    return transferId;
  }

  /**
   * Called by page when Socket signaling triggers an incoming file request.
   */
  registerIncomingTransfer(senderId, senderName, fileName, fileSize, mimeType) {
    const transferId = 'rx-' + Math.random().toString(36).substr(2, 9);
    
    const newItem = {
      id: transferId,
      name: fileName,
      size: fileSize,
      progress: 0,
      speed: 0,
      status: 'transferring', // Set directly to transferring since we auto-accept or call acceptance before this
      direction: 'receiving',
      targetId: senderId,
      targetName: senderName,
      startTime: Date.now(),
      elapsed: 0,
    };

    this.queue.push(newItem);
    this.speedTrackers.set(transferId, { lastBytes: 0, lastTime: Date.now() });
    this.triggerUpdate();
    return transferId;
  }

  cancelTransfer(transferId) {
    const item = this.queue.find(x => x.id === transferId);
    if (item) {
      item.status = 'cancelled';
      item.speed = 0;
      this.webrtc.closeConnection(item.targetId);
      this.moveToHistory(item);
      this.triggerUpdate();
    }
  }

  updateProgress(transferId, currentBytes) {
    const item = this.queue.find(x => x.id === transferId);
    if (!item || item.status !== 'transferring') return;

    const total = item.size;
    item.progress = Math.min(Math.round((currentBytes / total) * 100), 100);

    // Calculate speed
    const tracker = this.speedTrackers.get(transferId);
    if (tracker) {
      const now = Date.now();
      const timeDiff = (now - tracker.lastTime) / 1000; // seconds
      if (timeDiff >= 1.0) { // Update speed calculation every 1s
        const bytesDiff = currentBytes - tracker.lastBytes;
        item.speed = Math.round(bytesDiff / timeDiff); // bytes/sec
        item.elapsed = Math.round((now - item.startTime) / 1000); // seconds
        
        // Update tracker state
        tracker.lastBytes = currentBytes;
        tracker.lastTime = now;
      }
    }

    this.triggerUpdate();
  }

  moveToHistory(item) {
    // Remove from active queue
    this.queue = this.queue.filter(x => x.id !== item.id);
    this.speedTrackers.delete(item.id);
    
    // Add to history
    this.history.unshift({
      ...item,
      endTime: Date.now()
    });

    // Cap history size
    if (this.history.length > 50) {
      this.history.pop();
    }
  }

  // Store received files references in localStorage gallery
  addToGallery(file) {
    try {
      const galleryList = JSON.parse(localStorage.getItem('gallery_files') || '[]');
      
      // Store reference metadata. Blobs can't be saved in localStorage, but we can save URL if it's stored, 
      // or in case of Desktop we store file path.
      galleryList.unshift({
        name: file.name,
        size: file.size,
        mimeType: file.mimeType,
        localPath: file.localPath || '',
        timestamp: Date.now(),
      });

      // Cap gallery list metadata
      if (galleryList.length > 100) galleryList.pop();
      localStorage.setItem('gallery_files', JSON.stringify(galleryList));
      
      // Save full base64 image content in indexedDB or just cache the received file memory references
      if (!window.galleryFileCache) {
        window.galleryFileCache = [];
      }
      window.galleryFileCache.unshift(file);
    } catch (e) {
      console.error('[FileTransfer] Failed to update gallery list:', e);
    }
  }

  getQueue() {
    return this.queue;
  }

  getHistory() {
    return this.history;
  }

  onQueueUpdate(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  onTransferComplete(callback) {
    this.completeListeners.add(callback);
    return () => this.completeListeners.delete(callback);
  }

  triggerUpdate() {
    for (const cb of this.listeners) cb([...this.queue]);
  }

  triggerComplete(item) {
    for (const cb of this.completeListeners) cb(item);
  }
}

export const fileTransferService = new FileTransferService();
