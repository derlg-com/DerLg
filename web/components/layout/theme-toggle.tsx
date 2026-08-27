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
  // wrong segment selected for a frame. Reserve the space instead. The real
  // control is content-width with a fixed height, so we match that.
  if (!hydrated) {
    return <div aria-hidden="true" className="h-10 w-[15rem] pointer-coarse:h-11" />
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
