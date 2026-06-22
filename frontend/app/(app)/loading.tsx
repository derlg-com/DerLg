import { Skeleton } from '@/components/ui/skeleton'

export default function AppLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-1/2" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/3] w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
