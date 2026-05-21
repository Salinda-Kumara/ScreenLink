/**
 * ScreenLink — Annotation Canvas Component
 * Transparent overlay canvas with drawing tools, colors, undo, and glass toolbar.
 */

const TOOLS = {
  pen: {
    label: 'Pen',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 19l7-7 3 3-7 7-3-3z"/>
      <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
      <path d="M2 2l7.586 7.586"/>
      <circle cx="11" cy="11" r="2"/>
    </svg>`
  },
  highlighter: {
    label: 'Highlighter',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M15.09 2.22l6.69 6.69a1 1 0 010 1.42l-8.49 8.49a1 1 0 01-1.42 0l-6.69-6.69a1 1 0 010-1.42l8.49-8.49a1 1 0 011.42 0z"/>
      <line x1="3" y1="21" x2="9" y2="15"/>
    </svg>`
  },
  rectangle: {
    label: 'Rectangle',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/>
    </svg>`
  },
  circle: {
    label: 'Circle',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
    </svg>`
  },
  arrow: {
    label: 'Arrow',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>`
  },
  eraser: {
    label: 'Eraser',
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 20H7L3 16l9-9 8 8-4 4"/>
      <path d="M6.5 13.5l5 5"/>
    </svg>`
  }
};

const COLORS = [
  '#ffffff',
  '#f87171',
  '#fbbf24',
  '#34d399',
  '#60a5fa',
  '#915AFF',
  '#3FB9FF',
  '#f472b6'
];

/**
 * Create an annotation canvas overlay on a container.
 * @param {HTMLElement} container - The parent element to overlay the canvas on
 * @returns {Object} API: { enable, disable, clear, undo, setTool, setColor, setSize, getCanvas }
 */
