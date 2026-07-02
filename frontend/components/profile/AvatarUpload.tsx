'use client'

import * as React from 'react'
import { Upload } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { getAccessToken } from '@/lib/api-client'
import { useTranslations } from '@/lib/i18n'
import {
  ACCEPT_ATTR,
  cropToSquare,
  uploadAvatar,
  validateImageFile,
  type ImageValidationError,
} from '@/lib/image-upload'

export interface AvatarUploadProps {
  /** Current avatar URL (text-flow value), used for the initial preview. */
  value?: string | null
  /** Display name, for the avatar initials fallback. */
  name?: string | null
  /** Called with the new avatar URL once an upload succeeds. */
  onUploaded: (avatarUrl: string) => void
}

type Phase = 'idle' | 'processing' | 'uploading' | 'error'

/**
 * Profile-picture upload control (Task 16.3). Supports click-to-select and
 * drag-and-drop, validates type/size, center-crops + compresses to 400×400 via
 * canvas, then uploads with a live progress bar. Degrades gracefully: the
 * cropped preview is always shown, and an upload failure surfaces inline while
 * the surrounding "Avatar URL" text flow keeps working.
 */
export function AvatarUpload({ value, name, onUploaded }: AvatarUploadProps) {
  const t = useTranslations('profile')
  const inputRef = React.useRef<HTMLInputElement>(null)
  const previewUrlRef = React.useRef<string | null>(null)
  const [preview, setPreview] = React.useState<string | null>(value ?? null)
  const [phase, setPhase] = React.useState<Phase>('idle')
  const [progress, setProgress] = React.useState(0)
  const [errorKey, setErrorKey] = React.useState<ImageValidationError | 'upload' | null>(null)
  const [dragging, setDragging] = React.useState(false)

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    }
  }, [])

  const setLocalPreview = React.useCallback((url: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = url
    setPreview(url)
  }, [])

  const handleFile = React.useCallback(
    async (file: File) => {
      setErrorKey(null)
      const validation = validateImageFile(file)
      if (!validation.ok) {
        setPhase('error')
        setErrorKey(validation.error ?? 'type')
        return
      }

      setPhase('processing')
      setProgress(0)
      try {
        const { blob, previewUrl } = await cropToSquare(file)
        setLocalPreview(previewUrl)

        setPhase('uploading')
        const avatarUrl = await uploadAvatar(blob, {
          token: getAccessToken(),
          onProgress: setProgress,
        })
        onUploaded(avatarUrl)
        setPhase('idle')
      } catch {
        // Upload endpoint may not exist yet — degrade gracefully (Req 8.9).
        // The cropped preview remains visible; the URL text flow still works.
        setPhase('error')
        setErrorKey('upload')
      }
    },
    [onUploaded, setLocalPreview],
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

  const busy = phase === 'processing' || phase === 'uploading'
  const errorText = errorKey
    ? t(
        errorKey === 'upload'
          ? 'avatar.errorUpload'
          : errorKey === 'size'
            ? 'avatar.errorSize'
            : errorKey === 'empty'
              ? 'avatar.errorEmpty'
              : 'avatar.errorType',
      )
    : null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Avatar src={preview} name={name} size="lg" />
        <div
          className={cn(
            'flex flex-1 flex-col items-start gap-2 rounded-lg border border-dashed border-input p-3 transition-colors',
            dragging && 'border-primary bg-accent/40',
          )}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <p className="text-sm text-muted-foreground">{t('avatar.dropHint')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('avatar.choose')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            aria-label={t('avatar.choose')}
            onChange={onInputChange}
          />
        </div>
      </div>

      {phase === 'processing' ? (
        <p className="text-sm text-muted-foreground">{t('avatar.processing')}</p>
      ) : null}

      {phase === 'uploading' ? (
        <div className="space-y-1">
          <Progress value={progress} label={t('avatar.uploading')} size="sm" />
          <p className="text-sm text-muted-foreground">
            {t('avatar.uploadingPercent', { percent: progress })}
          </p>
        </div>
      ) : null}

      {errorText ? (
        <p role="alert" className="text-sm text-destructive">
          {errorText}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t('avatar.constraints')}</p>
    </div>
  )
}
