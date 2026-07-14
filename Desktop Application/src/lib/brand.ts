import logoUrl from '@/assets/favicon-96x96.png';
import logoLargeUrl from '@/assets/web-app-manifest-512x512.png';

export const BRAND_NAME = 'MS Coatings';
export const BRAND_TAGLINE = 'Professional Finishing Systems';

export const BRAND_ASSETS = {
  logo: logoUrl,
  logoLarge: logoLargeUrl,
} as const;

export const BRAND_COLORS = {
  navy: '#0f172a',
  charcoal: '#1f2937',
  premiumBlue: '#0077c8',
  cyan: '#19b5fe',
  performanceRed: '#e53935',
  orange: '#f57c00',
  gold: '#ffc107',
} as const;
