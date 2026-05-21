/**
 * ScreenLink — Device Card Component
 * Creates a device card DOM element for discovered devices.
 */

const PLATFORM_ICONS = {
  windows: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
  </svg>`,
  mac: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>`,
  android: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.6 9.48l1.84-3.18c.16-.31.04-.69-.27-.86-.31-.16-.69-.04-.86.27l-1.86 3.22c-1.35-.64-2.87-1-4.45-1s-3.1.36-4.45 1L5.73 5.71c-.17-.31-.55-.43-.86-.27-.31.16-.43.55-.27.86L6.44 9.48C3.82 10.95 2.06 13.53 2 16.5h20c-.06-2.97-1.82-5.55-4.4-7.02zM8.5 14c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm7 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
  </svg>`,
  ios: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M15.5 1h-8C6.12 1 5 2.12 5 3.5v17C5 21.88 6.12 23 7.5 23h8c1.38 0 2.5-1.12 2.5-2.5v-17C18 2.12 16.88 1 15.5 1zm-4 21c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5-4H7V4h9v14z"/>
  </svg>`,
  linux: `<svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.2-.869-.416-1.848-.888-2.55-.36-.53-.755-.869-1.172-1.005l-.007-.007c.085-.086.153-.186.234-.3.086-.13.168-.263.241-.4.23-.397.39-.862.39-1.4 0-.64-.17-1.164-.383-1.603a8.03 8.03 0 00-.652-1.017c-.174-.223-.354-.436-.539-.627-.082-.1-.17-.186-.25-.279l-.067-.077-.239-.178c-.842-.766-1.808-1.352-2.735-1.904-.344-.207-.667-.435-.972-.731-.406-.364-.783-.872-1.057-1.706-.09-.282-.174-.52-.243-.687-.137-.337-.32-.468-.512-.47z"/>
  </svg>`,
  unknown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/>
    <line x1="8" y1="21" x2="16" y2="21"/>
    <line x1="12" y1="17" x2="12" y2="21"/>
  </svg>`
};

const STATUS_CONFIG = {
  online: { label: 'Online', badgeClass: 'badge-success', dotClass: 'online' },
  connected: { label: 'Connected', badgeClass: 'badge-info', dotClass: 'connected' },
  mirroring: { label: 'Mirroring', badgeClass: 'badge-info', dotClass: 'mirroring' },
  transferring: { label: 'Transferring', badgeClass: 'badge-warning', dotClass: 'transferring' },
  offline: { label: 'Offline', badgeClass: 'badge-error', dotClass: 'offline' }
};

/**
 * Create a device card DOM element.
 * @param {Object} device - { id, name, platform, ip, status, roomCode }
 * @param {Function} onConnect - Called when Connect is clicked
 * @param {Function} onDisconnect - Called when Disconnect is clicked
 * @returns {HTMLElement}
 */
export function createDeviceCard(device, onConnect, onDisconnect) {
  const { id, name, platform = 'unknown', ip, status = 'offline', roomCode } = device;
  const platformIcon = PLATFORM_ICONS[platform] || PLATFORM_ICONS.unknown;
  const statusInfo = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
  const isActive = status === 'connected' || status === 'mirroring' || status === 'transferring';

  const el = document.createElement('div');
  el.className = 'device-card fade-in-up';
  el.setAttribute('data-device-id', id);

  el.innerHTML = `
    <div class="device-avatar">
      ${platformIcon}
    </div>
    <div class="device-info">
      <div class="device-name">${escapeHtml(name)}</div>
      <div class="device-status">
        <span class="status-dot ${statusInfo.dotClass}"></span>
        <span>${statusInfo.label}</span>
        ${ip ? `<span style="margin-left:4px;color:var(--text-tertiary)">· ${escapeHtml(ip)}</span>` : ''}
        ${roomCode ? `<span style="margin-left:4px;color:var(--text-tertiary)">· Room: ${escapeHtml(roomCode)}</span>` : ''}
      </div>
    </div>
    <div class="device-actions">
      ${isActive
        ? `<button class="btn btn-secondary btn-sm device-disconnect-btn">Disconnect</button>`
        : status === 'online'
          ? `<button class="btn btn-primary btn-sm device-connect-btn">Connect</button>`
          : `<button class="btn btn-secondary btn-sm" disabled>Offline</button>`
      }
    </div>
  `;

  // Wire up button handlers
  const connectBtn = el.querySelector('.device-connect-btn');
  if (connectBtn && onConnect) {
    connectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onConnect(device);
    });
  }

  const disconnectBtn = el.querySelector('.device-disconnect-btn');
  if (disconnectBtn && onDisconnect) {
    disconnectBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onDisconnect(device);
    });
  }

  return el;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
