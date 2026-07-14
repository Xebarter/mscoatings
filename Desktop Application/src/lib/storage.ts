import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export function validateProductImage(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Please select an image file (JPEG, PNG, WebP, etc.)';
  }
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return 'Image must be smaller than 5MB';
  }
  return null;
}

function dataUrlToBlob(dataUrl: string, contentType: string): Blob {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType || 'image/jpeg' });
}

export async function uploadProductImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const validationError = validateProductImage(file);
  if (validationError) {
    throw new Error(validationError);
  }

  onProgress?.(10);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `products/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=31536000',
  });
  onProgress?.(85);

  const downloadUrl = await getDownloadURL(storageRef);
  onProgress?.(100);
  return downloadUrl;
}

/** Upload a previously saved offline data URL when reconnecting. */
export async function uploadProductImageFromDataUrl(
  dataUrl: string,
  contentType: string,
  productId: string
): Promise<string> {
  const blob = dataUrlToBlob(dataUrl, contentType);
  if (blob.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Queued image is too large to upload');
  }
  const ext = contentType.includes('png')
    ? 'png'
    : contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const path = `products/${productId}-${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, blob, {
    contentType: contentType || 'image/jpeg',
    cacheControl: 'public,max-age=31536000',
  });
  return getDownloadURL(storageRef);
}
