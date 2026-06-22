'use client'

import { useState } from 'react'
import { Heart, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Avatar } from '@/components/ui/avatar'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Pagination } from '@/components/ui/pagination'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { toast, Toaster } from '@/components/ui/toast'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </section>
  )
}

export default function UiKitPage() {
  const [on, setOn] = useState(true)
  const [page, setPage] = useState(3)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <main className="mx-auto max-w-3xl space-y-10 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">DerLg UI Kit</h1>
        <p className="text-sm text-muted-foreground">Shared primitives on the Cambodia travel palette.</p>
      </header>

      <Section title="Buttons">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
      </Section>

      <Section title="Badges">
        <Badge>Default</Badge>
        <Badge variant="secondary">Gold</Badge>
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
      </Section>

      <Section title="Feedback">
        <Skeleton className="h-10 w-40" />
        <Spinner />
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
          action={<Button size="sm" variant="outline">Clear filters</Button>}
        />
      </div>

      <Section title="Tabs">
        <Tabs defaultValue="trips" className="w-full">
          <TabsList>
            <TabsTrigger value="trips">Trips</TabsTrigger>
            <TabsTrigger value="hotels">Hotels</TabsTrigger>
            <TabsTrigger value="guides">Guides</TabsTrigger>
          </TabsList>
          <TabsContent value="trips" className="text-sm text-muted-foreground">Trips panel</TabsContent>
          <TabsContent value="hotels" className="text-sm text-muted-foreground">Hotels panel</TabsContent>
          <TabsContent value="guides" className="text-sm text-muted-foreground">Guides panel</TabsContent>
        </Tabs>
      </Section>

      <Section title="Pagination">
        <Pagination page={page} totalPages={20} onPageChange={setPage} />
      </Section>

      <Section title="Overlays">
        <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
        <Button variant="outline" onClick={() => setSheetOpen(true)}>Open sheet</Button>
      </Section>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel booking?</DialogTitle>
            <DialogDescription>You will receive a 100% refund (≥7 days before start).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Keep booking</Button>
            <Button variant="destructive" onClick={() => setDialogOpen(false)}>Cancel booking</Button>
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
