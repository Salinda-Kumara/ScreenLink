/**
 * ScreenLink — Sidebar Navigation Component
 * Renders sidebar with icons, labels, badges, and collapse/expand.
 */

const SIDEBAR_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>`
  },
  {
    id: 'mirror',
    label: 'Screen Mirror',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>`
  },
  {
    id: 'devices',
    label: 'Devices Nearby',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5.636 18.364a9 9 0 0 1 0-12.728"/>
      <path d="M18.364 5.636a9 9 0 0 1 0 12.728"/>
      <path d="M8.464 15.536a5 5 0 0 1 0-7.072"/>
      <path d="M15.536 8.464a5 5 0 0 1 0 7.072"/>
      <circle cx="12" cy="12" r="1"/>
    </svg>`
  },
  {
    id: 'file-transfer',
    label: 'File Transfer',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="12" y1="18" x2="12" y2="12"/>
      <polyline points="9 15 12 12 15 15"/>
    </svg>`
  },
  {
    id: 'camera',
    label: 'Camera',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>`
  },
  {
    id: 'gallery',
    label: 'Gallery',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>`
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>`
  }
];

const LOGO_ICON = `<svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="14" y="8" width="34" height="24" rx="3" stroke="url(#sidebarLogoGrad)" stroke-width="2.5" fill="none" opacity="0.5"/>
  <rect x="20" y="32" width="22" height="2" rx="1" fill="url(#sidebarLogoGrad)" opacity="0.5"/>
  <rect x="22" y="18" width="34" height="24" rx="3" stroke="url(#sidebarLogoGrad)" stroke-width="2.5" fill="none"/>
  <rect x="28" y="42" width="22" height="2" rx="1" fill="url(#sidebarLogoGrad)"/>
  <path d="M39 10 C39 10, 44 4, 50 4" stroke="url(#sidebarLogoGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.4"/>
  <path d="M39 10 C39 10, 46 0, 55 0" stroke="url(#sidebarLogoGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.25"/>
  <path d="M39 10 C39 10, 42 7, 45 7.5" stroke="url(#sidebarLogoGrad)" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.6"/>
  <circle cx="39" cy="11" r="2" fill="url(#sidebarLogoGrad)"/>
  <defs>
    <linearGradient id="sidebarLogoGrad" x1="0" y1="0" x2="64" y2="64">
      <stop offset="0%" stop-color="#915AFF"/>
      <stop offset="100%" stop-color="#3FB9FF"/>
    </linearGradient>
  </defs>
</svg>`;

const CHEVRON_RIGHT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="9 18 15 12 9 6"/>
</svg>`;

let currentActive = null;
let badges = {};
let sidebarEl = null;

export function init(onNavigate) {
  sidebarEl = document.getElementById('sidebar');
  if (!sidebarEl) return;

  const expanded = localStorage.getItem('screenlink-sidebar-expanded') !== 'false';

  // Build sidebar HTML
  sidebarEl.innerHTML = `
    <div class="sidebar-header">
      <div class="sidebar-header-icon">${LOGO_ICON}</div>
      <span class="sidebar-header-text">ScreenLink</span>
    </div>
    <div class="sidebar-nav">
      ${SIDEBAR_ITEMS.map(item => `
        <div class="sidebar-item" data-page="${item.id}" role="button" tabindex="0" aria-label="${item.label}">
          <div class="sidebar-icon">${item.icon}</div>
          <span class="sidebar-label">${item.label}</span>
        </div>
      `).join('')}
    </div>
    <div class="sidebar-footer">
      <button class="sidebar-toggle" aria-label="Toggle sidebar">
        ${CHEVRON_RIGHT}
      </button>
    </div>
  `;

  // Set initial expanded state
  if (expanded) {
    sidebarEl.classList.add('sidebar-expanded');
  }

  // Navigation click handlers
  const navItems = sidebarEl.querySelectorAll('.sidebar-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page');
      setActive(pageId);
      if (onNavigate) onNavigate(pageId);
    });

    // Keyboard support
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });

  // Toggle button
  const toggleBtn = sidebarEl.querySelector('.sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = sidebarEl.classList.toggle('sidebar-expanded');
      localStorage.setItem('screenlink-sidebar-expanded', isExpanded);
    });
  }
}

export function setActive(pageId) {
  if (!sidebarEl) return;
  currentActive = pageId;

  const items = sidebarEl.querySelectorAll('.sidebar-item');
  items.forEach(item => {
    const id = item.getAttribute('data-page');
    if (id === pageId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

export function updateBadge(pageId, count) {
  if (!sidebarEl) return;

  badges[pageId] = count;

  const item = sidebarEl.querySelector(`.sidebar-item[data-page="${pageId}"]`);
  if (!item) return;

  // Remove existing badge
  const existing = item.querySelector('.sidebar-badge');
  if (existing) existing.remove();

  // Add badge if count > 0
  if (count && count > 0) {
    const badge = document.createElement('span');
    badge.className = 'sidebar-badge';
    badge.textContent = count > 99 ? '99+' : count;
    item.appendChild(badge);
  }
}
