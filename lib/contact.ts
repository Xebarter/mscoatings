export const CONTACT_SUBJECTS = [
  'General inquiry',
  'Product information',
  'Order support',
  'Technical support',
  'Bulk / wholesale order',
  'Shipping & delivery',
  'Returns & refunds',
  'Partnership inquiry',
] as const;

export type ContactSubject = (typeof CONTACT_SUBJECTS)[number];
