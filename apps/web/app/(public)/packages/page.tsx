import type { Metadata } from 'next';

import { PackageBrowser } from '@/components/catalog/PackageBrowser';
import { translate } from '@/lib/i18n';

export const metadata: Metadata = {
  title: translate('packages.listTitle'),
  description: translate('packages.listBody'),
};

export default function PackagesPage() {
  return <PackageBrowser />;
}
