import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import StructuredData from '@/components/structured-data';
import { buildBreadcrumbSchema } from '@/lib/seo/json-ld';
import type { BreadcrumbItem } from '@/lib/seo/json-ld';

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <>
      <StructuredData
        data={{
          '@context': 'https://schema.org',
          ...buildBreadcrumbSchema(items),
        }}
      />
      <nav
        aria-label="Breadcrumb"
        className={`flex items-center gap-1.5 text-xs text-body sm:gap-2 sm:text-sm ${className}`}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <span key={`${item.path}-${index}`} className="flex items-center gap-1.5 sm:gap-2">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400 sm:h-4 sm:w-4" />
              )}
              {isLast ? (
                <span className="font-medium text-navy">{item.name}</span>
              ) : (
                <Link
                  href={item.path}
                  className="text-premium-blue transition-colors hover:text-cyan"
                >
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
