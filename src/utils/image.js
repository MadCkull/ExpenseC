/**
 * Image Utilities for Client-Side Optimization.
 */

/**
 * Resizes and compresses an image (from a File object or DataURL).
 * Returns a base64 string of the compressed JPEG.
 * 
 * @param {File|string} source - The image file or base64 string.
 * @param {object} options - Options for resizing.
 * @param {number} options.maxWidth - Max width in pixels (default: 512).
 * @param {number} options.maxHeight - Max height in pixels (default: 512).
 * @param {number} options.quality - JPEG quality 0-1 (default: 0.7).
 */
export function compressImage(source, { maxWidth = 512, maxHeight = 512, quality = 0.7 } = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      // Convert to compressed JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };

    img.onerror = reject;

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => (img.src = e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(source);
    }
  });
}
