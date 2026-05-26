import type { Request } from 'express';

export type Lang = 'en' | 'zh' | 'km';

const SUPPORTED: Lang[] = ['en', 'zh', 'km'];

/**
 * Reads the `Accept-Language` header and returns the first supported language tag.
 * Defaults to `'en'` if none match.
 */
export function parseAcceptLanguage(req: Request): Lang {
  const header = req.headers['accept-language'];
  if (!header) return 'en';

  for (const part of header.split(',')) {
    const tag = part.split(';')[0].trim().toLowerCase().slice(0, 2) as Lang;
    if (SUPPORTED.includes(tag)) return tag;
  }
  return 'en';
}
