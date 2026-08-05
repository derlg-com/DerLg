import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PackageDetailView } from '@/components/catalog/PackageDetailView';
import { fetchPublic } from '@/lib/server-api';
import type { PackageDetail } from '@/types/catalog';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function loadPackage(slug: string): Promise<PackageDetail | null> {
  return fetchPublic<PackageDetail>(`/packages/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const pkg = await loadPackage(slug);

  if (!pkg) {
    return { title: 'Package not found' };
  }

  return {
    title: pkg.title,
    description: pkg.summary,
    openGraph: {
      title: pkg.title,
      description: pkg.summary,
      images: pkg.heroImageUrl ? [{ url: pkg.heroImageUrl }] : undefined,
      type: 'website',
    },
  };
}

export default async function PackageDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const pkg = await loadPackage(slug);

  if (!pkg) {
    notFound();
  }

  return <PackageDetailView pkg={pkg} />;
}
