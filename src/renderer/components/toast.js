/**
 * ScreenLink — Toast Notification Component
 * Shows stacked toast notifications with icons, progress bars, and animations.
 */

const TOAST_ICONS = {
  success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>`,
  error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
  </svg>`,
  info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="16" x2="12" y2="12"/>
    <line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>`
};

/**
 * Show a toast notification.
 * @param {string} message - The notification message
 * @param {'success'|'error'|'info'|'warning'} [type='info'] - Toast type
 * @param {number} [duration=3000] - Auto-dismiss duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const formattedMessage = escapeHtml(message).replace(/\n/g, '<br>');
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${formattedMessage}</div>
    <div class="toast-progress" style="width: 100%;"></div>
  `;

  container.appendChild(toast);

  // Animate the progress bar countdown
  const progressBar = toast.querySelector('.toast-progress');
  if (progressBar) {
    // Force reflow to ensure the transition works
    progressBar.offsetWidth;
    progressBar.style.transition = `width ${duration}ms linear`;
    requestAnimationFrame(() => {
      progressBar.style.width = '0%';
    });
  }

  // Auto-dismiss
  let dismissTimeout = setTimeout(() => {
    removeToast(toast);
  }, duration);

  // Click to dismiss early
  toast.addEventListener('click', () => {
    clearTimeout(dismissTimeout);
    removeToast(toast);
  });

  // Pause countdown on hover
  toast.addEventListener('mouseenter', () => {
    clearTimeout(dismissTimeout);
    if (progressBar) {
      const currentWidth = progressBar.getBoundingClientRect().width;
      const containerWidth = toast.getBoundingClientRect().width;
      const pct = (currentWidth / containerWidth) * 100;
      progressBar.style.transition = 'none';
      progressBar.style.width = `${pct}%`;
    }
  });

  toast.addEventListener('mouseleave', () => {
    if (progressBar) {
      const currentWidth = parseFloat(progressBar.style.width);
      const remainingTime = (currentWidth / 100) * duration;
      progressBar.style.transition = `width ${remainingTime}ms linear`;
      requestAnimationFrame(() => {
        progressBar.style.width = '0%';
      });
      dismissTimeout = setTimeout(() => {
        removeToast(toast);
      }, remainingTime);
    }
  });
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.classList.add('toast-exit');

  toast.addEventListener('animationend', () => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  });

  // Fallback removal
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 350);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
