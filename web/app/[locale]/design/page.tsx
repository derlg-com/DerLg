import type { Metadata } from 'next'

import { DesignKitchenSink } from '@/components/design/design-kitchen-sink'
import { ToastProvider } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Design system',
  // Internal reference page — keep it out of search results.
  robots: { index: false, follow: false },
}

export default function DesignPage() {
  return (
    <ToastProvider>
      <DesignKitchenSink />
    </ToastProvider>
  )
}
