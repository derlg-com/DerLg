/**
 * Message keys for booking payload blocks (Task 17).
 *
 * The checkout.* and booking.* namespaces already cover the hold countdown, card
 * labels, QR copy, the demo-mode notice and the confirmation screen. These are the
 * gaps.
 */
const bookingBlockKeys = {
  // paymentStatus has pending/succeeded/failed/retry but no cancelled.
  'paymentStatus.cancelled': { en: 'Cancelled', zh: '已取消', km: 'បានលុបចោល' },

  'booking.sandboxTitle': {
    en: 'Sandbox payment',
    zh: '沙盒支付',
    km: 'ការទូទាត់សាកល្បង',
  },
  'booking.sandboxDesc': {
    en: 'Card payments are not connected yet, so nothing is charged. Confirming here marks the booking as paid for testing.',
    zh: '尚未接入银行卡支付，因此不会产生任何费用。在此确认仅为测试目的将预订标记为已支付。',
    km: 'ការទូទាត់ដោយកាតមិនត្រូវបានភ្ជាប់នៅឡើយទេ ដូច្នេះមិនមានការកាត់ប្រាក់ទេ។ ការបញ្ជាក់នៅទីនេះគ្រាន់តែសម្គាល់ការកក់ថាបានបង់សម្រាប់ការសាកល្បង។',
  },
  'booking.signInToPay': {
    en: 'Sign in to confirm payment',
    zh: '登录以确认支付',
    km: 'ចូលដើម្បីបញ្ជាក់ការទូទាត់',
  },
  'booking.signInToPayDesc': {
    en: 'Payment can only be confirmed on a signed-in account, so it can be verified against your booking.',
    zh: '只有登录账户才能确认支付，以便与您的预订进行核对。',
    km: 'ការទូទាត់អាចបញ្ជាក់បានតែលើគណនីដែលបានចូលប៉ុណ្ណោះ ដើម្បីអាចផ្ទៀងផ្ទាត់ជាមួយការកក់របស់អ្នក។',
  },
  'booking.missingReference': {
    en: 'This payment has no booking reference, so it cannot be confirmed here. Please open it from your bookings.',
    zh: '此支付没有预订编号，无法在此确认。请从您的预订中打开。',
    km: 'ការទូទាត់នេះគ្មានលេខកក់ ដូច្នេះមិនអាចបញ្ជាក់នៅទីនេះបានទេ។ សូមបើកវាពីការកក់របស់អ្នក។',
  },
  'booking.travelDate': { en: 'Travel date', zh: '出行日期', km: 'ថ្ងៃធ្វើដំណើរ' },
  'booking.travellers': {
    en: '{count, plural, one {# traveller} other {# travellers}}',
    zh: '{count, plural, other {# 位旅客}}',
    km: '{count, plural, other {# អ្នកដំណើរ}}',
  },
  'booking.cancellationPolicy': {
    en: 'Cancellation policy',
    zh: '取消政策',
    km: 'គោលការណ៍លុបចោល',
  },
  'booking.holdExpiredDesc': {
    en: 'This hold has expired. Ask the concierge to check availability again.',
    zh: '此预留已过期。请让礼宾重新查询可订情况。',
    km: 'ការកក់នេះបានផុតកំណត់។ សូមសុំអ្នកបម្រើពិនិត្យភាពទំនេរម្តងទៀត។',
  },
  'booking.qrExpiredDesc': {
    en: 'This payment code has expired. Ask the concierge for a new one.',
    zh: '此支付码已过期。请向礼宾索取新的支付码。',
    km: 'កូដទូទាត់នេះបានផុតកំណត់។ សូមសុំកូដថ្មីពីអ្នកបម្រើ។',
  },
  'booking.paymentReference': {
    en: 'Payment reference',
    zh: '支付编号',
    km: 'លេខសម្គាល់ការទូទាត់',
  },
  'booking.viewReceipt': { en: 'View receipt', zh: '查看收据', km: 'មើលបង្កាន់ដៃ' },
}

export default bookingBlockKeys