export function createAnnotationCanvas(container) {
  if (!container) return null;

  // Ensure container is positioned for absolute children
  const computedPosition = window.getComputedStyle(container).position;
  if (computedPosition === 'static') {
    container.style.position = 'relative';
  }

  // State
  let enabled = false;
  let currentTool = 'pen';
  let currentColor = '#ffffff';
  let currentSize = 3;
  let isDrawing = false;
  let startX = 0;
  let startY = 0;
  let points = [];
  let undoStack = [];
  const MAX_UNDO = 30;

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    z-index: 40;
    pointer-events: none;
    cursor: crosshair;
  `;
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Resize canvas to match container
  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
  }

  resizeCanvas();
  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(container);

  // Toolbar
  const toolbar = document.createElement('div');
  toolbar.className = 'annotation-toolbar';
  toolbar.style.display = 'none';

  // Build toolbar HTML
  let toolbarHTML = '';

  // Tool buttons
  Object.entries(TOOLS).forEach(([id, tool]) => {
    toolbarHTML += `<button class="tool-btn ${id === currentTool ? 'active' : ''}" data-tool="${id}" title="${tool.label}">${tool.icon}</button>`;
  });

  toolbarHTML += '<div class="toolbar-separator"></div>';

  // Color swatches
  COLORS.forEach(color => {
    toolbarHTML += `<div class="color-swatch ${color === currentColor ? 'active' : ''}" data-color="${color}" style="background:${color}" title="${color}"></div>`;
  });

  toolbarHTML += '<div class="toolbar-separator"></div>';

  // Size slider
  toolbarHTML += `<input type="range" class="size-slider" min="1" max="20" value="${currentSize}" title="Brush size">`;

  toolbarHTML += '<div class="toolbar-separator"></div>';

  // Undo button
  toolbarHTML += `<button class="tool-btn" data-action="undo" title="Undo">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  </button>`;

  // Clear button
  toolbarHTML += `<button class="tool-btn" data-action="clear" title="Clear all">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
    </svg>
  </button>`;

  toolbar.innerHTML = toolbarHTML;
  container.appendChild(toolbar);

  // Toolbar event delegation
  toolbar.addEventListener('click', (e) => {
    const toolBtn = e.target.closest('.tool-btn');
    const swatch = e.target.closest('.color-swatch');

    if (toolBtn) {
      const tool = toolBtn.getAttribute('data-tool');
      const action = toolBtn.getAttribute('data-action');

      if (tool) {
        setTool(tool);
      } else if (action === 'undo') {
        undo();
      } else if (action === 'clear') {
        clear();
      }
    }

    if (swatch) {
      const color = swatch.getAttribute('data-color');
      setColor(color);
    }
  });

  // Size slider
  const slider = toolbar.querySelector('.size-slider');
  if (slider) {
    slider.addEventListener('input', (e) => {
      currentSize = parseInt(e.target.value, 10);
    });
  }

  // Prevent toolbar clicks from triggering drawing
  toolbar.addEventListener('mousedown', (e) => e.stopPropagation());
  toolbar.addEventListener('pointerdown', (e) => e.stopPropagation());

  // --- Drawing logic ---

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  function saveState() {
    if (undoStack.length >= MAX_UNDO) {
      undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  }

  function onPointerDown(e) {
    if (!enabled) return;
    isDrawing = true;
    const pos = getPos(e);
    startX = pos.x;
    startY = pos.y;
    points = [pos];

    saveState();

    if (currentTool === 'pen' || currentTool === 'highlighter' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    canvas.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!enabled || !isDrawing) return;
    const pos = getPos(e);

    if (currentTool === 'pen') {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Smooth line drawing using quadratic curves
      if (points.length >= 2) {
        const prev = points[points.length - 1];
        const midX = (prev.x + pos.x) / 2;
        const midY = (prev.y + pos.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
      } else {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      points.push(pos);

    } else if (currentTool === 'highlighter') {
      ctx.globalAlpha = 0.3;
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = currentSize * 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (points.length >= 2) {
        const prev = points[points.length - 1];
        const midX = (prev.x + pos.x) / 2;
        const midY = (prev.y + pos.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
        ctx.stroke();
      } else {
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      points.push(pos);

    } else if (currentTool === 'eraser') {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineWidth = currentSize * 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      points.push(pos);

    } else if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
      // For shapes, restore the last state and draw preview
      if (undoStack.length > 0) {
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
      }
      drawShape(startX, startY, pos.x, pos.y);
    }
  }

  function onPointerUp(e) {
    if (!enabled || !isDrawing) return;
    isDrawing = false;

    const pos = getPos(e);

    if (currentTool === 'rectangle' || currentTool === 'circle' || currentTool === 'arrow') {
      // Final shape draw — state was already saved in pointerdown
      if (undoStack.length > 0) {
        ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
      }
      drawShape(startX, startY, pos.x, pos.y);
    }

    ctx.beginPath(); // Reset path
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    points = [];
  }

  function drawShape(x1, y1, x2, y2) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'rectangle') {
      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.stroke();

    } else if (currentTool === 'circle') {
      const cx = (x1 + x2) / 2;
      const cy = (y1 + y2) / 2;
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

    } else if (currentTool === 'arrow') {
      const headLen = Math.max(15, currentSize * 4);
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6)
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6)
      );
      ctx.stroke();
    }
  }

  // Attach pointer events
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  // --- Public API ---

  function enable() {
    enabled = true;
    canvas.style.pointerEvents = 'auto';
    toolbar.style.display = 'flex';
    resizeCanvas();
  }

  function disable() {
    enabled = false;
    isDrawing = false;
    canvas.style.pointerEvents = 'none';
    toolbar.style.display = 'none';
  }

  function clear() {
    saveState();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function undo() {
    if (undoStack.length === 0) return;
    const state = undoStack.pop();
    ctx.putImageData(state, 0, 0);
  }

  function setTool(tool) {
    if (!TOOLS[tool]) return;
    currentTool = tool;

    // Update toolbar active states
    toolbar.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tool') === tool);
    });
  }

  function setColor(color) {
    currentColor = color;

    // Update toolbar active states
    toolbar.querySelectorAll('.color-swatch').forEach(swatch => {
      swatch.classList.toggle('active', swatch.getAttribute('data-color') === color);
    });
  }

  function setSize(size) {
    currentSize = Math.max(1, Math.min(20, size));
    if (slider) slider.value = currentSize;
  }

  function getCanvas() {
    return canvas;
  }

  return {
    enable,
    disable,
    clear,
    undo,
    setTool,
    setColor,
    setSize,
    getCanvas
  };
}
