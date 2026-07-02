'use client'

import { useEffect, useState } from 'react'
import { Siren, MapPin, Phone, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { GoogleMapView } from '@/components/shared/GoogleMapView'
import { useEmergencyAlert } from '@/hooks/use-emergency-alert'
import { useCountdown } from '@/hooks/use-countdown'
import {
  sendEmergencyAlert,
  fetchEmergencyContacts,
  CAMBODIA_EMERGENCY_CONTACTS,
} from '@/lib/emergency-api'
import { useTranslations } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { EmergencyAlertType, EmergencyContact } from '@/types/domain'

/** Seconds the user has to cancel before the alert is sent (Req 10.8). */
export const EMERGENCY_COUNTDOWN_SECONDS = 5

/** Selectable alert types (Req 10 — sos/medical/theft/lost). */
const ALERT_TYPES: EmergencyAlertType[] = ['sos', 'medical', 'theft', 'lost']

/** Known static contact serviceNames that have an `emergency.contacts.*` i18n key. */
const KNOWN_CONTACT_KEYS = new Set(['police', 'fire', 'ambulance', 'touristPolice'])

/**
 * Resolve a contact's display label. Static Cambodia contacts use an i18n key as
 * `serviceName` (translated here); contacts returned by the backend carry a
 * human-readable name we display verbatim.
 */
function contactLabel(
  c: EmergencyContact,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  return KNOWN_CONTACT_KEYS.has(c.serviceName) ? t(`contacts.${c.serviceName}`) : c.serviceName
}

type Phase = 'select' | 'counting' | 'sending' | 'sent' | 'error'

export interface EmergencyAlertModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Booking the alert is associated with (sent to the backend). */
  bookingId: string
}

/**
 * Emergency Alert flow modal (Requirements 10.2–10.8).
 *
 * Flow: pick an alert type → capture location (GPS, with manual fallback on
 * permission denial) → preview the location on a map → confirm, which starts a
 * 5-second cancellable countdown → on countdown completion the alert is POSTed →
 * a confirmation screen shows local emergency contact numbers. If the POST
 * fails the UI still surfaces the static Cambodia numbers so help is reachable.
 */
