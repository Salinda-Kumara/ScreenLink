// src/renderer/pages/gallery.js — Media Gallery Page
// Displays received photos and videos from P2P streams or file transfers,
// supports filtering, lightboxes, and a slideshow player.

import { showToast } from '../components/toast.js';

let activeFilter = 'all'; // 'all', 'images', 'videos'
let activeLightboxIndex = -1;
let slideshowInterval = null;

export function render() {
  return `
    <div class="fade-in-up flex column gap-md" style="height: 100%;">
      <!-- Header & Filters -->
      <div class="card flex justify-between align-center" style="padding: 16px 24px;">
        <h2 style="font-size: 1.3rem; font-weight: 700;">Media Gallery</h2>
        
        <!-- Filter select buttons -->
        <div class="flex gap-sm" style="background: rgba(0,0,0,0.2); padding: 4px; border-radius: var(--radius-md);">
          <button id="filter-btn-all" class="btn ${activeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.85rem; border: none;">All</button>
          <button id="filter-btn-images" class="btn ${activeFilter === 'images' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.85rem; border: none;">Images</button>
          <button id="filter-btn-videos" class="btn ${activeFilter === 'videos' ? 'btn-primary' : 'btn-secondary'}" style="padding: 6px 16px; font-size: 0.85rem; border: none;">Videos</button>
        </div>
      </div>

      <!-- MAIN MEDIA GRID -->
      <div class="card flex-grow-1" style="min-height: 400px; padding: 24px; display: flex; flex-direction: column;">
        <div id="gallery-empty-state" class="flex column flex-center gap-sm text-center" style="margin: auto; color: var(--text-tertiary);">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <h3 style="font-size: 1.1rem; color: var(--text-secondary); margin-top: 10px;">Gallery is Empty</h3>
          <p style="font-size: 0.85rem; max-width: 280px; color: var(--text-tertiary);">Received images & videos from file transfers will appear here automatically.</p>
        </div>

        <div id="gallery-media-grid" class="gallery-grid" style="display: none; flex-grow: 1;">
          <!-- Loaded dynamically -->
        </div>
      </div>

      <!-- Slideshow Float button -->
      <button id="btn-slideshow" class="btn btn-primary flex-center" style="position: fixed; bottom: 24px; right: 24px; width: 56px; height: 56px; border-radius: 50%; box-shadow: var(--shadow-glow); display: none; z-index: 100;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </button>

      <!-- LIGHTBOX MODAL OVERLAY -->
      <div id="lightbox-overlay" class="modal-overlay" style="display: none; justify-content: center; align-items: center; background: rgba(0, 0, 0, 0.95); z-index: 10000; position: fixed; inset: 0;">
        <button id="btn-lightbox-close" class="btn-icon" style="position: absolute; top: 24px; right: 24px; font-size: 24px; background: none; border: none; color: #fff; cursor: pointer;">&#x2715;</button>
        <button id="btn-lightbox-prev" class="btn-icon" style="position: absolute; left: 24px; font-size: 32px; background: none; border: none; color: #fff; cursor: pointer;">&#x2039;</button>
        <button id="btn-lightbox-next" class="btn-icon" style="position: absolute; right: 24px; font-size: 32px; background: none; border: none; color: #fff; cursor: pointer;">&#x203A;</button>
        
        <div id="lightbox-content-box" style="max-width: 90%; max-height: 85%; display: flex; align-items: center; justify-content: center;">
          <!-- Active view photo/video -->
        </div>
      </div>
    </div>
  `;
}

