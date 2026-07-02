import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import prettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable ESLint rules that conflict with Prettier formatting.
  // Keep this LAST so it can turn off stylistic rules from the configs above.
  prettier,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Playwright E2E specs use their own runtime/conventions, not the app lint rules.
    'tests/e2e/**',
    // Generated PWA service worker (built by Serwist CLI from app/sw.ts).
    'public/sw.js',
    'public/sw.js.map',
  ]),
])

export default eslintConfig
