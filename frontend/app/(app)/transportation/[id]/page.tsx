import type { Metadata } from 'next'
import { VehicleDetailView } from '@/components/transportation/VehicleDetailView'

export const metadata: Metadata = {
  title: 'Vehicle details — DerLg',
}

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <VehicleDetailView id={id} />
}