export function init() {
  setupFilterListeners();
  refreshGalleryGrid();

  // Slideshow
  const btnSlide = document.getElementById('btn-slideshow');
  if (btnSlide) {
    btnSlide.addEventListener('click', startSlideshow);
  }

  // Lightbox Close / Navigation events
  const lightbox = document.getElementById('lightbox-overlay');
  const btnClose = document.getElementById('btn-lightbox-close');
  const btnPrev = document.getElementById('btn-lightbox-prev');
  const btnNext = document.getElementById('btn-lightbox-next');

  if (btnClose) btnClose.addEventListener('click', hideLightbox);
  if (btnPrev) btnPrev.addEventListener('click', navigatePrev);
  if (btnNext) btnNext.addEventListener('click', navigateNext);

  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) hideLightbox();
    });
  }

  // Keypress navigation support
  window.addEventListener('keydown', handleKeyNavigation);
}

function getGalleryItems() {
  const cache = window.galleryFileCache || [];
  const metadataList = JSON.parse(localStorage.getItem('gallery_files') || '[]');

  // Map metadata references with active memory caches (Blobs) if loaded
  return metadataList.map((meta, index) => {
    // Attempt to locate blob cache by exact filename & timestamp / order
    const matched = cache.find(x => x.name === meta.name && x.size === meta.size);
    let objectUrl = '';
    if (matched) {
      objectUrl = URL.createObjectURL(matched.blob);
    }
    
    return {
      ...meta,
      objectUrl,
      isImage: meta.mimeType.startsWith('image/'),
      isVideo: meta.mimeType.startsWith('video/')
    };
  });
}

function refreshGalleryGrid() {
  const empty = document.getElementById('gallery-empty-state');
  const grid = document.getElementById('gallery-media-grid');
  const btnSlide = document.getElementById('btn-slideshow');

  if (!grid || !empty) return;

  const items = getGalleryItems();
  
  // Apply tab filters
  const filtered = items.filter((item) => {
    if (activeFilter === 'images') return item.isImage;
    if (activeFilter === 'videos') return item.isVideo;
    return item.isImage || item.isVideo; // Hide non-media in gallery
  });

  if (filtered.length === 0) {
    grid.style.display = 'none';
    if (btnSlide) btnSlide.style.display = 'none';
    empty.style.display = 'flex';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'grid';
  if (btnSlide) btnSlide.style.display = 'flex';
  
  grid.innerHTML = '';
  filtered.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'gallery-item card fade-in';
    card.style.padding = '0';
    card.style.overflow = 'hidden';
    card.style.position = 'relative';
    card.style.border = '1px solid var(--border-subtle)';

    let contentHtml = '';
    if (item.isImage) {
      contentHtml = `<img src="${item.objectUrl || 'data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 fill=%22%23222%22><rect width=%22100%22 height=%22100%22/></svg>'}" style="width: 100%; height: 100%; object-fit: cover;" />`;
    } else if (item.isVideo) {
      contentHtml = `
        <div style="width: 100%; height: 100%; background: #050508; display: flex; align-items: center; justify-content: center;" class="flex column">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="1.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          <div style="font-size: 0.7rem; color: var(--text-secondary); margin-top: 8px; max-width: 80%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.name}</div>
        </div>
      `;
    }

    card.innerHTML = `
      ${contentHtml}
      <div class="gallery-meta" style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); padding: 8px; font-size: 0.75rem; color: #fff; transform: translateY(100%); transition: transform 0.2s ease; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
        ${item.name}
      </div>
    `;

    card.addEventListener('mouseenter', () => {
      const meta = card.querySelector('.gallery-meta');
      if (meta) meta.style.transform = 'translateY(0)';
    });

    card.addEventListener('mouseleave', () => {
      const meta = card.querySelector('.gallery-meta');
      if (meta) meta.style.transform = 'translateY(100%)';
    });

    card.addEventListener('click', () => {
      showLightbox(index, filtered);
    });

    grid.appendChild(card);
  });
}

