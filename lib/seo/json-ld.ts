import { BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';
import { BUSINESS_INFO, SOCIAL_PROFILE_URLS } from '@/lib/seo/business';
import { buildProductImageAlt, toAbsoluteImageUrl } from '@/lib/seo/images';
import type { SeoFaq } from '@/lib/seo/faqs';
import {
  absoluteUrl,
  DEFAULT_SITE_DESCRIPTION,
  getProductUrl,
  getSiteUrl,
} from '@/lib/seo/site';

export interface SeoProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  image: string;
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildSchemaGraph(nodes: Record<string, unknown>[]) {
  return {
    '@context': 'https://schema.org',
    '@graph': nodes,
  };
}

export function buildOrganizationSchema() {
  return {
    '@type': ['Organization', 'Brand'],
    '@id': `${getSiteUrl()}#organization`,
    name: BRAND_NAME,
    legalName: BUSINESS_INFO.legalName,
    url: getSiteUrl(),
    logo: absoluteUrl('/web-app-manifest-512x512.png'),
    image: absoluteUrl('/web-app-manifest-512x512.png'),
    description: DEFAULT_SITE_DESCRIPTION,
    foundingDate: BUSINESS_INFO.foundingDate,
    email: BUSINESS_INFO.email,
    telephone: BUSINESS_INFO.telephone,
    areaServed: BUSINESS_INFO.areaServed,
    ...(SOCIAL_PROFILE_URLS.length > 0 ? { sameAs: SOCIAL_PROFILE_URLS } : {}),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_INFO.telephone,
        email: BUSINESS_INFO.email,
        contactType: 'customer service',
        areaServed: 'UG',
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        telephone: BUSINESS_INFO.telephone,
        contactType: 'sales',
        areaServed: 'UG',
        availableLanguage: ['English'],
      },
    ],
  };
}

export function buildLocalBusinessSchema() {
  return {
    '@type': ['Store', 'AutoPartsStore'],
    '@id': `${getSiteUrl()}#store`,
    name: BRAND_NAME,
    description: DEFAULT_SITE_DESCRIPTION,
    url: getSiteUrl(),
    image: absoluteUrl('/web-app-manifest-512x512.png'),
    logo: absoluteUrl('/web-app-manifest-512x512.png'),
    telephone: BUSINESS_INFO.telephone,
    email: BUSINESS_INFO.email,
    priceRange: BUSINESS_INFO.priceRange,
    currenciesAccepted: BUSINESS_INFO.currenciesAccepted,
    paymentAccepted: BUSINESS_INFO.paymentAccepted,
    openingHoursSpecification: BUSINESS_INFO.openingHours.map((hours) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      opens: '08:00',
      closes: '18:00',
    })),
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS_INFO.address.streetAddress,
      addressLocality: BUSINESS_INFO.address.addressLocality,
      addressRegion: BUSINESS_INFO.address.addressRegion,
      addressCountry: BUSINESS_INFO.address.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: BUSINESS_INFO.geo.latitude,
      longitude: BUSINESS_INFO.geo.longitude,
    },
    areaServed: {
      '@type': 'Country',
      name: 'Uganda',
    },
    parentOrganization: {
      '@id': `${getSiteUrl()}#organization`,
    },
    ...(SOCIAL_PROFILE_URLS.length > 0 ? { sameAs: SOCIAL_PROFILE_URLS } : {}),
  };
}

export function buildWebSiteSchema() {
  return {
    '@type': 'WebSite',
    '@id': `${getSiteUrl()}#website`,
    name: BRAND_NAME,
    alternateName: ['MS Coatings Shop', 'MS Coatings Uganda'],
    url: getSiteUrl(),
    description: DEFAULT_SITE_DESCRIPTION,
    publisher: {
      '@id': `${getSiteUrl()}#organization`,
    },
    inLanguage: 'en-UG',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getSiteUrl()}/products?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function buildWebPageSchema({
  name,
  description,
  path,
}: {
  name: string;
  description: string;
  path: string;
}) {
  const url = absoluteUrl(path);

  return {
    '@type': 'WebPage',
    '@id': `${url}#webpage`,
    url,
    name,
    description,
    isPartOf: {
      '@id': `${getSiteUrl()}#website`,
    },
    about: {
      '@id': `${getSiteUrl()}#organization`,
    },
    inLanguage: 'en-UG',
  };
}

export function buildBreadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildFaqSchema(faqs: SeoFaq[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };
}

export function buildGlobalSchemaGraph() {
  return buildSchemaGraph([
    buildOrganizationSchema(),
    buildLocalBusinessSchema(),
    buildWebSiteSchema(),
  ]);
}

export function buildProductSchema(product: SeoProduct) {
  const imageUrl = toAbsoluteImageUrl(product.image);
  const productUrl = getProductUrl(product.id);
  const description =
    product.description ||
    `${product.name} — professional ${product.category} from ${BRAND_NAME} in Uganda.`;

  return {
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    description,
    category: product.category,
    sku: product.id,
    mpn: product.id,
    image: imageUrl ? [imageUrl] : undefined,
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
    },
    manufacturer: {
      '@id': `${getSiteUrl()}#organization`,
    },
    offers: {
      '@type': 'Offer',
      url: productUrl,
      priceCurrency: 'UGX',
      price: product.price,
      availability:
        product.stock > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: {
        '@id': `${getSiteUrl()}#store`,
      },
    },
  };
}

