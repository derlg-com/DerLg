import en from '@/messages/en.json';

/**
 * Minimal i18n shim. Only English ships in the MVP, but every user-facing
 * string goes through `t()` with a dot-path key and the message catalogue uses
 * the same JSON shape next-intl expects, so adding ZH/KM later is a matter of
 * dropping in more catalogues plus a locale provider — not touching components.
 */
export type Messages = typeof en;

const catalogues: Record<string, Messages> = { en };

export const DEFAULT_LOCALE = 'en';

export type TranslateValues = Record<string, string | number>;

function lookup(catalogue: Messages, key: string): string | undefined {
  const segments = key.split('.');
  let current: unknown = catalogue;

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, values?: TranslateValues): string {
  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function translate(key: string, values?: TranslateValues, locale = DEFAULT_LOCALE): string {
  const catalogue = catalogues[locale] ?? catalogues[DEFAULT_LOCALE];
  const template = lookup(catalogue, key);

  if (template === undefined) {
    // Surface the key rather than crashing so a missing string is obvious in
    // review but never breaks a page for a user.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[i18n] missing message for key "${key}"`);
    }
    return key;
  }

  return interpolate(template, values);
}

/**
 * Scoped translator, mirroring next-intl's `useTranslations('namespace')` API.
 * Safe in both server and client components because it closes over static JSON.
 */
export function useTranslations(namespace?: string) {
  return (key: string, values?: TranslateValues): string =>
    translate(namespace ? `${namespace}.${key}` : key, values);
}

/**
 * Translates a validation message produced by a Zod schema. Schemas carry i18n
 * keys (e.g. `validation.emailInvalid`) rather than English so the same schema
 * can be reused across locales; anything that is not a known key is passed
 * through unchanged.
 */
export function translateFieldError(message?: string): string | undefined {
  if (!message) {
    return undefined;
  }
  const translated = translate(message);
  return translated === message && !message.includes('.') ? message : translated;
}

export const getTranslations = useTranslations;
