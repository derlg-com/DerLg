# UI Context

## Theme

The design language for DerLg is premium, modern, and vibrant. It is designed to inspire trust and excitement for travel in Cambodia. The UI features rich aesthetics with deep greens reflecting nature and premium service, complemented by vibrant golden accents for call-to-actions. The theme supports both light and sleek dark modes, with dynamic animations and glassmorphism.

## Colors

All components must use these tokens — no hardcoded hex values.

| Role            | CSS Variable       | Value     |
| --------------- | ------------------ | --------- |
| Page background | `--bg-base`        | `#ffffff` |
| Surface         | `--bg-surface`     | `#f8fafc` |
| Primary text    | `--text-primary`   | `#1e293b` |
| Muted text      | `--text-muted`     | `#64748b` |
| Primary accent  | `--accent-primary` | `#1b4f2e` |
| Primary hover   | `--accent-hover`   | `#144e2e` |
| Secondary accent| `--accent-second`  | `#cdae4a` |
| Border          | `--border-default` | `#e2e8f0` |
| Error           | `--state-error`    | `#ef4444` |
| Success         | `--state-success`  | `#309059` |

**Full Extracted Logo Palette for Reference:**
- Dominant Deep Green: `#1b4f2e`
- Dark Green (Shadows): `#144e2e`
- Vibrant Gold (Accent): `#cdae4a`
- Mid Green: `#309059`
- Soft Green: `#58b279`
- Forest Green: `#367b5c`
- Pale Sage: `#72a48c`
- Moss: `#676222`

## Typography

| Role      | Font              | Variable      |
| --------- | ----------------- | ------------- |
| UI text   | Geist Sans        | `--font-sans` |
| Code/mono | Geist Mono        | `--font-mono` |

## Border Radius

| Context           | Class            |
| ----------------- | ---------------- |
| Inline / small UI | `rounded-sm`     |
| Cards / panels    | `rounded-lg`     |
| Modals / overlays | `rounded-xl`     |

## Component Library

shadcn/ui on top of Tailwind v4. Components live in `components/ui/`. Use the CLI to add new components rather than writing from scratch. Shared app components live in `components/shared/`.

## Layout Patterns

- **Main App**: Mobile-first responsive layout with bottom navigation on `(main)` routes.
- **Vibe Booking**: Split-screen desktop layout (Chat Panel left, Content Stage right), toggled single-pane on mobile.

## Icons

Lucide React. Stroke-based icons only. Sizes:
`h-4 w-4` for inline, `h-5 w-5` for buttons.
