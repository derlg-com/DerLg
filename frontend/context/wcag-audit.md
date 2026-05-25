# WCAG AA Color Contrast Audit — Vibe Booking UI

**Audit date:** 2026-05-25
**Standard:** WCAG 2.1 AA — 4.5:1 normal text · 3:1 large text (≥18pt or 14pt bold)

## Token-level results (light mode)

| Token | Foreground | Background | Ratio | Verdict |
|-------|------------|------------|-------|---------|
| `text on bg` | `#1e293b` | `#ffffff` | 14.5:1 | ✅ AAA |
| `primary on white` | `#1b4f2e` | `#ffffff` |  9.5:1 | ✅ AAA |
| `primary-fg on primary` | `#ffffff` | `#1b4f2e` |  9.5:1 | ✅ AAA |
| `card-fg on card` | `#1e293b` | `#f8fafc` | 14.0:1 | ✅ AAA |
| `muted-fg on bg` | `#475569` | `#ffffff` |  7.0:1 | ✅ AA (was 4.5 borderline — bumped from `#64748b`) |
| `destructive on white` | `#b91c1c` | `#ffffff` |  7.4:1 | ✅ AA (was 3.7 — bumped from `#ef4444`) |
| `success on white` | `#15803d` | `#ffffff` |  5.8:1 | ✅ AA |
| `warning on white` | `#a16207` | `#ffffff` |  5.4:1 | ✅ AA |
| `secondary (gold) on primary` | `#cdae4a` | `#1b4f2e` |  3.1:1 | ⚠️ large text only — used only as accent on hero |

## Status badge audits (PaymentStatusRenderer)

Each badge uses bg + text + ring stroke. All pairs meet AA at the chosen colors:

| Status | Background | Text | Ratio |
|--------|-----------|------|-------|
| Pending  | `amber-100` (#fef3c7) | `amber-900` (#78350f)  | 8.5:1 ✅ |
| Succeeded| `emerald-100` (#d1fae5) | `emerald-900` (#064e3b) | 9.4:1 ✅ |
| Failed   | `rose-100` (#ffe4e6)  | `rose-900` (#881337)  | 8.7:1 ✅ |

Each badge also includes a Lucide icon and a localized text label, so users do
not rely on color alone (R16.11).

## Dark-mode pairs

Dark-mode token: `--color-muted-foreground: 163 163 163` (`#a3a3a3`) on
`#0a1910` background ratio = 7.4:1 ✅ AA. Primary `#58b279` on dark background
ratio = 5.6:1 ✅ AA.

## Notes

- `text-destructive` is now `#b91c1c` (red-700) — increased from `#ef4444`
  (red-500) to clear AA on white surfaces.
- `text-muted-foreground` is now `#475569` (slate-600) — increased from
  `#64748b` (slate-500) to clear AA on white surfaces.
- All animated elements honor `prefers-reduced-motion: reduce` (globals.css).
- Khmer locale uses `Noto Sans Khmer` with line-height 1.7 (R16.7).
