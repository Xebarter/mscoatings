function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getPaytotaConfig() {
  return {
    baseUrl: (process.env.PAYTOTA_BASE_URL ?? 'https://gate.paytota.com').replace(
      /\/$/,
      ''
    ),
    secretKey: requireEnv('PAYTOTA_SECRET_KEY'),
    brandId: requireEnv('PAYTOTA_BRAND_ID'),
    currency: process.env.PAYTOTA_CURRENCY ?? 'UGX',
    country: process.env.PAYTOTA_COUNTRY ?? 'UG',
    webhookPublicKey: process.env.PAYTOTA_WEBHOOK_PUBLIC_KEY ?? '',
    successRedirect: requireEnv('PAYTOTA_SUCCESS_REDIRECT'),
    failureRedirect: requireEnv('PAYTOTA_FAILURE_REDIRECT'),
    cancelRedirect: requireEnv('PAYTOTA_CANCEL_REDIRECT'),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  };
}

export function appendOrderIdToUrl(url: string, orderId: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('orderId', orderId);
  return parsed.toString();
}

/** Normalize phone to international format without + (e.g. 256770123456). */
export function normalizePhone(phone: string, country = 'UG'): string {
  const digits = phone.replace(/\D/g, '');

  if (country === 'UG') {
    if (digits.startsWith('256')) return digits;
    if (digits.startsWith('0')) return `256${digits.slice(1)}`;
    if (digits.length === 9) return `256${digits}`;
  }

  return digits;
}
