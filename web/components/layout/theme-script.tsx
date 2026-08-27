import Script from 'next/script'
import { THEME_STORAGE_KEY } from '@/lib/theme'

/**
 * Applies the stored theme before first paint.
 *
 * Without this, a user who chose dark sees a flash of the light canvas while
 * React hydrates. Uses next/script with beforeInteractive so it runs from
 * <head> before the page becomes interactive — no inline <script> element
 * inside a React component, no React 19 dev-mode warning.
 */
export function ThemeScript() {
  const scriptBody = `(function(){try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});var p=s==='light'||s==='dark'||s==='system'?s:'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();`

  return (
    <Script
      id="theme-init"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: scriptBody }}
    />
  )
}
