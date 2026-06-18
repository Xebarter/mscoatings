export const BRAND_NAME = 'MS Coatings';

export const BRAND_TAGLINE = 'Professional Finishing Systems';

export const BRAND_ASSETS = {
  logo: '/favicon-96x96.png',
  logoLarge: '/web-app-manifest-512x512.png',
  faviconIco: '/favicon.ico',
  faviconSvg: '/favicon.svg',
  faviconPng: '/favicon-96x96.png',
  appleTouchIcon: '/apple-touch-icon.png',
  manifestIcon192: '/web-app-manifest-192x192.png',
  manifestIcon512: '/web-app-manifest-512x512.png',
  webManifest: '/site.webmanifest',
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

const CATEGORY_COLOR_MAP: Record<string, string> = {
  automotive: BRAND_COLORS.premiumBlue,
  'automotive refinish': BRAND_COLORS.premiumBlue,
  industrial: BRAND_COLORS.charcoal,
  'industrial coatings': BRAND_COLORS.charcoal,
  primer: BRAND_COLORS.orange,
  primers: BRAND_COLORS.orange,
  'clear coat': BRAND_COLORS.cyan,
  'clear coats': BRAND_COLORS.cyan,
  topcoat: BRAND_COLORS.cyan,
  topcoats: BRAND_COLORS.cyan,
  protective: BRAND_COLORS.performanceRed,
  specialty: BRAND_COLORS.gold,
  uncategorized: BRAND_COLORS.navy,
};

const CATEGORY_PALETTE = [
  BRAND_COLORS.premiumBlue,
  BRAND_COLORS.cyan,
  BRAND_COLORS.orange,
  BRAND_COLORS.performanceRed,
  BRAND_COLORS.gold,
  BRAND_COLORS.charcoal,
];

export function getCategoryColor(category: string): string {
  const normalized = category.trim().toLowerCase();
  if (!normalized) {
    return BRAND_COLORS.navy;
  }

  const exactMatch = CATEGORY_COLOR_MAP[normalized];
  if (exactMatch) {
    return exactMatch;
  }

  const keywordMatch = Object.entries(CATEGORY_COLOR_MAP).find(([key]) =>
    normalized.includes(key)
  );
  if (keywordMatch) {
    return keywordMatch[1];
  }

  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash + normalized.charCodeAt(i) * (i + 1)) % CATEGORY_PALETTE.length;
  }

  return CATEGORY_PALETTE[hash] ?? BRAND_COLORS.premiumBlue;
}
