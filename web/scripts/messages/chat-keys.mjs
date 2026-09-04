/**
 * Message keys for the chat shell (Task 14).
 *
 * The chat.* namespace already carries title/placeholder/welcome/suggestions and
 * the feedback prompts, and tools.* already covers every tool status. These are
 * only the connection states and controls that had no key yet.
 */
const chatKeys = {
  'chat.transcript': { en: 'Conversation', zh: '对话', km: 'ការសន្ទនា' },
  'chat.you': { en: 'You', zh: '你', km: 'អ្នក' },
  'chat.assistant': { en: 'Concierge', zh: '礼宾', km: 'អ្នកបម្រើ' },
  'chat.inputLabel': { en: 'Message the concierge', zh: '向礼宾发送消息', km: 'ផ្ញើសារទៅអ្នកបម្រើ' },
  'chat.newChat': { en: 'New conversation', zh: '新对话', km: 'ការសន្ទនាថ្មី' },
  'chat.reconnecting': { en: 'Reconnecting…', zh: '正在重新连接…', km: 'កំពុងភ្ជាប់ឡើងវិញ…' },
  'chat.queued': {
    en: '{count, plural, one {# message waiting to send} other {# messages waiting to send}}',
    zh: '{count, plural, other {# 条消息待发送}}',
    km: '{count, plural, other {# សារកំពុងរង់ចាំផ្ញើ}}',
  },
  'chat.offlineNotice': {
    en: 'You are offline. Messages will send when the connection returns.',
    zh: '您已离线。连接恢复后消息将自动发送。',
    km: 'អ្នកគ្មានអ៊ីនធឺណិត។ សារនឹងផ្ញើនៅពេលការតភ្ជាប់ត្រឡប់មកវិញ។',
  },
  'chat.blockedTitle': { en: 'Concierge unavailable', zh: '礼宾服务不可用', km: 'អ្នកបម្រើមិនអាចប្រើបាន' },
  'chat.blockedOrigin': {
    en: 'This site is not allowed to reach the concierge service. Please contact support.',
    zh: '本站点无权访问礼宾服务。请联系客服。',
    km: 'គេហទំព័រនេះមិនត្រូវបានអនុញ្ញាតឱ្យភ្ជាប់ទៅសេវាកម្មអ្នកបម្រើទេ។ សូមទាក់ទងផ្នែកជំនួយ។',
  },
  'chat.blockedSession': {
    en: 'Your session has expired. Please sign in again to continue.',
    zh: '您的会话已过期。请重新登录以继续。',
    km: 'សេស្សិនរបស់អ្នកបានផុតកំណត់។ សូមចូលម្តងទៀតដើម្បីបន្ត។',
  },
  'chat.requiresLoginTitle': { en: 'Sign in to book', zh: '登录以预订', km: 'ចូលដើម្បីកក់' },
  'chat.requiresLoginDesc': {
    en: 'Booking needs an account. Your conversation is kept while you sign in.',
    zh: '预订需要账户。登录时您的对话会保留。',
    km: 'ការកក់ត្រូវការគណនី។ ការសន្ទនារបស់អ្នកនឹងត្រូវរក្សាទុកពេលអ្នកចូល។',
  },
  'chat.streamingLabel': { en: 'Concierge is replying', zh: '礼宾正在回复', km: 'អ្នកបម្រើកំពុងឆ្លើយតប' },
  'chat.emptyHint': {
    en: 'Ask anything about travelling in Cambodia — trips, hotels, guides, or transport.',
    zh: '关于柬埔寨旅行的任何问题都可以问 — 行程、酒店、导游或交通。',
    km: 'សួរអ្វីក៏បានអំពីការធ្វើដំណើរនៅកម្ពុជា — ដំណើរកម្សាន្ត សណ្ឋាគារ មគ្គុទ្ទេសក៍ ឬការដឹកជញ្ជូន។',
  },
  'chat.toolsLabel': { en: 'Working on it', zh: '正在处理', km: 'កំពុងដំណើរការ' },
  'chat.sendFailed': {
    en: 'Not connected yet — your message is queued.',
    zh: '尚未连接 — 您的消息已排队。',
    km: 'មិនបានភ្ជាប់នៅឡើយ — សាររបស់អ្នកកំពុងរង់ចាំ។',
  },
}

export default chatKeys
