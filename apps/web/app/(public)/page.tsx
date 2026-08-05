import Link from 'next/link';

import { PackageCard } from '@/components/catalog/PackageCard';
import { ApiStatusBadge } from '@/components/shared/ApiStatusBadge';
import { getTranslations, translate } from '@/lib/i18n';
import { fetchPublic } from '@/lib/server-api';
import type { PackageSummary } from '@/types/catalog';

/**
 * Featured packages are fetched on the server so the landing page is fully
 * rendered for crawlers and slow connections. A catalogue outage degrades to
 * the hero + explainer rather than an error page.
 */
async function loadFeatured(): Promise<PackageSummary[]> {
  try {
    const packages = await fetchPublic<PackageSummary[]>('/packages?featured=true&limit=3');
    return packages ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  // Server components use getTranslations; `useTranslations` is the same
  // function under a hook-shaped name for client components.
  const t = getTranslations('home');
  const tc = getTranslations('common');
  const featured = await loadFeatured();

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-16 px-6 py-16">
      <section className="flex flex-col gap-6">
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">
          {t('heroTitle')}
        </h1>
        <p className="max-w-2xl text-lg text-ink-600">{t('heroBody')}</p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/vibe"
            className="rounded-full bg-brand-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-brand-700"
          >
            {t('heroPrimaryCta')}
          </Link>
          <Link
            href="/packages"
            className="rounded-full border border-ink-300 px-6 py-3 text-base font-medium text-ink-800 transition-colors hover:bg-ink-100"
          >
            {t('heroSecondaryCta')}
          </Link>
        </div>
        <ApiStatusBadge />
      </section>

      {featured.length > 0 ? (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-ink-900">{t('featuredTitle')}</h2>
            <p className="max-w-2xl text-ink-600">{t('featuredBody')}</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((pkg, index) => (
              <PackageCard key={pkg.id} pkg={pkg} priority={index === 0} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-semibold text-ink-900">{t('howTitle')}</h2>
        <div className="grid gap-8 sm:grid-cols-2">
          <article className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ink-900">{t('howAiTitle')}</h3>
            <p className="text-ink-600">{t('howAiBody')}</p>
          </article>
          <article className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-ink-900">{t('howManualTitle')}</h3>
            <p className="text-ink-600">{t('howManualBody')}</p>
          </article>
        </div>
      </section>

      <footer className="text-sm text-ink-500">
        {tc('appName')} — {translate('common.tagline')}
      </footer>
    </main>
  );
}
