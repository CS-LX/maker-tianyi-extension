(() => {
  'use strict';
  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const MAX_PIXELS = 40_000_000;
  const EXTENSIONS = { svg: 'image/svg+xml', avif: 'image/avif', gif: 'image/gif', png: 'image/png', apng: 'image/png', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg' };

  async function importFile(file, { fit = 'cover' } = {}) {
    if (!file || file.size === 0) throw new Error('图片为空，请重新选择。');
    if (file.size > MAX_FILE_SIZE) throw new Error('图片不能超过 10 MB，请先缩小文件。');
    const guessedType = EXTENSIONS[file.name?.split('.').pop().toLowerCase()];
    // Give SVG and extension-less MIME responses a usable image MIME. Decoding is still authoritative.
    const blob = guessedType ? new Blob([file], { type: guessedType }) : file;
    const url = URL.createObjectURL(blob);
    const image = new Image();
    let timeout;
    try {
      await new Promise((resolve, reject) => {
        timeout = setTimeout(() => reject(new Error('图片解码超时，请换一张较小的图片。')), 12000);
        image.onload = resolve;
        image.onerror = () => reject(new Error('无法读取这张图片：文件可能已损坏，或浏览器不支持此格式。请转为 PNG / JPG 后重试。'));
        image.src = url;
      });
      const width = image.naturalWidth, height = image.naturalHeight;
      if (!width || !height || width > 16384 || height > 16384 || width * height > MAX_PIXELS) {
        throw new Error('图片尺寸过大或无效，请缩小到 4000 万像素以内后重试。');
      }
      const side = Math.min(width, height);
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 512 / Math.max(width, height));
      canvas.width = fit === 'contain' ? Math.max(1, Math.round(width * scale)) : Math.min(side, 512);
      canvas.height = fit === 'contain' ? Math.max(1, Math.round(height * scale)) : Math.min(side, 512);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器无法处理图片，请重新打开设置后重试。');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Rasterization normalizes orientation/format, removes metadata and freezes animated inputs.
      if (fit === 'contain') ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      else ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      const avatar = canvas.toDataURL('image/png');
      if (!MakerProfile.validAvatar(avatar)) throw new Error('转换后的头像无效，请换一张图片。');
      return avatar;
    } finally {
      clearTimeout(timeout);
      image.onload = image.onerror = null;
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    }
  }
  globalThis.MakerAvatar = Object.freeze({ importFile, MAX_FILE_SIZE });
})();
