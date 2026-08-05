import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * Applies the stored theme before first paint.
 *
 * Without this, a user who chose dark sees a flash of the light canvas while
 * React hydrates. It must be inline and synchronous in `<head>`, so
 * `dangerouslySetInnerHTML` is the correct tool here — the body is a fixed
 * literal with no interpolated user input.
 *
 * React logs a dev-only notice about script tags inside components; the script
 * runs from the server-rendered HTML, which is exactly the intent, and the
 * notice does not appear in production builds.
 */
export function ThemeScript() {
  const script = `
try {
  var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
  var preference = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  var dark = preference === 'dark' ||
    (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
} catch (error) {
  /* localStorage can throw in private mode; the light default is fine. */
}`.trim()

  return <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: script }} />
}
