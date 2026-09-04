/**
 * Message keys for the booking + checkout flow (Task 18).
 *
 * Includes two CORRECTIONS to existing keys, not just additions.
 */
const bookingFlowKeys = {
  /*
   * CORRECTION. The shipped copy said "100% if >=7 days before, 50% if 1-7 days,
   * 0% if under 24 hours", but the server's computeRefund actually gives:
   *   more than 7 days -> 100%, 4-7 days -> 50%, 3 days or fewer -> 0%.
   * So someone cancelling two days out was promised half their money and would
   * receive nothing. This is a statement about the user's money, so it has to match
   * what the server will really pay.
   */
  'bookings.cancel.policy': {
    en: 'Refunds: 100% more than 7 days before departure, 50% from 4 to 7 days, and 0% within 3 days.',
    zh: '退款：出发前 7 天以上退 100%，4 至 7 天退 50%，3 天以内不退款。',
    km: 'សងវិញ៖ ១០០% ច្រើនជាង ៧ ថ្ងៃមុនចេញដំណើរ, ៥០% ពី ៤ ដល់ ៧ ថ្ងៃ, និង ០% ក្នុងរយៈពេល ៣ ថ្ងៃ។',
  },

  // The API can report these two statuses, but they had no labels.
  'bookings.status.PAYMENT_FAILED': {
    en: 'Payment failed',
    zh: '支付失败',
    km: 'ការទូទាត់បរាជ័យ',
  },
  'bookings.status.NO_SHOW': { en: 'No show', zh: '未出现', km: 'មិនបានមក' },

  /* -------------------------------------------------------------- new keys */

  'checkout.review.title': { en: 'Review your booking', zh: '核对您的预订', km: 'ពិនិត្យការកក់របស់អ្នក' },
  'checkout.review.holdNotice': {
    en: 'Your place is held while you pay. If the hold expires you can request a new one.',
    zh: '支付期间将为您保留名额。若预留过期，您可以重新申请。',
    km: 'កន្លែងរបស់អ្នកត្រូវបានរក្សាទុកពេលអ្នកបង់ប្រាក់។ ប្រសិនបើផុតកំណត់ អ្នកអាចស្នើសុំថ្មី។',
  },
  'checkout.review.expiredTitle': { en: 'This hold has expired', zh: '此预留已过期', km: 'ការកក់នេះបានផុតកំណត់' },
  'checkout.review.expiredDesc': {
    en: 'Holds last 15 minutes. Nothing was charged — start again to check availability.',
    zh: '预留有效期为 15 分钟。未产生任何费用 — 请重新查询可订情况。',
    km: 'ការកក់មានរយៈពេល ១៥ នាទី។ មិនមានការកាត់ប្រាក់ទេ — ចាប់ផ្តើមម្តងទៀតដើម្បីពិនិត្យភាពទំនេរ។',
  },
  'checkout.review.startOver': { en: 'Browse trips', zh: '浏览行程', km: 'រកមើលដំណើរកម្សាន្ត' },
  'checkout.demoDisabledTitle': {
    en: 'Payments are not enabled',
    zh: '支付功能未启用',
    km: 'ការទូទាត់មិនត្រូវបានបើក',
  },
  'checkout.demoDisabledDesc': {
    en: 'This server has payment confirmation switched off, so this booking cannot be paid here. Your hold is unaffected.',
    zh: '此服务器已关闭支付确认功能，因此无法在此完成支付。您的预留不受影响。',
    km: 'សេវាកម្មនេះបានបិទការបញ្ជាក់ការទូទាត់ ដូច្នេះមិនអាចបង់ប្រាក់នៅទីនេះបានទេ។ ការកក់របស់អ្នកមិនប៉ះពាល់ទេ។',
  },
  'checkout.qrPending': {
    en: 'Waiting for your payment to clear…',
    zh: '正在等待支付到账…',
    km: 'កំពុងរង់ចាំការទូទាត់របស់អ្នក…',
  },
  'bookings.form.signInTitle': {
    en: 'Sign in to book',
    zh: '登录以预订',
    km: 'ចូលដើម្បីកក់',
  },
  'bookings.form.signInDesc': {
    en: 'Bookings are saved to your account, so you need to be signed in to hold a place.',
    zh: '预订将保存到您的账户，因此需要登录才能保留名额。',
    km: 'ការកក់ត្រូវបានរក្សាទុកក្នុងគណនីរបស់អ្នក ដូច្នេះអ្នកត្រូវចូលដើម្បីរក្សាកន្លែង។',
  },
  'bookings.form.errorConflict': {
    en: 'Those dates were just taken. Please choose another date.',
    zh: '该日期刚刚被预订。请选择其他日期。',
    km: 'កាលបរិច្ឆេទនោះទើបត្រូវបានកក់។ សូមជ្រើសរើសកាលបរិច្ឆេទផ្សេង។',
  },
  'bookings.form.errorPast': {
    en: 'Please choose a date in the future.',
    zh: '请选择将来的日期。',
    km: 'សូមជ្រើសរើសកាលបរិច្ឆេទនាពេលអនាគត។',
  },
  'bookings.detail.reference': { en: 'Reference', zh: '预订编号', km: 'លេខសម្គាល់' },
  'bookings.detail.bookedOn': { en: 'Booked on', zh: '预订日期', km: 'កក់នៅថ្ងៃ' },
  'bookings.detail.dates': { en: 'Dates', zh: '日期', km: 'កាលបរិច្ឆេទ' },
  'bookings.detail.payNow': { en: 'Pay now', zh: '立即支付', km: 'បង់ប្រាក់ឥឡូវ' },
}

export default bookingFlowKeys
