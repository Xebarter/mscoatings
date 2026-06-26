import { BRAND_NAME } from '@/lib/brand';

export const BUSINESS_PHONES = [
  { tel: '+256709805895', display: '+256 709 805 895' },
  { tel: '+256775182065', display: '+256 775 182 065' },
] as const;

export const BUSINESS_INFO = {
  name: BRAND_NAME,
  legalName: BRAND_NAME,
  foundingDate: '2019',
  telephone: BUSINESS_PHONES[0].tel,
  telephoneDisplay: BUSINESS_PHONES[0].display,
  telephones: BUSINESS_PHONES,
  email: 'newspaintsolutionslimited@gmail.com',
  supportEmail: 'newspaintsolutionslimited@gmail.com',
  privacyEmail: 'newspaintsolutionslimited@gmail.com',
  whatsappUrl:
    'https://wa.me/256709805895?text=Hello%20MS%20Coatings%2C%20I%20would%20like%20to%20inquire%20about%20your%20products.',
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

export function getTelHref(phone: string = BUSINESS_INFO.telephone): string {
  return `tel:${phone}`;
}

export function getMailtoHref(
  email: string = BUSINESS_INFO.email,
  params?: { subject?: string; body?: string }
): string {
  const search = new URLSearchParams();
  if (params?.subject) search.set('subject', params.subject);
  if (params?.body) search.set('body', params.body);
  const query = search.toString();
  return query ? `mailto:${email}?${query}` : `mailto:${email}`;
}

export function formatPhoneListForText(
  phones: readonly { display: string }[] = BUSINESS_PHONES
): string {
  return phones.map((phone) => phone.display).join(' or ');
}

/** Used in Organization/LocalBusiness sameAs */
export const SOCIAL_PROFILE_URLS: string[] = [
  'https://www.instagram.com/mscoatingsug',
];
