'use client'

import { BookingShell } from '@/components/booking/BookingShell'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useLanguageStore, useTranslations, LOCALES, type Locale } from '@/lib/i18n'
import { usePreferencesStore, type NotificationKey } from '@/stores/preferences.store'
import type { Currency } from '@/types/api'

const LOCALE_LABEL: Record<Locale, string> = { en: 'English', zh: '中文', km: 'ខ្មែរ' }
const NOTIF_KEYS: NotificationKey[] = ['push', 'email', 'reminders']

function Inner() {
  const t = useTranslations('profile')
  const locale = useLanguageStore((s) => s.locale)
  const setLocale = useLanguageStore((s) => s.setLocale)
  const currency = usePreferencesStore((s) => s.currency)
  const setCurrency = usePreferencesStore((s) => s.setCurrency)
  const notifications = usePreferencesStore((s) => s.notifications)
  const setNotification = usePreferencesStore((s) => s.setNotification)

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
      <h1 className="text-xl font-bold text-foreground">{t('preferences.title')}</h1>

      <Card className="space-y-1.5 p-4">
        <Label htmlFor="pref-language">{t('preferences.language')}</Label>
        <Select
          id="pref-language"
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {LOCALE_LABEL[l]}
            </option>
          ))}
        </Select>
      </Card>

      <Card className="space-y-1.5 p-4">
        <Label htmlFor="pref-currency">{t('preferences.currency')}</Label>
        <Select
          id="pref-currency"
          value={currency ?? ''}
          onChange={(e) => setCurrency(e.target.value ? (e.target.value as Currency) : null)}
        >
          <option value="">{t('preferences.autoCurrency')}</option>
          <option value="USD">USD</option>
          <option value="KHR">KHR</option>
          <option value="CNY">CNY</option>
        </Select>
      </Card>

      <Card className="space-y-3 p-4">
        <Label>{t('preferences.notifications')}</Label>
        {NOTIF_KEYS.map((k) => (
          <div key={k} className="flex items-center justify-between">
            <span className="text-sm text-foreground">{t(`preferences.notif.${k}`)}</span>
            <Switch
              checked={notifications[k]}
              onCheckedChange={(v) => setNotification(k, v)}
              aria-label={t(`preferences.notif.${k}`)}
            />
          </div>
        ))}
      </Card>
    </div>
  )
}

export function PreferencesView() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