export function EmergencyAlertModal({ open, onOpenChange, bookingId }: EmergencyAlertModalProps) {
  const t = useTranslations('emergency')
  const {
    coords,
    status,
    error: geoError,
    requestLocation,
    setManualCoords,
    reset,
  } = useEmergencyAlert()

  const [alertType, setAlertType] = useState<EmergencyAlertType>('sos')
  const [phase, setPhase] = useState<Phase>('select')
  const [manualLat, setManualLat] = useState('')
  const [manualLng, setManualLng] = useState('')
  const [contacts, setContacts] = useState<EmergencyContact[]>(CAMBODIA_EMERGENCY_CONTACTS)

  // Reset all local + hook state whenever the modal opens, and request GPS once.
  useEffect(() => {
    if (!open) return
    // Intentional reset-on-open to start a fresh alert flow each time the modal
    // is shown; synchronizes UI state with the newly-opened dialog.
    /* eslint-disable react-hooks/set-state-in-effect */
    setAlertType('sos')
    setPhase('select')
    setManualLat('')
    setManualLng('')
    setContacts(CAMBODIA_EMERGENCY_CONTACTS)
    /* eslint-enable react-hooks/set-state-in-effect */
    reset()
    requestLocation()
  }, [open, reset, requestLocation])

  async function doSend() {
    if (!coords) return
    setPhase('sending')
    // Best-effort: fetch locale-specific contacts; fall back to static list.
    const remote = await fetchEmergencyContacts()
    if (remote && remote.length > 0) setContacts(remote)
    try {
      await sendEmergencyAlert({
        alertType,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracyMeters: coords.accuracyMeters ?? null,
        bookingId,
      })
      setPhase('sent')
    } catch {
      // Degrade gracefully (Req 10.5): surface the error but still show contacts.
      setPhase('error')
    }
  }

  const { remaining } = useCountdown({
    seconds: EMERGENCY_COUNTDOWN_SECONDS,
    active: phase === 'counting',
    onComplete: () => {
      void doSend()
    },
  })

  function handleManualSubmit() {
    setManualCoords(Number(manualLat), Number(manualLng))
  }

  function handleClose() {
    setPhase('select')
    onOpenChange(false)
  }

  const hasLocation = status === 'ready' && coords !== null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent data-testid="emergency-alert-modal" className="sm:max-w-md">
        {/* ---- Confirmation / error: always show emergency contacts (Req 10.5) ---- */}
        {phase === 'sent' || phase === 'error' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {phase === 'sent' ? (
                  <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
                )}
                {phase === 'sent' ? t('confirm.title') : t('error.title')}
              </DialogTitle>
              <DialogDescription>
                {phase === 'sent' ? t('confirm.desc') : t('error.desc')}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">{t('contacts.heading')}</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span className="flex items-center gap-2 text-foreground">
                      <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
                      {contactLabel(c, t)}
                    </span>
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, '')}`}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {c.phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>{t('confirm.done')}</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Siren className="h-5 w-5 text-destructive" aria-hidden />
                {t('modal.title')}
              </DialogTitle>
              <DialogDescription>{t('modal.desc')}</DialogDescription>
            </DialogHeader>

            {/* ---- Alert type selection (Req 10) ---- */}
            <fieldset className="space-y-2" disabled={phase !== 'select'}>
              <legend className="mb-1 text-sm font-medium text-foreground">
                {t('modal.typeLabel')}
              </legend>
              <div
                className="grid grid-cols-2 gap-2"
                role="radiogroup"
                aria-label={t('modal.typeLabel')}
              >
                {ALERT_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={alertType === type}
                    onClick={() => setAlertType(type)}
                    data-testid={`alert-type-${type}`}
                    className={cn(
                      'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                      alertType === type
                        ? 'border-destructive bg-destructive/10 text-destructive'
                        : 'border-border text-foreground hover:bg-accent',
                    )}
                  >
                    {t(`types.${type}`)}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* ---- Location capture + map preview (Req 10.3/10.6/10.7) ---- */}
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" aria-hidden />
                {t('modal.locationLabel')}
              </p>

              {status === 'locating' ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Spinner size="sm" /> {t('location.locating')}
                </p>
              ) : null}

              {status === 'error' ? (
                <p className="text-sm text-destructive">{t('location.error')}</p>
              ) : null}

              {status === 'denied' ? (
                <div
                  className="space-y-2 rounded-lg border border-border p-3"
                  data-testid="manual-entry"
                >
                  <p className="text-sm text-muted-foreground">{t('location.denied')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label htmlFor="emg-lat">{t('location.latLabel')}</Label>
                      <Input
                        id="emg-lat"
                        inputMode="decimal"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                        placeholder="11.5564"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="emg-lng">{t('location.lngLabel')}</Label>
                      <Input
                        id="emg-lng"
                        inputMode="decimal"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                        placeholder="104.9282"
                      />
                    </div>
                  </div>
                  {geoError === 'invalid_coords' ? (
                    <p className="text-sm text-destructive">{t('location.invalid')}</p>
                  ) : null}
                  <Button variant="outline" size="sm" onClick={handleManualSubmit}>
                    {t('location.useManual')}
                  </Button>
                </div>
              ) : null}

              {hasLocation && coords ? (
                <GoogleMapView
                  lat={coords.latitude}
                  lng={coords.longitude}
                  label={t('location.youAreHere')}
                  className="h-40"
                />
              ) : null}
            </div>

            {/* ---- Countdown banner (Req 10.7/10.8) ---- */}
            {phase === 'counting' ? (
              <div
                className="rounded-lg bg-destructive/10 p-3 text-center text-sm font-medium text-destructive"
                role="alert"
                data-testid="emergency-countdown"
              >
                {t('countdown.sendingIn', { seconds: remaining })}
              </div>
            ) : null}

            <DialogFooter>
              {phase === 'counting' ? (
                <Button
                  variant="outline"
                  onClick={() => setPhase('select')}
                  data-testid="emergency-cancel"
                  className="sm:flex-1"
                >
                  {t('countdown.cancel')}
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleClose} className="sm:flex-1">
                    {t('modal.close')}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => setPhase('counting')}
                    disabled={!hasLocation || phase === 'sending'}
                    data-testid="emergency-send"
                    className="sm:flex-1"
                  >
                    {phase === 'sending' ? <Spinner size="sm" /> : t('modal.send')}
                  </Button>
                </>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
