import { expect, test, type Page } from '@playwright/test'

const LOCALES = [
  { code: 'en', tag: 'en-US', label: 'English' },
  { code: 'zh', tag: 'zh-CN', label: '中文' },
  { code: 'km', tag: 'km-KH', label: 'ខ្មែរ' },
] as const

/** Localised labels the shell renders, needed to drive the mobile menu. */
const MENU_LABELS = {
  en: { open: 'Open menu', sheet: 'Menu' },
  zh: { open: '打开菜单', sheet: '菜单' },
  km: { open: 'បើកមឺនុយ', sheet: 'មឺនុយ' },
} as const

/**
 * Opens the language switcher.
 *
 * On narrow viewports the switcher lives inside the header menu sheet rather
 * than the header bar, so it has to be revealed first. Labels are looked up per
 * locale because the shell is fully translated.
 */
async function openLanguageSwitcher(
  page: Page,
  currentLabel: string,
  locale: keyof typeof MENU_LABELS = 'en',
) {
  const trigger = page.getByRole('button', { name: currentLabel })

  if (!(await trigger.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: MENU_LABELS[locale].open }).click()
    await expect(page.getByRole('dialog', { name: MENU_LABELS[locale].sheet })).toBeVisible()
  }

  const visibleTrigger = page.getByRole('button', { name: currentLabel }).first()
  await expect(visibleTrigger).toBeVisible()
  await visibleTrigger.click()
}

test.describe('locale routing', () => {
  for (const locale of LOCALES) {
    test(`/${locale.code} sets html lang to ${locale.tag}`, async ({ page }) => {
      await page.goto(`/${locale.code}`)
      await expect(page.locator('html')).toHaveAttribute('lang', locale.tag)
    })
  }

  test('an unprefixed path redirects to a locale', async ({ page }) => {
    await page.goto('/')
    // Default is English unless the browser advertises another supported language.
    await expect(page).toHaveURL(/\/(en|zh|km)$/)
    await expect(page.locator('html')).toHaveAttribute('lang', /^(en-US|zh-CN|km-KH)$/)
  })

  test('each locale renders genuinely different copy', async ({ page }) => {
    const headings: string[] = []

    for (const locale of LOCALES) {
      await page.goto(`/${locale.code}`)
      const heading = await page.getByRole('heading', { level: 1 }).textContent()
      expect(heading?.trim()).toBeTruthy()
      // A missing key would render the dev fallback marker.
      expect(heading).not.toContain('⚠️')
      headings.push(heading!.trim())
    }

    expect(new Set(headings).size).toBe(3)
  })

  test('Khmer renders Khmer script', async ({ page }) => {
    await page.goto('/km')
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading).toMatch(/[\u1780-\u17ff]/)
  })

  test('Chinese renders Han script', async ({ page }) => {
    await page.goto('/zh')
    const heading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(heading).toMatch(/[\u4e00-\u9fff]/)
  })

  test('switching language changes the URL, the lang attribute and the copy', async ({ page }) => {
    await page.goto('/en')
    const englishHeading = await page.getByRole('heading', { level: 1 }).textContent()

    await openLanguageSwitcher(page, 'English')
    await page.getByRole('button', { name: 'ខ្មែរ' }).click()

    await expect(page).toHaveURL(/\/km$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'km-KH')

    const khmerHeading = await page.getByRole('heading', { level: 1 }).textContent()
    expect(khmerHeading).not.toBe(englishHeading)
    expect(khmerHeading).toMatch(/[\u1780-\u17ff]/)
  })

  test('the chosen language survives a reload via the locale cookie', async ({ page }) => {
    await page.goto('/en')
    await openLanguageSwitcher(page, 'English')
    await page.getByRole('button', { name: '中文' }).click()
    await expect(page).toHaveURL(/\/zh$/)

    // Visiting the unprefixed root must honour the remembered choice.
    await page.goto('/')
    await expect(page).toHaveURL(/\/zh$/)
  })

  test('the language switcher marks the active language', async ({ page }) => {
    await page.goto('/zh')

    // The trigger and the option share the same accessible name, so scope the
    // assertion to the popover surface.
    await openLanguageSwitcher(page, '中文', 'zh')

    const options = page.getByRole('dialog', { name: '中文' })
    await expect(options).toBeVisible()
    await expect(options.getByRole('button', { name: '中文' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    await expect(options.getByRole('button', { name: 'English' })).not.toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  test('an unknown path under a valid locale renders the localised 404', async ({ page }) => {
    const response = await page.goto('/km/no-such-page')
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', 'km-KH')
  })
})
