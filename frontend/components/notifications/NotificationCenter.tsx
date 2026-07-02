'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations, useLanguageStore } from '@/lib/i18n'
import { formatDateTime } from '@/lib/format'
import { useMounted } from '@/hooks/use-mounted'
import { useNotificationsStore } from '@/stores/notifications.store'

/**
 * Notification center (task 26.3, Requirements 19.6–19.8): a TopBar bell with an
 * unread-count badge that opens a dropdown of recent notifications. Each item
 * shows title/body/time and read/unread state; tapping marks it read and (if it
 * carries an `href`) navigates. Includes "mark all read". Reads from the
 * persisted {@link useNotificationsStore}; SSR-safe via {@link useMounted}.
 */
export function NotificationCenter() {
  const t = useTranslations('notifications')
  const locale = useLanguageStore((s) => s.locale)
  const router = useRouter()
  const mounted = useMounted()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const notifications = useNotificationsStore((s) => s.notifications)
  const markRead = useNotificationsStore((s) => s.markRead)
  const markAllRead = useNotificationsStore((s) => s.markAllRead)
  const remove = useNotificationsStore((s) => s.remove)

  const unread = mounted ? notifications.filter((n) => !n.read).length : 0

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function handleItemClick(id: string, href?: string) {
    markRead(id)
    if (href) {
      setOpen(false)
      router.push(href)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('open', { count: unread })}
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-lg p-2 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
            aria-hidden
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={t('title')}
          className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold">{t('title')}</p>
            {notifications.some((n) => !n.read) ? (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Check className="h-3.5 w-3.5" aria-hidden />
                {t('markAllRead')}
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => (
                  <li key={n.id} className="relative">
                    <button
                      type="button"
                      onClick={() => handleItemClick(n.id, n.href)}
                      className={cn(
                        'flex w-full items-start gap-2 px-4 py-3 pr-9 text-left transition-colors hover:bg-muted',
                        !n.read && 'bg-primary/5',
                      )}
                    >
                      {!n.read ? (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label={t('unread')}
                        />
                      ) : (
                        <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-foreground">{n.title}</span>
                        {n.body ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">
                            {n.body}
                          </span>
                        ) : null}
                        <span className="mt-1 block text-[11px] text-muted-foreground/80">
                          {formatDateTime(new Date(n.createdAt), locale)}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(n.id)}
                      aria-label={t('dismiss')}
                      className="absolute right-2 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