export function buildProductImageObjectSchema(product: SeoProduct) {
  const imageUrl = toAbsoluteImageUrl(product.image);
  if (!imageUrl) return null;

  return {
    '@type': 'ImageObject',
    '@id': `${getProductUrl(product.id)}#image`,
    contentUrl: imageUrl,
    url: imageUrl,
    name: buildProductImageAlt(product),
    description:
      product.description ||
      `${product.name} — ${product.category} coating product image from ${BRAND_NAME}.`,
    caption: buildProductImageAlt(product),
    representativeOfPage: true,
    isPartOf: {
      '@id': `${getProductUrl(product.id)}#webpage`,
    },
  };
}

export function buildProductPageGraph(
  product: SeoProduct,
  breadcrumbs?: BreadcrumbItem[]
) {
  const productUrl = getProductUrl(product.id);
  const nodes: Record<string, unknown>[] = [
    buildWebPageSchema({
      name: `${product.name} | ${BRAND_NAME}`,
      description:
        product.description ||
        `Buy ${product.name} — ${product.category} from ${BRAND_NAME}, Uganda.`,
      path: `/product/${product.id}`,
    }),
    buildProductSchema(product),
  ];

  const imageSchema = buildProductImageObjectSchema(product);
  if (imageSchema) nodes.push(imageSchema);

  if (breadcrumbs?.length) {
    nodes.push(buildBreadcrumbSchema(breadcrumbs));
  }

  return buildSchemaGraph(nodes);
}

export function buildProductItemListSchema(
  products: SeoProduct[],
  listName = `${BRAND_NAME} Product Catalog`
) {
  return {
    '@type': 'ItemList',
    name: listName,
    numberOfItems: products.length,
    itemListElement: products.map((product, index) => {
      const imageUrl = toAbsoluteImageUrl(product.image);
      return {
        '@type': 'ListItem',
        position: index + 1,
        url: getProductUrl(product.id),
        item: {
          '@type': 'Product',
          name: product.name,
          description: product.description,
          image: imageUrl ?? undefined,
          url: getProductUrl(product.id),
          brand: {
            '@type': 'Brand',
            name: BRAND_NAME,
          },
        },
      };
    }),
  };
}

export function buildHomePageSchema(faqs: SeoFaq[]) {
  return buildSchemaGraph([
    buildWebPageSchema({
      name: `${BRAND_NAME} — ${BRAND_TAGLINE}`,
      description: DEFAULT_SITE_DESCRIPTION,
      path: '/',
    }),
    buildFaqSchema(faqs),
  ]);
}

export function buildAboutPageSchema(faqs: SeoFaq[]) {
  return buildSchemaGraph([
    buildWebPageSchema({
      name: `About ${BRAND_NAME}`,
      description: `Learn about ${BRAND_NAME} — Uganda's trusted supplier of professional automotive and industrial coating systems since 2019.`,
      path: '/about',
    }),
    buildFaqSchema(faqs),
  ]);
}

export function buildContactPageSchema() {
  return buildSchemaGraph([
    buildWebPageSchema({
      name: `Contact ${BRAND_NAME}`,
      description:
        'Contact MS Coatings for product inquiries, order support, technical advice, and wholesale orders in Uganda.',
      path: '/contact',
    }),
    {
      '@type': 'ContactPage',
      '@id': `${absoluteUrl('/contact')}#contactpage`,
      url: absoluteUrl('/contact'),
      name: `Contact ${BRAND_NAME}`,
      description:
        'Reach MS Coatings by phone, email, or WhatsApp for coatings, primers, and clear coat support.',
      mainEntity: {
        '@id': `${getSiteUrl()}#store`,
      },
    },
  ]);
}
