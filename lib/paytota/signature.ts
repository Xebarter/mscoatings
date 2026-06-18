import crypto from 'crypto';

export function verifyPaytotaSignature(
  rawBody: string,
  signature: string,
  publicKeyPem: string
): boolean {
  if (!signature || !publicKeyPem) return false;

  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(rawBody);
    verifier.end();
    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch (error) {
    console.error('Paytota signature verification error:', error);
    return false;
  }
}
