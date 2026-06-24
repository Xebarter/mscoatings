export function categoryToSlug(category: string): string {
  return category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugToCategory(
  slug: string,
  categories: string[]
): string | null {
  const normalized = slug.trim().toLowerCase();
  return (
    categories.find((category) => categoryToSlug(category) === normalized) ??
    null
  );
}

export function getCategoryPath(category: string): string {
  return `/products/category/${categoryToSlug(category)}`;
}

export function getUniqueCategoriesFromProducts(
  products: Array<{ category: string }>
): string[] {
  return Array.from(
    new Set(
      products
        .map((product) => product.category.trim())
        .filter(Boolean)
    )
  ).sort();
}

/** Footer/marketing category groups mapped to search keywords */
export const MARKETING_CATEGORIES = [
  {
    label: 'Clear Coats',
    slug: 'clear-coats',
    keywords: ['clear coat', 'clear', '2k clear', 'acrylic clear'],
  },
  {
    label: 'Primers',
    slug: 'primers',
    keywords: ['primer', 'nc white', 'fd white', 'base'],
  },
  {
    label: 'Top Coats',
    slug: 'top-coats',
    keywords: ['topcoat', 'top coat', 'acrylic', 'nitrocellulous', '2k'],
  },
  {
    label: 'Thinners',
    slug: 'thinners',
    keywords: ['thinner'],
  },
  {
    label: 'Industrial Finishes',
    slug: 'industrial-finishes',
    keywords: ['industrial', 'resin', 'synthetic', 'hardener'],
  },
] as const;

export function productMatchesMarketingCategory(
  product: { name: string; category: string; description?: string },
  marketingSlug: string
): boolean {
  const group = MARKETING_CATEGORIES.find((item) => item.slug === marketingSlug);
  if (!group) return false;

  const haystack =
    `${product.name} ${product.category} ${product.description ?? ''}`.toLowerCase();

  return group.keywords.some((keyword) => haystack.includes(keyword));
}

export function getMarketingCategoryLabel(slug: string): string | null {
  return MARKETING_CATEGORIES.find((item) => item.slug === slug)?.label ?? null;
}
