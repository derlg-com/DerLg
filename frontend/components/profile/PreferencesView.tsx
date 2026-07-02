'use client'

import { useState } from 'react'
import { BookingShell } from '@/components/booking/BookingShell'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { useLanguageStore, useTranslations, LOCALES, type Locale } from '@/lib/i18n'
import { usePreferencesStore, type NotificationKey, type Theme } from '@/stores/preferences.store'
import { useDeleteAccount } from '@/hooks/use-delete-account'
import type { Currency } from '@/types/api'

const LOCALE_LABEL: Record<Locale, string> = { en: 'English', zh: '中文', km: 'ខ្មែរ' }
const NOTIF_KEYS: NotificationKey[] = ['push', 'email', 'reminders']
const THEMES: Theme[] = ['system', 'light', 'dark']

function DeleteAccountSection() {
  const t = useTranslations('profile')
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const { deleteAccount, isDeleting } = useDeleteAccount()

  const confirmWord = t('deleteAccount.confirmWord')
  const canConfirm = confirmText.trim() === confirmWord && !isDeleting

  async function handleConfirm() {
    const ok = await deleteAccount()
    if (ok) {
      toast({ variant: 'success', title: t('deleteAccount.success') })
    } else {
      toast({ variant: 'error', title: t('deleteAccount.error') })
      setOpen(false)
    }
  }

  return (
    <Card className="space-y-3 border-destructive/40 p-4">
      <div className="space-y-1">
        <Label className="text-destructive">{t('deleteAccount.section')}</Label>
        <p className="text-sm text-muted-foreground">{t('deleteAccount.description')}</p>
      </div>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        {t('deleteAccount.button')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) setConfirmText('')
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteAccount.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('deleteAccount.dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="delete-confirm">{t('deleteAccount.confirmLabel')}</Label>
            <Input
              id="delete-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              aria-label={t('deleteAccount.confirmLabel')}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isDeleting}>
              {t('deleteAccount.cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm}>
              {isDeleting ? t('deleteAccount.deleting') : t('deleteAccount.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function Inner() {
  const t = useTranslations('profile')
  const locale = useLanguageStore((s) => s.locale)
  const setLocale = useLanguageStore((s) => s.setLocale)
  const currency = usePreferencesStore((s) => s.currency)
  const setCurrency = usePreferencesStore((s) => s.setCurrency)
  const theme = usePreferencesStore((s) => s.theme)
  const setTheme = usePreferencesStore((s) => s.setTheme)
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
        <Label htmlFor="pref-theme">{t('preferences.theme')}</Label>
        <Select id="pref-theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
          {THEMES.map((th) => (
            <option key={th} value={th}>
              {t(`preferences.themeOption.${th}`)}
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

      <DeleteAccountSection />
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
