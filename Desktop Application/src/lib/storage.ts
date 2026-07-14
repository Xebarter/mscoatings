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
