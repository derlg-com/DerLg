import { SiteHeader } from '@/components/shared/SiteHeader';

/** Centred card shell for sign-in / sign-up. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-start justify-center px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-ink-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
