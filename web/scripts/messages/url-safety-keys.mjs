/**
 * One key for the lightbox's rejected-image fallback.
 *
 * Gallery URLs come from the AI agent, so they are scheme-checked before reaching
 * the DOM (see lib/url-safety.ts). A rejected source must say so rather than
 * showing an empty frame the user cannot explain.
 *
 * Usage: node scripts/add-messages.mjs scripts/messages/url-safety-keys.mjs
 */
const urlSafetyKeys = {
  'content.imageUnavailable': {
    en: 'This photo could not be shown.',
    zh: '此照片无法显示。',
    km: 'រូបភាពនេះមិនអាចបង្ហាញបានទេ។',
  },
}

export default urlSafetyKeys
