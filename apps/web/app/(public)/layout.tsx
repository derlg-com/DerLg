import { SiteHeader } from '@/components/shared/SiteHeader';

/** Shell for public marketing/catalogue routes. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
    </div>
  );
}
