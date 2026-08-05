import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.describe('design system', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/en/design')
  })

  test('has no critical or serious accessibility violations in light mode', async ({ page }) => {
    await page.getByRole('radio', { name: 'Light' }).click()

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('has no critical or serious accessibility violations in dark mode', async ({ page }) => {
    await page.goto('/en/design')
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const blocking = results.violations.filter(
      (violation) => violation.impact === 'critical' || violation.impact === 'serious',
    )
    expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })

  test('theme choice survives a reload', async ({ page }) => {
    await page.goto('/en/design')
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)

    await page.reload()
    // Applied by the pre-paint inline script, so it is present immediately.
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
  })

  test('dialog traps focus and returns it to the trigger', async ({ page }) => {
    await page.goto('/en/design')

    const trigger = page.getByRole('button', { name: 'Open dialog' })
    await trigger.click()

    const dialog = page.getByRole('dialog', { name: 'Confirm this booking' })
    await expect(dialog).toBeVisible()

    // Tab several times; focus must stay within the dialog.
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press('Tab')
      const inside = await dialog.evaluate((node) => node.contains(document.activeElement))
      expect(inside).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('tabs respond to arrow keys', async ({ page }) => {
    await page.goto('/en/design')

    const trips = page.getByRole('tab', { name: 'Trips' })
    await trips.focus()
    await expect(page.getByRole('tabpanel')).toContainText('Arrow keys move between tabs')

    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tabpanel')).toContainText('Hotels panel')

    await page.keyboard.press('End')
    await expect(page.getByRole('tabpanel')).toContainText('Guides panel')
  })

  test('interactive controls meet the target size standard for the device', async ({
    page,
  }, testInfo) => {
    await page.goto('/en/design')

    // WCAG 2.2 target-size-minimum (AA) is 24x24 CSS px for pointer devices; the
    // mobile-first requirement is 44x44 on touch. Assert the right one per project.
    const touch = testInfo.project.name === 'mobile'
    const minHeight = touch ? 44 : 24

    const controls = page.locator(
      'button:visible, [role="tab"]:visible, [role="radio"]:visible, [role="switch"]:visible, input:visible, select:visible, textarea:visible',
    )
    const count = await controls.count()
    expect(count).toBeGreaterThan(10)

    const undersized: string[] = []
    for (let i = 0; i < count; i += 1) {
      const control = controls.nth(i)

      // Some controls (the switch, rail arrows) expand their hit area with a
      // negatively-inset ::after, so measure the effective pointer target.
      const effective = await control.evaluate((node) => {
        const rect = node.getBoundingClientRect()
        const after = getComputedStyle(node, '::after')
        const inset = Number.parseFloat(after.getPropertyValue('inset') || '0')
        const grow = Number.isFinite(inset) && inset < 0 ? Math.abs(inset) * 2 : 0
        return { width: rect.width + grow, height: rect.height + grow }
      })

      if (effective.height < minHeight || effective.width < minHeight) {
        const label = (await control.getAttribute('aria-label')) ?? (await control.innerText())
        undersized.push(
          `${label || '(unlabelled)'} → ${Math.round(effective.width)}x${Math.round(effective.height)}px`,
        )
      }
    }

    expect(undersized, `minimum ${minHeight}px required`).toEqual([])
  })
})
