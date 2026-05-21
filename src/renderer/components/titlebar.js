/**
 * ScreenLink — Title Bar Component
 * Handles window controls (minimize, maximize, close) and double-click maximize.
 */

export function init() {
  const btnMinimize = document.getElementById('btn-minimize');
  const btnMaximize = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');
  const titlebarDrag = document.querySelector('.titlebar-drag');

  if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
      if (window.mirrorcast && window.mirrorcast.minimize) {
        window.mirrorcast.minimize();
      }
    });
  }

  if (btnMaximize) {
    btnMaximize.addEventListener('click', () => {
      if (window.mirrorcast && window.mirrorcast.maximize) {
        window.mirrorcast.maximize();
      }
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      if (window.mirrorcast && window.mirrorcast.close) {
        window.mirrorcast.close();
      }
    });
  }

  // Double-click on drag region toggles maximize
  if (titlebarDrag) {
    titlebarDrag.addEventListener('dblclick', () => {
      if (window.mirrorcast && window.mirrorcast.maximize) {
        window.mirrorcast.maximize();
      }
    });
  }

  // Listen for maximize state changes to update the icon
  if (window.mirrorcast && window.mirrorcast.onMaximizeChange) {
    window.mirrorcast.onMaximizeChange((isMaximized) => {
      if (btnMaximize) {
        btnMaximize.innerHTML = isMaximized ? '&#x29C9;' : '&#x25A1;';
        btnMaximize.setAttribute('aria-label', isMaximized ? 'Restore' : 'Maximize');
      }
    });
  }
}
