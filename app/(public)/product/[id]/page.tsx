import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductByIdServer } from '@/lib/products-server';
import {
  buildProductImageAlt,
  toAbsoluteImageUrl,
} from '@/lib/seo/images';
import {
  buildProductPageGraph,
  type BreadcrumbItem,
} from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { buildPageTitle, getProductUrl, SEO_KEYWORDS } from '@/lib/seo/site';
import StructuredData from '@/components/structured-data';
import ProductDetailClient from './product-detail-client';

export const revalidate = 60;

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByIdServer(id);

  if (!product) {
    return {
      title: buildPageTitle('Product Not Found'),
      robots: { index: false, follow: false },
    };
  }

  const imageUrl = toAbsoluteImageUrl(product.image);
  const description =
    product.description ||
    `Buy ${product.name} — ${product.category} coating from MS Coatings Uganda. Professional automotive and industrial paint supplies with online ordering.`;
  const alt = buildProductImageAlt(product);

  return {
    ...buildPageMetadata({
      title: product.name,
      description,
      path: `/product/${product.id}`,
      keywords: [
        ...SEO_KEYWORDS,
        product.name,
        product.category,
        `${product.name} Uganda`,
        `buy ${product.name}`,
      ],
      image: imageUrl ?? undefined,
      imageAlt: alt,
    }),
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: getProductUrl(product.id),
      images: imageUrl
        ? [{ url: imageUrl, alt, width: 1200, height: 1200 }]
        : undefined,
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductByIdServer(id);

  if (!product) {
    notFound();
  }

  const breadcrumbs: BreadcrumbItem[] = [
    { name: 'Home', path: '/' },
    { name: 'Products', path: '/products' },
    { name: product.name, path: `/product/${product.id}` },
  ];

  return (
    <>
      <StructuredData data={buildProductPageGraph(product)} />
      <ProductDetailClient product={product} breadcrumbs={breadcrumbs} />
    </>
  );
}
