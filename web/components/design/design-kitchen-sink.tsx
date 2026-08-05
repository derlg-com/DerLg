'use client'

import { Compass, Filter, MapPin, Search } from 'lucide-react'
import * as React from 'react'

import { ThemeToggle } from '@/components/layout/theme-toggle'
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  Input,
  LoadingRegion,
  Popover,
  ScrollRail,
  SegmentedControl,
  Select,
  Sheet,
  Skeleton,
  Switch,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from '@/components/ui'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 border-t border-[var(--border-subtle)] pt-8">
      <h2 className="font-mono text-xs tracking-widest text-[var(--text-tertiary)] uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

export function DesignKitchenSink() {
  const { show } = useToast()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [notify, setNotify] = React.useState(true)
  const [view, setView] = React.useState<'list' | 'map'>('list')

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Design system</h1>
        <p className="text-[var(--text-secondary)]">
          Every primitive, in light and dark. Tab through the page — each control must show a
          visible focus ring and respond to the keyboard.
        </p>
        <ThemeToggle className="mt-2" />
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
          <Button size="icon" aria-label="Search">
            <Search aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="accent">Accent</Badge>
          <Badge tone="success">Confirmed</Badge>
          <Badge tone="warning">On hold</Badge>
          <Badge tone="danger">Cancelled</Badge>
          <Badge tone="info">Info</Badge>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Destination" description="City or province in Cambodia" required>
            {(props) => <Input placeholder="Siem Reap" {...props} />}
          </Field>
          <Field label="Travellers" error="Must be at least 1">
            {(props) => (
              <Select defaultValue="" {...props}>
                <option value="" disabled>
                  Select
                </option>
                <option value="1">1 traveller</option>
                <option value="2">2 travellers</option>
              </Select>
            )}
          </Field>
          <Field label="Notes" description="Anything the guide should know" className="sm:col-span-2">
            {(props) => <Textarea placeholder="Vegetarian meals, early start…" {...props} />}
          </Field>
        </div>
        <Switch
          checked={notify}
          onCheckedChange={setNotify}
          label="Trip reminders"
          description="Push a reminder 24 hours before departure."
        />
      </Section>

      <Section title="Cards">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Angkor sunrise tour</CardTitle>
              <CardDescription>3 days · Siem Reap</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-secondary)]">
                A static card. Structure comes from the hairline border.
              </p>
            </CardContent>
          </Card>
          <Card interactive>
            <CardHeader>
              <CardTitle>Interactive card</CardTitle>
              <CardDescription>Hover to see the feedback state</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-[var(--text-secondary)]">
                Used when the whole card is a link or button.
              </p>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="trips">
          <TabList label="Content type">
            <Tab value="trips">Trips</Tab>
            <Tab value="hotels">Hotels</Tab>
            <Tab value="guides">Guides</Tab>
          </TabList>
          <TabPanel value="trips">
            <p className="text-sm text-[var(--text-secondary)]">
              Arrow keys move between tabs; only the selected tab is tabbable.
            </p>
          </TabPanel>
          <TabPanel value="hotels">
            <p className="text-sm text-[var(--text-secondary)]">Hotels panel.</p>
          </TabPanel>
          <TabPanel value="guides">
            <p className="text-sm text-[var(--text-secondary)]">Guides panel.</p>
          </TabPanel>
        </Tabs>
      </Section>

      <Section title="Segmented control">
        <SegmentedControl
          label="View mode"
          value={view}
          onValueChange={setView}
          options={[
            { value: 'list', label: 'List', icon: <Filter aria-hidden="true" className="size-4" /> },
            { value: 'map', label: 'Map', icon: <MapPin aria-hidden="true" className="size-4" /> },
          ]}
        />
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => setDialogOpen(true)}>
            Open dialog
          </Button>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>
            Open sheet
          </Button>
          <Popover
            label="Filters"
            trigger={
              <span className="inline-flex min-h-11 items-center gap-2 rounded-md border border-[var(--border-default)] px-4 text-sm font-medium">
                <Filter aria-hidden="true" className="size-4" />
                Popover
              </span>
            }
          >
            <p className="p-1 text-sm text-[var(--text-secondary)]">
              Escape closes and returns focus to the trigger.
            </p>
          </Popover>
          <Tooltip content="Supplementary hint only">
            <Button variant="ghost" size="icon" aria-label="Help">
              <Compass aria-hidden="true" className="size-4" />
            </Button>
          </Tooltip>
        </div>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title="Confirm this booking"
          description="Focus is trapped here until you close it."
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-secondary)]">
              Tab cycles inside the dialog. Escape or the backdrop closes it, and focus returns to
              the button that opened it.
            </p>
            <Button data-autofocus onClick={() => setDialogOpen(false)}>
              Got it
            </Button>
          </div>
        </Dialog>

        <Sheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title="Filters"
          description="Bottom sheet on mobile, side panel on desktop."
          side="bottom"
        >
          <p className="text-sm text-[var(--text-secondary)]">Sheet body content.</p>
        </Sheet>
      </Section>

      <Section title="Toasts">
        <div className="flex flex-wrap gap-3">
          {(['success', 'error', 'warning', 'info'] as const).map((tone) => (
            <Button
              key={tone}
              variant="secondary"
              size="sm"
              onClick={() =>
                show({
                  tone,
                  title: `${tone[0]!.toUpperCase()}${tone.slice(1)} toast`,
                  description: 'Announced politely, auto-dismissed after 5 seconds.',
                })
              }
            >
              {tone}
            </Button>
          ))}
        </div>
      </Section>

      <Section title="Scroll rail">
        <ScrollRail label="Featured trips">
          {Array.from({ length: 8 }, (_, index) => (
            <Card key={index} interactive className="w-56 p-4">
              <p className="text-sm font-medium">Trip {index + 1}</p>
              <p className="text-sm text-[var(--text-secondary)]">Snap-scrolled rail item</p>
            </Card>
          ))}
        </ScrollRail>
      </Section>

      <Section title="Avatars">
        <div className="flex items-center gap-3">
          <Avatar name="Sokha Chan" size="sm" />
          <Avatar name="Sokha Chan" size="md" />
          <Avatar name="Sokha Chan" size="lg" />
        </div>
      </Section>

      <Section title="Loading, empty and error states">
        <LoadingRegion label="Loading trips">
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 2 }, (_, index) => (
              <Card key={index} className="space-y-3 p-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </Card>
            ))}
          </div>
        </LoadingRegion>

        <EmptyState
          icon={<Search aria-hidden="true" className="size-6" />}
          title="No trips match those filters"
          description="Try widening the price range or picking another province."
          action={
            <Button variant="secondary" size="sm">
              Clear filters
            </Button>
          }
        />

        <ErrorState
          title="Could not load trips"
          description="The booking service did not respond. Your connection is fine."
          onRetry={() => {}}
        />
      </Section>
    </main>
  )
}
