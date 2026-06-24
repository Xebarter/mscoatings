/** Shared noindex metadata for transactional routes */
import type { Metadata } from 'next';
import { NOINDEX_ROBOTS } from '@/lib/seo/metadata';

export function buildNoIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: NOINDEX_ROBOTS,
  };
}
