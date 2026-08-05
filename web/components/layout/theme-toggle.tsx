'use client'

import { Monitor, Moon, Sun } from 'lucide-react'

import { SegmentedControl } from '@/components/ui'
import { useHydrated } from '@/hooks/use-hydrated'
import { useTheme } from '@/hooks/use-theme'
import type { ThemePreference } from '@/lib/theme'

const OPTIONS = [
  { value: 'light' as const, label: 'Light', icon: <Sun aria-hidden="true" className="size-4" /> },
  { value: 'dark' as const, label: 'Dark', icon: <Moon aria-hidden="true" className="size-4" /> },
  {
    value: 'system' as const,
    label: 'System',
    icon: <Monitor aria-hidden="true" className="size-4" />,
  },
] satisfies readonly { value: ThemePreference; label: string; icon: React.ReactNode }[]

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, setTheme } = useTheme()
  const hydrated = useHydrated()

  // The stored preference is unknown during SSR; rendering a guess would show the
  // wrong segment selected for a frame. Reserve the space instead.
  if (!hydrated) {
    return <div aria-hidden="true" className="h-11 w-[13.5rem] sm:h-9" />
  }

  return (
    <SegmentedControl
      label="Colour theme"
      value={preference}
      onValueChange={setTheme}
      options={OPTIONS}
      className={className}
    />
  )
}
