'use client'

import * as React from 'react'
import { CheckCircle2, Clock, FileText, GraduationCap, Upload, XCircle } from 'lucide-react'
import { BookingShell } from '@/components/booking/BookingShell'
import { useApiQuery } from '@/lib/use-api-query'
import { getAccessToken } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  DOCUMENT_ACCEPT_ATTR,
  deriveStatusFromProfile,
  parseVerificationStatus,
  uploadStudentDocument,
  validateDocumentFile,
  type DocumentValidationError,
  type StudentVerification,
  type VerificationStatus,
} from '@/lib/student-verification'
import type { UserProfile } from '@/types/api'

/**
 * Student-discount verification view (Task 16.6 — Requirements 8.4, 35.1–35.6).
 *
 * Lets a user upload a student-ID / enrolment document (PDF, JPEG or PNG, max
 * 10 MB), submits it to the backend, and shows the current verification status
 * (none / pending / approved / rejected) plus the verified-student badge when
 * approved.
 *
 * Backend-contract assumption & graceful degradation are documented in
 * {@link import('@/lib/student-verification')}. In short:
 * - Status comes from `GET /v1/users/me/student-verification`; if that endpoint
 *   is unavailable we fall back to deriving status from the profile's
 *   `isStudent` flag.
 * - The document POST hits `/v1/users/me/student-verification`; a missing
 *   endpoint surfaces an inline error instead of crashing.
 */

const STATUS_BADGE: Record<
  Exclude<VerificationStatus, 'none'>,
  { variant: 'success' | 'warning' | 'destructive'; icon: typeof Clock }
> = {
  approved: { variant: 'success', icon: CheckCircle2 },
  pending: { variant: 'warning', icon: Clock },
  rejected: { variant: 'destructive', icon: XCircle },
}

function StatusCard({ verification }: { verification: StudentVerification }) {
  const t = useTranslations('profile')
  const { status } = verification

  if (status === 'approved') {
    return (
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <GraduationCap className="h-7 w-7 text-success" aria-hidden />
        <Badge variant="success">
          <CheckCircle2 className="h-3 w-3" aria-hidden /> {t('studentVerify.badge')}
        </Badge>
        <p className="text-sm text-muted-foreground">{t('studentVerify.approvedDesc')}</p>
      </Card>
    )
  }

  const badge = status === 'none' ? null : STATUS_BADGE[status]
  const Icon = badge?.icon ?? FileText

  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" aria-hidden />
        <span className="font-medium text-foreground">{t('studentVerify.statusLabel')}</span>
        {badge ? (
          <Badge variant={badge.variant}>{t(`studentVerify.status.${status}`)}</Badge>
        ) : (
          <Badge variant="muted">{t('studentVerify.status.none')}</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t(`studentVerify.statusDesc.${status}`)}</p>
      {status === 'rejected' && verification.rejectionReason ? (
        <p className="text-sm text-destructive">
          {t('studentVerify.rejectionReason', { reason: verification.rejectionReason })}
        </p>
      ) : null}
    </Card>
  )
}

type Phase = 'idle' | 'uploading' | 'error'

interface UploadSectionProps {
  onSubmitted: (next: StudentVerification) => void
}

function UploadSection({ onSubmitted }: UploadSectionProps) {
  const t = useTranslations('profile')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [progress, setProgress] = React.useState(0)
  const [errorKey, setErrorKey] = React.useState<DocumentValidationError | 'upload' | null>(null)
  const [dragging, setDragging] = React.useState(false)

  const handleFile = React.useCallback(
    async (file: File) => {
      setErrorKey(null)
      const validation = validateDocumentFile(file)
      if (!validation.ok) {
        setPhase('error')
        setErrorKey(validation.error ?? 'type')
        setFileName(null)
        return
      }

      setFileName(file.name)
      setPhase('uploading')
      setProgress(0)
      try {
        const next = await uploadStudentDocument(file, {
          token: getAccessToken(),
          onProgress: setProgress,
        })
        setPhase('idle')
        onSubmitted(next)
      } catch {
        // Endpoint may not exist yet — degrade gracefully (Req 8.4, 35.4).
        setPhase('error')
        setErrorKey('upload')
      }
    },
    [onSubmitted],
  )

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const busy = phase === 'uploading'
  const errorText = errorKey
    ? t(
        errorKey === 'upload'
          ? 'studentVerify.errorUpload'
          : errorKey === 'size'
            ? 'studentVerify.errorSize'
            : errorKey === 'empty'
              ? 'studentVerify.errorEmpty'
              : 'studentVerify.errorType',
      )
    : null

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-primary" aria-hidden />
        <h2 className="font-medium text-foreground">{t('studentVerify.uploadTitle')}</h2>
      </div>

      <div
        className={cn(
          'flex flex-col items-start gap-2 rounded-lg border border-dashed border-input p-4 transition-colors',
          dragging && 'border-primary bg-accent/40',
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="text-sm text-muted-foreground">{t('studentVerify.dropHint')}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          {t('studentVerify.choose')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={DOCUMENT_ACCEPT_ATTR}
          className="sr-only"
          aria-label={t('studentVerify.choose')}
          onChange={onInputChange}
        />
        {fileName ? (
          <p className="flex items-center gap-1.5 text-sm text-foreground">
            <FileText className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="truncate">{fileName}</span>
          </p>
        ) : null}
      </div>

      {phase === 'uploading' ? (
        <div className="space-y-1">
          <Progress value={progress} label={t('studentVerify.uploading')} size="sm" />
          <p className="text-sm text-muted-foreground">
            {t('studentVerify.uploadingPercent', { percent: progress })}
          </p>
        </div>
      ) : null}

      {errorText ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t('studentVerify.constraints')}</p>
    </section>
  )
}

function Inner() {
  const t = useTranslations('profile')
  const { data: user, isLoading } = useApiQuery<UserProfile>('/v1/users/me')

  // Status endpoint is assumed/optional — don't hammer it, and fall back to the
  // profile's isStudent flag when it errors (graceful degradation).
  const {
    data: statusData,
    error: statusError,
    isLoading: statusLoading,
  } = useApiQuery<unknown>('/v1/users/me/student-verification', { retry: 0 })

  // Local override applied after a successful submission so the UI reflects the
  // new (pending) status immediately without waiting for a refetch.
  const [submitted, setSubmitted] = React.useState<StudentVerification | null>(null)

  const verification: StudentVerification = React.useMemo(() => {
    if (submitted) return submitted
    if (statusData && !statusError) return parseVerificationStatus(statusData)
    // Fallback: derive from the profile when the status endpoint is unavailable.
    return { status: deriveStatusFromProfile(user?.isStudent) }
  }, [submitted, statusData, statusError, user?.isStudent])

  const loading = isLoading || statusLoading

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">{t('studentVerify.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('studentVerify.subtitle')}</p>
      </div>

      {loading ? (
        <Skeleton className="h-28 w-full rounded-lg" />
      ) : (
        <>
          <StatusCard verification={verification} />
          {/* Allow (re)submission unless already approved (Req 35.2, 35.4). */}
          {verification.status !== 'approved' ? <UploadSection onSubmitted={setSubmitted} /> : null}
        </>
      )}
    </div>
  )
}

export function StudentDiscountView() {
  return (
    <BookingShell>
      <Inner />
    </BookingShell>
  )
}
