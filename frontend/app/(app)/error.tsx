'use client'

import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/i18n'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common')
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" aria-hidden />
      <h2 className="text-lg font-semibold text-foreground">{t('error')}</h2>
      <Button onClick={reset}>{t('tryAgain')}</Button>
    </div>
  )
}
