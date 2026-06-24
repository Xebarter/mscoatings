import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getAllProductsServer } from '@/lib/products-server';
import StructuredData from '@/components/structured-data';
import {
  getMarketingCategoryLabel,
  getUniqueCategoriesFromProducts,
  productMatchesMarketingCategory,
  slugToCategory,
} from '@/lib/seo/categories';
import {
  buildProductItemListSchema,
  buildWebPageSchema,
  buildSchemaGraph,
} from '@/lib/seo/json-ld';
import { buildPageMetadata } from '@/lib/seo/metadata';
import { SEO_KEYWORDS } from '@/lib/seo/site';
import CategoryPageClient from './category-page-client';

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

function filterProductsBySlug(
  products: Awaited<ReturnType<typeof getAllProductsServer>>,
  slug: string
) {
  const dbCategory = slugToCategory(
    slug,
    getUniqueCategoriesFromProducts(products)
  );

  if (dbCategory) {
    return products.filter((product) => product.category === dbCategory);
  }

  if (getMarketingCategoryLabel(slug)) {
    return products.filter((product) =>
      productMatchesMarketingCategory(product, slug)
    );
  }

  return null;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const products = await getAllProductsServer();
  const filtered = filterProductsBySlug(products, slug);

  if (!filtered) {
    return { title: 'Category Not Found', robots: { index: false, follow: false } };
  }

  const marketingLabel = getMarketingCategoryLabel(slug);
  const dbCategory = slugToCategory(
    slug,
    getUniqueCategoriesFromProducts(products)
  );
  const title = marketingLabel ?? dbCategory ?? 'Products';
  const description = `Shop ${title.toLowerCase()} from MS Coatings in Uganda. Professional automotive and industrial coatings with fast online ordering and nationwide delivery.`;

  return buildPageMetadata({
    title: `${title} — Buy Online Uganda`,
    description,
    path: `/products/category/${slug}`,
    keywords: [
      ...SEO_KEYWORDS,
      title,
      `${title} Uganda`,
      `buy ${title.toLowerCase()} Uganda`,
    ],
  });
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const products = await getAllProductsServer();
  const filtered = filterProductsBySlug(products, slug);

  if (!filtered) {
    notFound();
  }

  const marketingLabel = getMarketingCategoryLabel(slug);
  const dbCategory = slugToCategory(
    slug,
    getUniqueCategoriesFromProducts(products)
  );
  const title = marketingLabel ?? dbCategory ?? 'Products';
  const path = `/products/category/${slug}`;

  return (
    <>
      <StructuredData
        data={buildSchemaGraph([
          buildWebPageSchema({
            name: `${title} | MS Coatings`,
            description: `Browse ${title.toLowerCase()} from MS Coatings Uganda.`,
            path,
          }),
          buildProductItemListSchema(filtered, `${title} — MS Coatings`),
        ])}
      />
      <CategoryPageClient
        products={filtered}
        title={title}
        slug={slug}
      />
    </>
  );
}
