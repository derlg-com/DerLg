/**
 * Task 18.2.10 — E2E (Playwright): Multi-language rendering of `/vibe-booking`.
 *
 * Verifies the REAL i18n stack (`lib/i18n.ts` + `components/shared/LanguageSwitcher.tsx`)
 * running inside the production build of the `/vibe-booking` page, in all three
 * supported locales (EN / ZH / KM), plus a live language switch.
 *
 * What is asserted (all against the ACTUAL message bundles in `messages/*.json`):
 *   a. EN  — an English vibe-booking surface string renders.
 *   b. ZH  — the Chinese string renders AND the English one does not.
 *   c. KM  — the Khmer string renders.
 *   d. `document.documentElement.lang` reflects the locale via `getLanguageHtmlAttr`
 *      (en→en-US, zh→zh-CN, km→km-KH; set by `LanguageSync`).
 *   e. Live switch — driving the visible `LanguageSwitcher` <select> from EN→ZH
 *      re-renders the UI in Chinese (the switch path, not just initial load).
 *
 * NO WebSocket mock is needed. The strings under test (`chat.title`,
 * `chat.placeholder`, `common.disconnected`) render on first paint regardless of
 * the agent connection: the store's initial `connectionStatus` is "disconnected"
 * (see `stores/vibe-booking.store.ts`), and without a mock the real socket to
 * ws://localhost:8000 simply never opens, so the badge stays "disconnected".
 * This keeps the suite deterministic and free of socket-timing flake.
 *
 * Locale is seeded DETERMINISTICALLY before app load by writing the language
 * store's persisted value into localStorage. The store uses zustand `persist`
 * with `{ name: 'derlg:language' }` (default JSON storage, default version 0),
 * so the persisted shape is exactly `{"state":{"locale":"zh"},"version":0}` —
 * verified against the zustand 5.0.13 persist middleware (setItem writes
 * `{ state: partialize(get()), version }`; the language store has no custom
 * partialize/version, and the `setLocale` function is dropped by JSON.stringify,
 * leaving only `locale`).
 */
import { test, expect, type Page } from '@playwright/test'

/** The zustand `persist` name for the language store (see `lib/i18n.ts`). */
const LANGUAGE_STORAGE_KEY = 'derlg:language'

type AppLocale = 'en' | 'zh' | 'km'

/**
 * Accessible name of the LanguageSwitcher <select>.
 *
 * NOTE (i18n gap): the switcher calls `useTranslations('shell')('language')`,
 * but NO `shell.language` key exists in any bundle (messages/{en,zh,km}.json).
 * `useTranslations` falls back to returning the raw dotted key when a message is
 * missing, so the `aria-label` is the LITERAL string `shell.language` in EVERY
 * locale (it is never translated to "Language" / "语言" / "ភាសា"). We therefore
 * target the combobox by this actual rendered accessible name. This is reported
 * as a discovered gap rather than worked around by weakening the selector.
 */
const LANGUAGE_SWITCHER_ARIA_LABEL = 'shell.language'

/**
 * Exact localized strings asserted per locale, copied verbatim from
 * `frontend/messages/{en,zh,km}.json`. These are real, shipped translations —
 * not invented — and they differ across all three bundles, so each assertion is
 * meaningful (a regression that drops a bundle, or mis-resolves the active
 * locale, fails the test).
 */
const STRINGS: Record<
  AppLocale,
  { chatTitle: string; placeholder: string; disconnected: string; htmlLang: string }
> = {
  en: {
    chatTitle: 'DerLg AI Concierge', // chat.title
    placeholder: 'Tell me about your dream trip…', // chat.placeholder
    disconnected: 'Disconnected', // common.disconnected
    htmlLang: 'en-US', // getLanguageHtmlAttr('en')
  },
  zh: {
    chatTitle: 'DerLg AI 旅行顾问',
    placeholder: '告诉我您梦想中的旅行…',
    disconnected: '已断开',
    htmlLang: 'zh-CN',
  },
  km: {
    chatTitle: 'DerLg ទីប្រឹក្សាការធ្វើដំណើរ AI',
    placeholder: 'ប្រាប់ខ្ញុំអំពីការធ្វើដំណើរក្នុងសុបិន្តរបស់អ្នក…',
    disconnected: 'ផ្តាច់ការតភ្ជាប់',
    htmlLang: 'km-KH',
  },
}

/**
 * Seed the persisted language store BEFORE any app JS runs, so the very first
 * render is in the requested locale (no flash of the default + no reliance on a
 * post-load `setLocale`). Mirrors the `addInitScript` approach the sibling specs
 * use for the WebSocket mock.
 */
async function seedLocale(page: Page, locale: AppLocale): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      window.localStorage.setItem(key, value)
    },
    [LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { locale }, version: 0 })] as const,
  )
}

/** Desktop viewport so the split-screen layout (not the mobile stack) renders. */
test.use({ viewport: { width: 1280, height: 900 } })

