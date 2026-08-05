/**
 * Message keys for content payload renderers (Task 15).
 *
 * The `content` namespace already carries trips/hotels/transport/itinerary/weather/
 * budget/comparison/gallery/bookNow/viewDetails/checkAvailability/findMoreLikeThis/
 * perPerson/perNight. This adds only what had no key.
 */
const payloadKeys = {
  'chat.blockUnavailable': {
    en: 'These results cannot be shown here yet.',
    zh: '这些结果暂时无法在此显示。',
    km: 'លទ្ធផលទាំងនេះមិនអាចបង្ហាញនៅទីនេះនៅឡើយទេ។',
  },
  'content.resultsLabel': {
    en: 'Results from the concierge',
    zh: '来自礼宾的结果',
    km: 'លទ្ធផលពីអ្នកបម្រើ',
  },
}

export default payloadKeys
