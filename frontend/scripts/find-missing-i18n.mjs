import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const en = JSON.parse(readFileSync('./messages/en.json', 'utf8'))

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue
      walk(p, acc)
    } else if (/\.(ts|tsx)$/.test(name)) {
      acc.push(p)
    }
  }
  return acc
}

function getMessage(messages, path) {
  const segments = path.split('.')
  let cursor = messages
  for (const seg of segments) {
    if (cursor && typeof cursor === 'object' && seg in cursor) {
      cursor = cursor[seg]
    } else {
      return undefined
    }
  }
  return typeof cursor === 'string' ? cursor : undefined
}

const files = ['components', 'app', 'hooks', 'lib'].flatMap((d) => {
  try {
    return walk(d)
  } catch {
    return []
  }
})

const missing = new Map() // fullKey -> Set of files

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  // find the namespace from useTranslations in this file (may be multiple)
  // We track per-variable assignment: const t = useTranslations('ns')
  const nsAssignments = [
    ...src.matchAll(/(\w+)\s*=\s*useTranslations\(\s*['"]([a-zA-Z.]+)['"]\s*\)/g),
  ]
  if (nsAssignments.length === 0) continue
  // Map var name -> namespace
  const varNs = {}
  for (const m of nsAssignments) {
    varNs[m[1]] = m[2]
  }
  for (const [varName, ns] of Object.entries(varNs)) {
    // find calls like varName('key', ...) or varName('key', vars, 'fallbackKey')
    const re = new RegExp('(?<![\\w.])' + varName + '\\(\\s*[\'"]([a-zA-Z0-9_.]+)[\'"]', 'g')
    let mm
    while ((mm = re.exec(src)) !== null) {
      const key = mm[1]
      const full = ns + '.' + key
      if (getMessage(en, full) === undefined) {
        if (!missing.has(full)) missing.set(full, new Set())
        missing.get(full).add(file)
      }
    }
  }
}

const sorted = [...missing.keys()].sort()
console.log('MISSING KEYS:', sorted.length)
for (const k of sorted) {
  console.log(k, '<=', [...missing.get(k)].join(','))
}
