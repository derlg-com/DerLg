import type { Metadata, Viewport } from 'next';

import { AppProviders } from '@/components/shared/AppProviders';

import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'DerLg — Cambodia trips, planned by conversation',
    template: '%s · DerLg',
  },
  description:
    'Plan and book Cambodia trips by chatting with an AI concierge, or browse and customize packages yourself.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#8a4b2a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
