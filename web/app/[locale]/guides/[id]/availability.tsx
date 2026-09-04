'use client'

import { AvailabilityCheck } from '@/components/shared/availability-check'
import { useGuideAvailability } from '@/hooks/use-availability'

/** Client boundary for the guide availability widget. */
export function GuideAvailability({ id }: { id: string }) {
  return <AvailabilityCheck id={id} useAvailability={useGuideAvailability} />
}
