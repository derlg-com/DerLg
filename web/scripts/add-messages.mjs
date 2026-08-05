#!/usr/bin/env node
/**
 * Adds message keys to all three locale catalogues at once.
 *
 * Translations must be supplied for every locale — tests/i18n.test.ts fails on a
 * missing key, an empty string, or ICU placeholders that differ between locales,
 * so there is no way to sneak in an English placeholder and forget about it.
 *
 * Usage: node scripts/add-messages.mjs <additions-file.mjs>
 * The additions file default-exports { 'namespace.path.key': { en, zh, km } }.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const LOCALES = ['en', 'zh', 'km']
const MESSAGES_DIR = join(process.cwd(), 'messages')

function setDeep(target, dottedPath, value) {
  const parts = dottedPath.split('.')
  const last = parts.pop()
  let node = target
  for (const part of parts) {
    if (typeof node[part] !== 'object' || node[part] === null) node[part] = {}
    node = node[part]
  }
  const existed = Object.prototype.hasOwnProperty.call(node, last)
  node[last] = value
  return existed
}

/** Sorts nothing and preserves insertion order, matching the existing files. */
function write(locale, data) {
  writeFileSync(join(MESSAGES_DIR, `${locale}.json`), `${JSON.stringify(data, null, 2)}\n`)
}

const additionsPath = process.argv[2]
if (!additionsPath) {
  console.error('Usage: node scripts/add-messages.mjs <additions-file.mjs>')
  process.exit(1)
}

const { default: additions } = await import(resolve(additionsPath))

const catalogues = Object.fromEntries(
  LOCALES.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')),
  ]),
)

let added = 0
let overwritten = 0

for (const [path, translations] of Object.entries(additions)) {
  for (const locale of LOCALES) {
    const value = translations[locale]
    if (typeof value !== 'string' || value.trim() === '') {
      console.error(`✗ ${path}: missing or empty ${locale} translation`)
      process.exit(1)
    }
    const existed = setDeep(catalogues[locale], path, value)
    if (locale === 'en') {
      if (existed) overwritten += 1
      else added += 1
    }
  }
}

for (const locale of LOCALES) write(locale, catalogues[locale])

console.log(`✓ ${added} key(s) added, ${overwritten} overwritten, across ${LOCALES.join('/')}`)
