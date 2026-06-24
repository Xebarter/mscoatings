import { BRAND_NAME } from '@/lib/brand';

export const BUSINESS_INFO = {
  name: BRAND_NAME,
  legalName: BRAND_NAME,
  foundingDate: '2019',
  telephone: '+256775305294',
  telephoneDisplay: '+256 775 305 294',
  email: 'info@mscoatings.com',
  supportEmail: 'support@mscoatings.com',
  privacyEmail: 'privacy@mscoatings.com',
  whatsappUrl:
    'https://wa.me/256775305294?text=Hello%20MS%20Coatings%2C%20I%20would%20like%20to%20inquire%20about%20your%20products.',
  address: {
    streetAddress: 'Kampala',
    addressLocality: 'Kampala',
    addressRegion: 'Central Region',
    postalCode: '',
    addressCountry: 'UG',
  },
  geo: {
    latitude: 0.3476,
    longitude: 32.5825,
  },
  areaServed: 'Uganda',
  openingHours: ['Mo-Sa 08:00-18:00'],
  priceRange: '$$',
  currenciesAccepted: 'UGX',
  paymentAccepted: 'Cash, Mobile Money, Card',
} as const;

/** Add real profile URLs here when available — used in Organization/LocalBusiness sameAs */
export const SOCIAL_PROFILE_URLS: string[] = [];
