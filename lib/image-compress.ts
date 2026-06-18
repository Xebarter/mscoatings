const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read the selected image'));
    };
    image.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to compress image'));
          return;
        }
        resolve(blob);
      },
      type,
      quality
    );
  });
}

export async function compressProductImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  // Skip compression for already-small files.
  if (file.size <= 300_000) {
    return file;
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const outputType =
    file.type === 'image/png' || file.type === 'image/webp'
      ? 'image/jpeg'
      : file.type;

  const blob = await canvasToBlob(canvas, outputType, JPEG_QUALITY);

  if (blob.size >= file.size) {
    return file;
  }

  const extension = outputType === 'image/jpeg' ? 'jpg' : file.name.split('.').pop() || 'jpg';
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image';

  return new File([blob], `${baseName}.${extension}`, {
    type: outputType,
    lastModified: Date.now(),
  });
}
