'use client'

import { Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/lib/i18n'
import { useMounted } from '@/hooks/use-mounted'
import { useFestivalRemindersStore } from '@/stores/festival-reminders.store'
import { usePushNotifications } from '@/hooks/use-push-notifications'
import { usePreferencesStore } from '@/stores/preferences.store'
import { pushAppNotification } from '@/stores/notifications.store'
import { toast } from '@/components/ui/toast'

export interface FestivalReminderToggleProps {
  festivalId: string
  festivalName: string
  startDate: string
  className?: string
}

/**
 * Reminder toggle for a (favorited) festival (task 25.4, Requirement 41.8).
 *
 * Enabling stores the reminder *intent* locally (survives reloads) and, when the
 * user's reminder preference is on and notifications are permitted, shows a
 * confirmation via a local notification + the in-app notification center.
 *
 * GRACEFUL DEGRADATION: there is no backend reminder-scheduling endpoint and
 * push delivery may be unavailable (no Firebase/VAPID config). So this never
 * schedules a server-side push; it records intent locally and confirms via a
 * local Notification when granted, otherwise just via an in-app toast. The
 * push pref (task 26.4) gates the OS-permission prompt.
 */
export function FestivalReminderToggle({
  festivalId,
  festivalName,
  startDate,
  className,
}: FestivalReminderToggleProps) {
  const t = useTranslations('festivals')
  const mounted = useMounted()
  const enabled = useFestivalRemindersStore((s) => Boolean(s.reminders[festivalId]))
  const toggle = useFestivalRemindersStore((s) => s.toggle)
  const remindersPref = usePreferencesStore((s) => s.notifications.reminders)
  const { isSupported, permission, pushEnabledPref, requestPermission } = usePushNotifications()

  // Avoid SSR/hydration mismatch on persisted state.
  const isOn = mounted && enabled

  async function handleToggle() {
    const nowOn = toggle(festivalId, startDate)

    if (!nowOn) {
      toast({ description: t('reminder.removed', { name: festivalName }) })
      return
    }

    // Respect reminder preference (task 26.4): don't prompt/show OS notifications
    // when the user has disabled reminders — still keep the local intent.
    if (remindersPref && pushEnabledPref && isSupported) {
      const perm = permission === 'granted' ? 'granted' : await requestPermission()
      if (perm === 'granted' && typeof Notification !== 'undefined') {
        try {
          new Notification(t('reminder.notifTitle'), {
            body: t('reminder.notifBody', { name: festivalName }),
          })
        } catch {
          // Some browsers require notifications be shown via the SW; ignore.
        }
      }
    }

    // Always record in the in-app notification center + a toast for feedback.
    pushAppNotification({
      title: t('reminder.notifTitle'),
      body: t('reminder.notifBody', { name: festivalName }),
      href: `/festivals/${festivalId}`,
    })
    toast({ variant: 'success', description: t('reminder.added', { name: festivalName }) })
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-pressed={isOn}
      aria-label={isOn ? t('reminder.disable') : t('reminder.enable')}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isOn
          ? 'border-transparent bg-primary/10 text-primary'
          : 'border-border bg-background text-foreground hover:bg-muted',
        className,
      )}
    >
      {isOn ? (
        <Bell className="h-4 w-4" aria-hidden />
      ) : (
        <BellOff className="h-4 w-4" aria-hidden />
      )}
      {isOn ? t('reminder.on') : t('reminder.off')}
    </button>
  )
}
