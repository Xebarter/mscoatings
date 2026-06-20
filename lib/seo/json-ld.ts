import { BRAND_NAME } from '@/lib/brand';
import { buildProductImageAlt, toAbsoluteImageUrl } from '@/lib/seo/images';
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

export function buildOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BRAND_NAME,
    url: getSiteUrl(),
    logo: absoluteUrl('/web-app-manifest-512x512.png'),
    description: DEFAULT_SITE_DESCRIPTION,
  };
}

export function buildWebSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND_NAME,
    url: getSiteUrl(),
    description: DEFAULT_SITE_DESCRIPTION,
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

export function buildProductSchema(product: SeoProduct) {
  const imageUrl = toAbsoluteImageUrl(product.image);
  const productUrl = getProductUrl(product.id);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${productUrl}#product`,
    name: product.name,
    description: product.description,
    category: product.category,
    image: imageUrl ? [imageUrl] : undefined,
    url: productUrl,
    brand: {
      '@type': 'Brand',
      name: BRAND_NAME,
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
      seller: {
        '@type': 'Organization',
        name: BRAND_NAME,
      },
    },
  };
}

export function buildProductImageObjectSchema(product: SeoProduct) {
  const imageUrl = toAbsoluteImageUrl(product.image);
  if (!imageUrl) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'ImageObject',
    contentUrl: imageUrl,
    url: imageUrl,
    name: buildProductImageAlt(product),
    description: product.description,
    caption: buildProductImageAlt(product),
    representativeOfPage: true,
    isPartOf: {
      '@type': 'WebPage',
      '@id': getProductUrl(product.id),
      name: `${product.name} | ${BRAND_NAME}`,
      url: getProductUrl(product.id),
    },
  };
}

export function buildProductPageGraph(product: SeoProduct) {
  const productSchema = buildProductSchema(product);
  const imageSchema = buildProductImageObjectSchema(product);

  return {
    '@context': 'https://schema.org',
    '@graph': imageSchema
      ? [productSchema, imageSchema]
      : [productSchema],
  };
}

export function buildProductItemListSchema(products: SeoProduct[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${BRAND_NAME} Product Catalog`,
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
