import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductByIdServer } from '@/lib/products-server';
import {
  buildProductImageAlt,
  toAbsoluteImageUrl,
} from '@/lib/seo/images';
import { buildProductPageGraph } from '@/lib/seo/json-ld';
import {
  buildPageTitle,
  getProductUrl,
} from '@/lib/seo/site';
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
      title: 'Product Not Found',
      robots: { index: false, follow: false },
    };
  }

  const imageUrl = toAbsoluteImageUrl(product.image);
  const title = buildPageTitle(product.name);
  const description =
    product.description ||
    `${product.name} — ${product.category} from MS Coatings.`;
  const alt = buildProductImageAlt(product);
  const canonical = getProductUrl(product.id);

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title: product.name,
      description,
      url: canonical,
      images: imageUrl
        ? [{ url: imageUrl, alt, width: 1200, height: 1200 }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = await getProductByIdServer(id);

  if (!product) {
    notFound();
  }

  return (
    <>
      <StructuredData data={buildProductPageGraph(product)} />
      <ProductDetailClient product={product} />
    </>
  );
}
