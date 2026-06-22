import { Card } from '@/components/ui/card'

export interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1 text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      <Card variant="elevated" className="p-6">
        {children}
      </Card>
    </div>
  )
}