test.describe('Vibe Booking — multi-language rendering (EN / ZH / KM)', () => {
  /**
   * The page renders TWO layouts simultaneously — a mobile stacked one
   * (`md:hidden`) and a desktop split-screen one (`hidden md:block`). At this
   * viewport only the desktop layout is visible, so locators are scoped to
   * `visible=true` to avoid matching the hidden mobile duplicates.
   */
  const visiblePlaceholder = (page: Page, text: string) =>
    page.getByPlaceholder(text).locator('visible=true')

  test('renders the vibe-booking UI in English with html lang en-US', async ({ page }) => {
    await seedLocale(page, 'en')
    await page.goto('/vibe-booking')

    // The chat input placeholder is the cleanest EN signal: it renders on first
    // paint and appears exactly once in the visible desktop layout. (chat.title
    // "DerLg AI Concierge" also appears as a hardcoded drag-bar label, so the
    // placeholder is the unambiguous locale-bound assertion.)
    await expect(visiblePlaceholder(page, STRINGS.en.placeholder)).toBeVisible()

    // The connection badge is localized too (initial store status =
    // "disconnected" → common.disconnected). Exact match avoids the "Connected"
    // substring trap, mirroring booking-flow.spec.ts.
    await expect(
      page.getByText(STRINGS.en.disconnected, { exact: true }).locator('visible=true'),
    ).toBeVisible()

    // LanguageSync mirrors the locale onto <html lang> via getLanguageHtmlAttr.
    await expect(page.locator('html')).toHaveAttribute('lang', STRINGS.en.htmlLang)
  })

  test('renders the vibe-booking UI in Chinese (and not English) with html lang zh-CN', async ({
    page,
  }) => {
    await seedLocale(page, 'zh')
    await page.goto('/vibe-booking')

    // The Chinese chat title is unique to the ZH bundle (no hardcoded collision),
    // so assert it directly in addition to the placeholder.
    await expect(page.getByText(STRINGS.zh.chatTitle).locator('visible=true')).toBeVisible()
    await expect(visiblePlaceholder(page, STRINGS.zh.placeholder)).toBeVisible()
    await expect(
      page.getByText(STRINGS.zh.disconnected, { exact: true }).locator('visible=true'),
    ).toBeVisible()

    // Negative assertion: the English strings must NOT be present when ZH is
    // active — proving the active-locale bundle (not English) drove the render.
    await expect(page.getByPlaceholder(STRINGS.en.placeholder)).toHaveCount(0)
    await expect(page.getByText(STRINGS.en.disconnected, { exact: true })).toHaveCount(0)

    await expect(page.locator('html')).toHaveAttribute('lang', STRINGS.zh.htmlLang)
  })

  test('renders the vibe-booking UI in Khmer with html lang km-KH', async ({ page }) => {
    await seedLocale(page, 'km')
    await page.goto('/vibe-booking')

    await expect(page.getByText(STRINGS.km.chatTitle).locator('visible=true')).toBeVisible()
    await expect(visiblePlaceholder(page, STRINGS.km.placeholder)).toBeVisible()
    await expect(
      page.getByText(STRINGS.km.disconnected, { exact: true }).locator('visible=true'),
    ).toBeVisible()

    // English must not leak through into the Khmer render.
    await expect(page.getByPlaceholder(STRINGS.en.placeholder)).toHaveCount(0)

    await expect(page.locator('html')).toHaveAttribute('lang', STRINGS.km.htmlLang)
  })

  test('switches language live via the LanguageSwitcher select (EN → ZH)', async ({ page }) => {
    // Start with no seeded choice → DEFAULT_LOCALE ('en').
    await page.goto('/vibe-booking')

    // Initial English render.
    await expect(visiblePlaceholder(page, STRINGS.en.placeholder)).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', STRINGS.en.htmlLang)

    // The LanguageSwitcher is a <select> whose accessible name is the literal
    // `shell.language` (see note above — the i18n key is unresolved). It lives in
    // the desktop panel's drag bar. Scope to the visible instance and switch to
    // Chinese by option value (the store's setLocale runs on change).
    const switcher = page
      .getByRole('combobox', { name: LANGUAGE_SWITCHER_ARIA_LABEL })
      .locator('visible=true')
    await expect(switcher).toBeVisible()
    await switcher.selectOption('zh')

    // Live re-render: the Chinese placeholder/title now show, English is gone,
    // and <html lang> flips — confirming the switch path, not just initial load.
    await expect(visiblePlaceholder(page, STRINGS.zh.placeholder)).toBeVisible()
    await expect(page.getByText(STRINGS.zh.chatTitle).locator('visible=true')).toBeVisible()
    await expect(page.getByPlaceholder(STRINGS.en.placeholder)).toHaveCount(0)
    await expect(page.locator('html')).toHaveAttribute('lang', STRINGS.zh.htmlLang)
  })
})
