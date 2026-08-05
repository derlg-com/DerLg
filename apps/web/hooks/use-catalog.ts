'use client';

import { useQuery } from '@tanstack/react-query';

import { type Page, api } from '@/lib/api-client';
import type { City, PackageDetail, PackageSummary } from '@/types/catalog';

export interface PackageFilters {
  city?: string;
  kind?: 'PUBLIC' | 'PRIVATE';
  minDays?: number;
  maxDays?: number;
  minPrice?: number;
  maxPrice?: number;
  kidFriendly?: boolean;
  q?: string;
  sort?: 'featured' | 'price_asc' | 'price_desc' | 'duration_asc' | 'newest';
  page?: number;
  limit?: number;
}

/** Serialises filters into the query string the API expects. */
export function packageFiltersToQuery(filters: PackageFilters): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '' || value === null) {
      continue;
    }
    // The API distinguishes kidFriendly=false from "not filtered", so booleans
    // are sent as explicit strings.
    params.set(key, typeof value === 'boolean' ? String(value) : String(value));
  }

  const query = params.toString();
  return query ? `?${query}` : '';
}

export const catalogKeys = {
  packages: (filters: PackageFilters) => ['packages', filters] as const,
  package: (slug: string) => ['package', slug] as const,
  cities: () => ['cities'] as const,
};

export function usePackages(filters: PackageFilters = {}) {
  return useQuery({
    queryKey: catalogKeys.packages(filters),
    queryFn: () =>
      api.getPage<PackageSummary>(`/packages${packageFiltersToQuery(filters)}`, {
        authenticated: false,
      }),
    placeholderData: (previous) => previous as Page<PackageSummary> | undefined,
  });
}

export function usePackage(slug: string) {
  return useQuery({
    queryKey: catalogKeys.package(slug),
    queryFn: () => api.get<PackageDetail>(`/packages/${slug}`, { authenticated: false }),
    enabled: slug.length > 0,
  });
}

export function useCities() {
  return useQuery({
    queryKey: catalogKeys.cities(),
    queryFn: () => api.get<City[]>('/cities', { authenticated: false }),
    staleTime: 10 * 60 * 1000,
  });
}
