'use client'

import { AvailabilityCheck } from '@/components/shared/availability-check'
import { useVehicleAvailability } from '@/hooks/use-availability'

/** Client boundary for the vehicle availability widget. */
export function VehicleAvailability({ id }: { id: string }) {
  return <AvailabilityCheck id={id} useAvailability={useVehicleAvailability} />
}
