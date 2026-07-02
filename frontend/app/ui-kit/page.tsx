'use client'

import { useState } from 'react'
import { Heart, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Radio, RadioGroup } from '@/components/ui/radio'
import { DatePicker } from '@/components/ui/date-picker'
import { Pagination } from '@/components/ui/pagination'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast, Toaster } from '@/components/ui/toast'
import { Logo } from '@/components/shared/Logo'
import { SectionHeading } from '@/components/shared/SectionHeading'
import { GradientText } from '@/components/shared/GradientText'
import { Reveal } from '@/components/shared/Reveal'
import { EntityCard } from '@/components/shared/EntityCard'
import { CatalogShell } from '@/components/shared/CatalogShell'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export default function UiKitPage() {
  const [on, setOn] = useState(true)
  const [page, setPage] = useState(3)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [agree, setAgree] = useState(false)
  const [pay, setPay] = useState('card')
  const [date, setDate] = useState('')

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">DerLg UI Kit</h1>
        <p className="text-sm text-muted-foreground">
          Shared primitives on the Cambodia travel palette.
        </p>
      </header>

      <Section title="Brand">
        <Logo size="lg" href={null} />
        <Logo size="md" href={null} withWordmark={false} />
      </Section>

      <div className="space-y-4">
        <SectionHeading
          eyebrow="Design system"
          title={
            <>
              Premium <GradientText>green &amp; gold</GradientText>
            </>
          }
          subtitle="Sora display headings, Plus Jakarta Sans body, gradients, and glassmorphism."
          align="left"
        />
        <Reveal>
          <p className="text-sm text-muted-foreground">
            This paragraph fades in on scroll (reduced-motion safe).
          </p>
        </Reveal>
      </div>

      <Section title="Buttons">
        <Button variant="gradient">Try Vibe Booking</Button>
        <Button variant="gold">Notify Me</Button>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="xl" variant="gradient">
          Extra large
        </Button>
      </Section>

      <Section title="Badges">
        <Badge variant="live">● Live</Badge>
        <Badge>Default</Badge>
        <Badge variant="secondary">Gold</Badge>
        <Badge variant="muted">v1.1</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="success">Verified</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="destructive">Cancelled</Badge>
      </Section>

      <Section title="Form controls">
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="demo-email">Email</Label>
          <Input id="demo-email" placeholder="you@example.com" />
          <Input aria-invalid placeholder="invalid state" />
          <Textarea placeholder="Special requests…" />
          <Select defaultValue="en" aria-label="Language">
            <option value="en">English</option>
            <option value="zh">中文</option>
            <option value="km">ខ្មែរ</option>
          </Select>
          <div className="flex items-center gap-2">
            <Switch checked={on} onCheckedChange={setOn} aria-label="Notifications" />
            <span className="text-sm text-muted-foreground">Notifications {on ? 'on' : 'off'}</span>
          </div>
          <DatePicker
            value={date}
            onChange={setDate}
            placeholder="Select a date"
            aria-label="Booking date"
          />
          <Checkbox
            label="I agree to the terms"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
          />
          <RadioGroup aria-label="Payment method" className="pt-1">
            <Radio
              name="kit-pay"
              value="card"
              label="Card"
              checked={pay === 'card'}
              onChange={() => setPay('card')}
            />
            <Radio
              name="kit-pay"
              value="qr"
              label="Bakong QR"
              checked={pay === 'qr'}
              onChange={() => setPay('qr')}
            />
          </RadioGroup>
        </div>
      </Section>

      <Section title="Card">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Angkor Wat Sunrise</CardTitle>
            <CardDescription>Siem Reap · 1 day</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            A guided sunrise tour of the temples with hotel pickup.
          </CardContent>
          <CardFooter className="justify-between">
            <span className="font-semibold text-foreground">$49</span>
            <Button size="sm">
              <Heart className="mr-1 h-4 w-4" /> Save
            </Button>
          </CardFooter>
        </Card>
        <Card variant="elevated" className="w-full max-w-xs p-5 text-sm text-muted-foreground">
          Elevated card
        </Card>
        <Card variant="interactive" className="w-full max-w-xs p-5 text-sm text-muted-foreground">
          Interactive (hover lift)
        </Card>
        <div className="rounded-2xl bg-gradient-brand p-4">
          <Card variant="glass" className="w-full max-w-xs p-5 text-sm">
            Glass card on gradient
          </Card>
        </div>
      </Section>

      <Section title="Feedback">
        <Skeleton className="h-10 w-40" />
        <Spinner />
        <Progress value={60} label="Upload progress" className="max-w-xs" />
        <Progress label="Loading" className="max-w-xs" />
        <Avatar name="Wendy Chen" />
        <Avatar name="Backpacker Ben" size="lg" />
        <Button variant="outline" onClick={() => toast({ title: 'Saved!', variant: 'success' })}>
          Show toast
        </Button>
      </Section>

      <div className="w-full">
        <EmptyState
          icon={Search}
          title="No trips found"
          description="Try adjusting your filters."
          action={
            <Button size="sm" variant="outline">
              Clear filters
            </Button>
          }
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Shared shells
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <EntityCard
            href="#"
            title="Angkor Sunrise Tour"
            subtitle="Siem Reap"
            priceLabel="$120"
            priceSuffix="/ person"
            badge={{ label: 'Temples' }}
            rating={{ average: 4.8, count: 410 }}
            favorite={{ type: 'trip', id: 'demo-1' }}
            meta="1 day"
          />
          <EntityCard
            href="#"
            title="Riverside Boutique Hotel"
            subtitle="Phnom Penh"
            priceLabel="$65"
            priceSuffix="/ night"
            rating={{ average: 4.6, count: 128 }}
            favorite={{ type: 'hotel', id: 'demo-2' }}
          />
        </div>
        <CatalogShell
          state="ready"
          toolbar={<p className="text-sm text-muted-foreground">2 results</p>}
          className="px-0 py-0"
        >
          <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            Card A
          </div>
          <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
            Card B
          </div>
        </CatalogShell>
      </section>

      <Section title="Tabs">
        <Tabs defaultValue="trips" className="w-full">
          <TabsList>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="guides">Guides</TabsTrigger>
          </TabsList>
          <TabsContent value="trips" className="text-sm text-muted-foreground">
            Trips panel
          </TabsContent>
          <TabsContent value="hotels" className="text-sm text-muted-foreground">
            Hotels panel
          </TabsContent>
          <TabsContent value="guides" className="text-sm text-muted-foreground">
            Guides panel
          </TabsContent>
        </Tabs>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} totalPages={20} onPageChange={setPage} />
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="outline" onClick={() => setSheetOpen(true)}>
          Open sheet
        </Button>
      </Section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking?</DialogTitle>
            <DialogDescription>
              You will receive a 100% refund (≥7 days before start).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Keep booking
            </Button>
            <Button variant="destructive" onClick={() => setDialogOpen(false)}>
              Cancel booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" title="Filters">
          <p className="text-sm text-muted-foreground">Filter controls go here.</p>
        </SheetContent>
      </Sheet>

      <Toaster />
    </main>
  )
}
