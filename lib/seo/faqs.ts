import { BUSINESS_INFO, formatPhoneListForText } from '@/lib/seo/business';

export interface SeoFaq {
  question: string;
  answer: string;
}

export const HOME_FAQS: SeoFaq[] = [
  {
    question: 'What products does MS Coatings sell in Uganda?',
    answer:
      'MS Coatings supplies professional automotive and industrial coatings including primers, clear coats, topcoats, 2K systems, thinners, and specialty finishing products for body shops, fleet operators, and industrial applications across Uganda.',
  },
  {
    question: 'Does MS Coatings deliver nationwide in Uganda?',
    answer:
      'Yes. MS Coatings arranges delivery across Uganda so professional finishers, workshops, and businesses can receive coatings, primers, and clear coats where they work.',
  },
  {
    question: 'Can I order MS Coatings products online?',
    answer:
      'Yes. Browse the MS Coatings online catalog at mscoatings.shop, add products to your cart, and complete checkout in minutes with fast order processing and support.',
  },
  {
    question: 'What types of paint and coatings does MS Coatings offer?',
    answer:
      'MS Coatings offers acrylic paints, nitrocellulous paints, fast-dry systems, 2K clear coats, primers, synthetic resin bases, hardeners, and thinners for automotive refinish and industrial finishing.',
  },
  {
    question: 'How can I contact MS Coatings for technical support?',
    answer:
      `Contact MS Coatings by phone at ${formatPhoneListForText()}, email ${BUSINESS_INFO.email}, or WhatsApp for product guidance, order support, and technical questions about primers, clear coats, and coating systems.`,
  },
];

export const ABOUT_FAQS: SeoFaq[] = [
  {
    question: 'When was MS Coatings established?',
    answer:
      'MS Coatings has served customers in Uganda since 2019, supplying trusted automotive and industrial coating systems to professional finishers and businesses.',
  },
  {
    question: 'Who does MS Coatings serve?',
    answer:
      'MS Coatings serves automotive body shops, collision repair centers, fleet operators, industrial fabricators, and businesses that need reliable primers, clear coats, and finishing products.',
  },
];
