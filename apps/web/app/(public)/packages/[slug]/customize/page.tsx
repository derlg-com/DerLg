import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CustomizeSession } from '@/components/journey/CustomizeSession';
import { SiteHeader } from '@/components/shared/SiteHeader';
import { translate } from '@/lib/i18n';
import { fetchPublic } from '@/lib/server-api';
import type { PackageDetail } from '@/types/catalog';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: translate('customize.title'),
  description: translate('customize.subtitle'),
  // A personal editing session should never be indexed.
  robots: { index: false, follow: false },
};

export default async function CustomizePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;

  // Confirm the package exists server-side so a bad slug 404s rather than
  // failing later inside the editor.
  const pkg = await fetchPublic<PackageDetail>(`/packages/${encodeURIComponent(slug)}`);
  if (!pkg) {
    notFound();
  }

  const draftId = Array.isArray(query.draft) ? query.draft[0] : query.draft;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <CustomizeSession
        packageSlug={slug}
        cityForPicker={pkg.city.slug}
        draftIdFromQuery={draftId ?? null}
      />
    </div>
  );
}
