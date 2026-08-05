import { RequireAuth } from '@/components/auth/RequireAuth';
import { SiteHeader } from '@/components/shared/SiteHeader';

/** Shell for routes that require a signed-in traveller. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <div className="flex-1">
        <RequireAuth>{children}</RequireAuth>
      </div>
    </div>
  );
}
