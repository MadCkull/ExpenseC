export function createImageViewer(imageSrc) {
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay fade-in';
  
  // Prevent body scroll when open (already handled by modal-open usage, but double check)
  document.body.classList.add('modal-open');

  overlay.innerHTML = `
    <div class="image-viewer-content">
      <img src="${imageSrc}" class="image-viewer-img" />
    </div>
    <button class="image-viewer-close">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.remove();
      document.body.classList.remove('modal-open');
    }, 300);
  };

  overlay.addEventListener('click', close);
  overlay.querySelector('.image-viewer-close').addEventListener('click', (e) => {
    e.stopPropagation(); // prevent double trigger if button inside overlay
    close();
  });
}