function setupFilterListeners() {
  const btnAll = document.getElementById('filter-btn-all');
  const btnImg = document.getElementById('filter-btn-images');
  const btnVid = document.getElementById('filter-btn-videos');

  const setFilter = (filter, activeBtn, other1, other2) => {
    activeFilter = filter;
    activeBtn.className = 'btn btn-primary';
    other1.className = 'btn btn-secondary';
    other2.className = 'btn btn-secondary';
    refreshGalleryGrid();
  };

  if (btnAll && btnImg && btnVid) {
    btnAll.addEventListener('click', () => setFilter('all', btnAll, btnImg, btnVid));
    btnImg.addEventListener('click', () => setFilter('images', btnImg, btnAll, btnVid));
    btnVid.addEventListener('click', () => setFilter('videos', btnVid, btnAll, btnImg));
  }
}

// ── LIGHTBOX CONTROLS ───────────────────────────────────────────────

let activeItemsList = [];

function showLightbox(index, items) {
  activeLightboxIndex = index;
  activeItemsList = items;
  
  const lightbox = document.getElementById('lightbox-overlay');
  const box = document.getElementById('lightbox-content-box');

  if (!lightbox || !box) return;

  const item = items[index];
  box.innerHTML = '';

  if (item.isImage) {
    const img = document.createElement('img');
    img.src = item.objectUrl;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.style.borderRadius = 'var(--radius-sm)';
    img.style.boxShadow = '0px 10px 40px rgba(0,0,0,0.8)';
    box.appendChild(img);
  } else if (item.isVideo) {
    const video = document.createElement('video');
    video.src = item.objectUrl;
    video.controls = true;
    video.autoplay = true;
    video.style.maxWidth = '100%';
    video.style.maxHeight = '100%';
    video.style.borderRadius = 'var(--radius-sm)';
    box.appendChild(video);
  }

  lightbox.style.display = 'flex';
  
  // Stagger reveal buttons
  const prev = document.getElementById('btn-lightbox-prev');
  const next = document.getElementById('btn-lightbox-next');
  if (prev) prev.style.display = index === 0 ? 'none' : 'block';
  if (next) next.style.display = index === items.length - 1 ? 'none' : 'block';
}

function hideLightbox() {
  const lightbox = document.getElementById('lightbox-overlay');
  const box = document.getElementById('lightbox-content-box');
  
  if (lightbox) lightbox.style.display = 'none';
  if (box) box.innerHTML = '';
  
  activeLightboxIndex = -1;
  stopSlideshow();
}

function navigatePrev() {
  if (activeLightboxIndex > 0) {
    showLightbox(activeLightboxIndex - 1, activeItemsList);
  }
}

function navigateNext() {
  if (activeLightboxIndex < activeItemsList.length - 1) {
    showLightbox(activeLightboxIndex + 1, activeItemsList);
  } else {
    stopSlideshow();
  }
}

function handleKeyNavigation(e) {
  if (activeLightboxIndex === -1) return;
  if (e.key === 'Escape') hideLightbox();
  if (e.key === 'ArrowLeft') navigatePrev();
  if (e.key === 'ArrowRight') navigateNext();
}

// ── SLIDESHOW PLAYER ───────────────────────────────────────────────

function startSlideshow() {
  const items = getGalleryItems().filter(x => x.isImage); // Slide images only
  if (items.length === 0) {
    showToast('No photos to play slideshow', 'warning');
    return;
  }

  showToast('Starting photo slideshow...', 'success');
  showLightbox(0, items);
  
  const btnSlide = document.getElementById('btn-slideshow');
  if (btnSlide) {
    btnSlide.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
    btnSlide.removeEventListener('click', startSlideshow);
    btnSlide.addEventListener('click', stopSlideshow);
  }

  slideshowInterval = setInterval(() => {
    if (activeLightboxIndex < items.length - 1) {
      navigateNext();
    } else {
      showLightbox(0, items); // loop
    }
  }, 3000);
}

function stopSlideshow() {
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }
  
  const btnSlide = document.getElementById('btn-slideshow');
  if (btnSlide) {
    btnSlide.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    btnSlide.removeEventListener('click', stopSlideshow);
    btnSlide.addEventListener('click', startSlideshow);
  }
}

export function destroy() {
  stopSlideshow();
  window.removeEventListener('keydown', handleKeyNavigation);
}
