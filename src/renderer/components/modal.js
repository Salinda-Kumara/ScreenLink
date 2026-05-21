/**
 * ScreenLink — Modal Component
 * Shows/hides modal dialogs with animation, backdrop dismiss, and Escape key support.
 */

let currentModal = null;
let escapeHandler = null;

/**
 * Show a modal dialog.
 * @param {Object} options
 * @param {string} options.title - Modal title text
 * @param {string} options.content - HTML string for the modal body
 * @param {Array} [options.buttons] - Array of { text, class, onClick }
 * @param {Function} [options.onClose] - Called when the modal is closed
 */
export function showModal(options = {}) {
  const { title = '', content = '', buttons = [], onClose } = options;

  // Close any existing modal first
  if (currentModal) {
    hideModalImmediate();
  }

  const container = document.getElementById('modal-container');
  if (!container) return;

  // Build modal HTML
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-header">
      <h3 class="modal-title">${title}</h3>
      <button class="modal-close" aria-label="Close">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
    <div class="modal-body">${content}</div>
    ${buttons.length > 0 ? `<div class="modal-footer"></div>` : ''}
  `;

  // Add buttons
  if (buttons.length > 0) {
    const footer = modal.querySelector('.modal-footer');
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.className = btn.class || 'btn btn-secondary';
      button.textContent = btn.text;
      button.addEventListener('click', () => {
        if (btn.onClick) btn.onClick();
      });
      footer.appendChild(button);
    });
  }

  overlay.appendChild(modal);
  container.appendChild(overlay);

  currentModal = { overlay, modal, onClose };

  // Close on backdrop click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      hideModal();
    }
  });

  // Close button
  const closeBtn = modal.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      hideModal();
    });
  }

  // Escape key handler
  escapeHandler = (e) => {
    if (e.key === 'Escape') {
      hideModal();
    }
  };
  document.addEventListener('keydown', escapeHandler);

  // Prevent body scrolling
  document.body.style.overflow = 'hidden';

  // Focus the modal for accessibility
  modal.setAttribute('tabindex', '-1');
  requestAnimationFrame(() => modal.focus());
}

/**
 * Hide the current modal with exit animation.
 */
export function hideModal() {
  if (!currentModal) return;

  const { overlay, onClose } = currentModal;

  // Add exit animation classes
  overlay.classList.add('modal-exit');

  // Wait for animation to complete before removing
  const onAnimEnd = () => {
    overlay.removeEventListener('animationend', onAnimEnd);
    hideModalImmediate();
    if (onClose) onClose();
  };

  overlay.addEventListener('animationend', onAnimEnd);

  // Fallback removal in case animation event doesn't fire
  setTimeout(() => {
    hideModalImmediate();
    if (onClose) onClose();
  }, 250);
}

function hideModalImmediate() {
  if (!currentModal) return;

  const { overlay } = currentModal;
  if (overlay && overlay.parentNode) {
    overlay.parentNode.removeChild(overlay);
  }

  // Remove escape handler
  if (escapeHandler) {
    document.removeEventListener('keydown', escapeHandler);
    escapeHandler = null;
  }

  // Restore body scrolling
  document.body.style.overflow = '';

  currentModal = null;
}
