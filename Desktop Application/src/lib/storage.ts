import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from './firebase';
import { ensureFirestoreAuthReady } from './admin-auth';
import { isOnline } from './offline/connectivity';

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

/**
 * Firebase Storage rules require request.auth != null.
 * Trusted offline desktop sessions without a live Auth user cannot upload.
 */
async function requireAuthForStorageUpload(): Promise<void> {
  if (!isOnline()) {
    throw new Error('Connect to the internet to upload product images.');
  }

  await ensureFirestoreAuthReady();

  const user = auth.currentUser;
  if (!user) {
    throw new Error(
      'Your login session is not ready for image uploads. Sign out, sign in again while online, then retry.'
    );
  }

  try {
    // Force a fresh ID token so Storage receives a valid auth context.
    await user.getIdToken(true);
  } catch {
    throw new Error(
      'Could not refresh your login for image uploads. Sign out, sign in again while online, then retry.'
    );
  }
}

function toStorageUploadError(error: unknown): Error {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code ?? '';
    const message = error.message.toLowerCase();
    if (
      code === 'storage/unauthorized' ||
      message.includes('storage/unauthorized') ||
      message.includes('does not have permission')
    ) {
      return new Error(
        'Image upload denied. Sign out, sign in again while online, then retry. Only signed-in accounts can upload.'
      );
    }
    return error;
  }
  return new Error('Failed to upload image');
}

export async function uploadProductImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string> {
  const validationError = validateProductImage(file);
  if (validationError) {
    throw new Error(validationError);
  }

  onProgress?.(5);
  await requireAuthForStorageUpload();
  onProgress?.(10);

  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const path = `products/${Date.now()}-${safeName}`;
  const storageRef = ref(storage, path);

  try {
    await uploadBytes(storageRef, file, {
      contentType: file.type,
      cacheControl: 'public,max-age=31536000',
    });
    onProgress?.(85);

    const downloadUrl = await getDownloadURL(storageRef);
    onProgress?.(100);
    return downloadUrl;
  } catch (error) {
    throw toStorageUploadError(error);
  }
}

/** Upload a previously saved offline blob (or legacy data URL) when reconnecting. */
export async function uploadProductImageBlob(
  blob: Blob,
  contentType: string,
  productId: string
): Promise<string> {
  if (blob.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Queued image is too large to upload');
  }

  await requireAuthForStorageUpload();

  const type = contentType || blob.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const path = `products/${productId}-${Date.now()}.${ext}`;
  const storageRef = ref(storage, path);
  try {
    await uploadBytes(storageRef, blob, {
      contentType: type,
      cacheControl: 'public,max-age=31536000',
    });
    return getDownloadURL(storageRef);
  } catch (error) {
    throw toStorageUploadError(error);
  }
}

/** @deprecated Prefer uploadProductImageBlob — kept for legacy queued data URLs. */
export async function uploadProductImageFromDataUrl(
  dataUrl: string,
  contentType: string,
  productId: string
): Promise<string> {
  return uploadProductImageBlob(dataUrlToBlob(dataUrl, contentType), contentType, productId);
}
