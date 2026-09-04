/**
 * Message keys for the Vibe Booking workspace.
 *
 * Three additions, matching the spec's "AI travel workspace" (§19):
 *  - `workspace.*`  the pinned panel: selected subject, map, hold, payment
 *  - `comparison.*` the side-by-side comparison table (§8)
 *  - `starter.*`    the first-turn vibe prompt builder (§3)
 *
 * `starter.prompt.*` is composed into ONE natural sentence and sent to the agent as
 * ordinary user text, so each fragment has to read as a clause that can follow the
 * one before it — not as a label. The lead is a full clause, the middles are
 * modifiers, and the tail closes the question.
 *
 * Usage: node scripts/add-messages.mjs scripts/messages/workspace-keys.mjs
 */
const workspaceKeys = {
  /* ------------------------------------------------------------------ chat */
  'chat.jumpToLatest': {
    en: 'Jump to latest',
    zh: '跳到最新',
    km: 'ទៅចុងក្រោយ',
  },
  'chat.charactersLeft': {
    en: '{count, plural, one {# character left} other {# characters left}}',
    zh: '{count, plural, other {还可输入 # 个字符}}',
    km: '{count, plural, other {នៅសល់ # តួអក្សរ}}',
  },

  /* --------------------------------------------------------------- gallery */
  'content.galleryPosition': {
    en: 'Photo {index} of {total}',
    zh: '第 {index} 张，共 {total} 张',
    km: 'រូបភាព {index} ក្នុងចំណោម {total}',
  },
  'content.galleryPrevious': { en: 'Previous photo', zh: '上一张', km: 'រូបភាពមុន' },
  'content.galleryNext': { en: 'Next photo', zh: '下一张', km: 'រូបភាពបន្ទាប់' },
  'content.galleryOpen': {
    en: 'Open photo {index} of {total}',
    zh: '打开第 {index} 张，共 {total} 张',
    km: 'បើករូបភាព {index} ក្នុងចំណោម {total}',
  },

  /* ------------------------------------------------------------- workspace */
  'workspace.title': { en: 'Trip workspace', zh: '行程工作区', km: 'កន្លែងធ្វើការដំណើរ' },
  'workspace.openSheet': {
    en: 'Open trip workspace',
    zh: '打开行程工作区',
    km: 'បើកកន្លែងធ្វើការដំណើរ',
  },
  'workspace.emptyTitle': {
    en: 'Nothing selected yet',
    zh: '尚未选择任何内容',
    km: 'មិនទាន់បានជ្រើសរើសអ្វីទេ',
  },
  'workspace.emptyDesc': {
    en: "Tell the concierge what you're after and your trip, map and booking will collect here.",
    zh: '告诉管家你想要什么，你的行程、地图和预订都会集中显示在这里。',
    km: 'ប្រាប់អ្នកណែនាំពីអ្វីដែលអ្នកចង់បាន ហើយដំណើរ ផែនទី និងការកក់របស់អ្នកនឹងបង្ហាញនៅទីនេះ។',
  },
  'workspace.footnote': {
    en: 'Prices, availability and payment status come from DerLg — the concierge never estimates them.',
    zh: '价格、可订状态与支付状态均来自 DerLg —— 管家绝不会自行估算。',
    km: 'តម្លៃ ភាពទំនេរ និងស្ថានភាពបង់ប្រាក់ មកពី DerLg — អ្នកណែនាំមិនប៉ាន់ស្មានឡើយ។',
  },
  'workspace.subject.trip': { en: 'Selected trip', zh: '已选行程', km: 'ដំណើរដែលបានជ្រើស' },
  'workspace.subject.hotel': { en: 'Selected hotel', zh: '已选酒店', km: 'សណ្ឋាគារដែលបានជ្រើស' },
  'workspace.subject.custom_trip': {
    en: 'Your custom trip',
    zh: '你的定制行程',
    km: 'ដំណើរតាមតម្រូវការរបស់អ្នក',
  },
  'workspace.mapTitle': { en: 'Location', zh: '位置', km: 'ទីតាំង' },
  'workspace.itineraryTitle': { en: 'Day by day', zh: '每日安排', km: 'កម្មវិធីប្រចាំថ្ងៃ' },
  'workspace.galleryTitle': { en: 'Photos', zh: '照片', km: 'រូបភាព' },
  'workspace.optionsTitle': { en: 'Options on the table', zh: '可选方案', km: 'ជម្រើសដែលមាន' },
  'workspace.optionsCount.trip': {
    en: '{count, plural, one {# trip to choose from} other {# trips to choose from}}',
    zh: '{count, plural, other {# 个行程可选}}',
    km: '{count, plural, other {ដំណើរ # ជម្រើស}}',
  },
  'workspace.optionsCount.hotel': {
    en: '{count, plural, one {# hotel to choose from} other {# hotels to choose from}}',
    zh: '{count, plural, other {# 家酒店可选}}',
    km: '{count, plural, other {សណ្ឋាគារ # ជម្រើស}}',
  },
  'workspace.optionsCount.guide': {
    en: '{count, plural, one {# guide to choose from} other {# guides to choose from}}',
    zh: '{count, plural, other {# 位导游可选}}',
    km: '{count, plural, other {មគ្គុទ្ទេសក៍ # ជម្រើស}}',
  },
  'workspace.optionsCount.transport': {
    en: '{count, plural, one {# transport option} other {# transport options}}',
    zh: '{count, plural, other {# 个交通方案}}',
    km: '{count, plural, other {ជម្រើសដឹកជញ្ជូន #}}',
  },
  'workspace.compare': { en: 'Compare them', zh: '帮我对比', km: 'ប្រៀបធៀបវា' },
  'workspace.cheapest': { en: 'Which is cheapest?', zh: '哪个最便宜？', km: 'មួយណាថោកជាងគេ?' },
  'workspace.askCompare': {
    en: 'Compare these options for me',
    zh: '帮我对比这些方案',
    km: 'សូមប្រៀបធៀបជម្រើសទាំងនេះឲ្យខ្ញុំ',
  },
  'workspace.askCheapest': {
    en: 'Which of these is the cheapest?',
    zh: '这些里面哪个最便宜？',
    km: 'ក្នុងចំណោមនេះ មួយណាថោកជាងគេ?',
  },
  'workspace.askBook': {
    en: 'I want to book "{name}"',
    zh: '我想预订「{name}」',
    km: 'ខ្ញុំចង់កក់ «{name}»',
  },
  'workspace.askPay': {
    en: 'How do I pay for {name}?',
    zh: '{name} 要怎么付款？',
    km: 'ខ្ញុំបង់ប្រាក់សម្រាប់ {name} ដោយរបៀបណា?',
  },
  'workspace.askRetryPayment': {
    en: 'My payment failed — can I try again?',
    zh: '我的付款失败了，可以再试一次吗？',
    km: 'ការបង់ប្រាក់របស់ខ្ញុំបានបរាជ័យ — ខ្ញុំអាចព្យាយាមម្តងទៀតបានទេ?',
  },
  'workspace.payNow': { en: 'Pay now', zh: '立即付款', km: 'បង់ប្រាក់ឥឡូវនេះ' },
  'workspace.watchingPayment': {
    en: 'Checking for your payment…',
    zh: '正在确认你的付款…',
    km: 'កំពុងពិនិត្យការបង់ប្រាក់របស់អ្នក…',
  },
  'workspace.openInGoogleMaps': { en: 'Google Maps', zh: '谷歌地图', km: 'Google Maps' },
  'workspace.directions': { en: 'Directions', zh: '路线导航', km: 'ទិសដៅ' },
  'workspace.opensNewTab': {
    en: 'opens in a new tab',
    zh: '将在新标签页打开',
    km: 'បើកក្នុងផ្ទាំងថ្មី',
  },

  /* ------------------------------------------------------------ comparison */
  'comparison.attribute': { en: 'Attribute', zh: '对比项', km: 'លក្ខណៈ' },
  'comparison.price': { en: 'Price', zh: '价格', km: 'តម្លៃ' },
  'comparison.duration': { en: 'Duration', zh: '天数', km: 'រយៈពេល' },
  'comparison.rating': { en: 'Rating', zh: '评分', km: 'ការវាយតម្លៃ' },
  'comparison.location': { en: 'Location', zh: '地点', km: 'ទីតាំង' },
  'comparison.highlights': { en: 'Highlights', zh: '亮点', km: 'ចំណុចពិសេស' },
  'comparison.days': {
    en: '{count, plural, one {# day} other {# days}}',
    zh: '{count, plural, other {# 天}}',
    km: '{count, plural, other {# ថ្ងៃ}}',
  },
  'comparison.cheapest': { en: 'Cheapest', zh: '最便宜', km: 'ថោកជាងគេ' },
  'comparison.topRated': { en: 'Top rated', zh: '评分最高', km: 'វាយតម្លៃខ្ពស់បំផុត' },
  'comparison.askRecommendation': {
    en: 'Which one do you recommend?',
    zh: '你推荐哪一个？',
    km: 'តើអ្នកណែនាំមួយណា?',
  },
  'comparison.askWhich': {
    en: 'Between {names}, which do you recommend and why?',
    zh: '在 {names} 之间，你推荐哪个？为什么？',
    km: 'រវាង {names} តើអ្នកណែនាំមួយណា ហើយហេតុអ្វី?',
  },

  /* --------------------------------------------------------------- starter */
  'starter.title': {
    en: 'Start with your vibe',
    zh: '从你的心情开始',
    km: 'ចាប់ផ្តើមពីអារម្មណ៍របស់អ្នក',
  },
  'starter.moodLabel': { en: 'The vibe', zh: '想要的感觉', km: 'អារម្មណ៍ដែលចង់បាន' },
  'starter.daysLabel': { en: 'How long', zh: '行程天数', km: 'រយៈពេលប៉ុន្មាន' },
  'starter.partyLabel': { en: "Who's coming", zh: '同行的人', km: 'អ្នកណាទៅជាមួយ' },
  'starter.budgetLabel': { en: 'Budget per person', zh: '每人预算', km: 'ថវិកាក្នុងមួយនាក់' },
  'starter.mood.peaceful': { en: 'Peaceful', zh: '宁静', km: 'ស្ងប់ស្ងាត់' },
  'starter.mood.temples': { en: 'Temples', zh: '寺庙古迹', km: 'ប្រាសាទ' },
  'starter.mood.beach': { en: 'Beach', zh: '海滨', km: 'ឆ្នេរ' },
  'starter.mood.nature': { en: 'Nature', zh: '自然', km: 'ធម្មជាតិ' },
  'starter.mood.food': { en: 'Food', zh: '美食', km: 'ម្ហូប' },
  'starter.mood.nightlife': { en: 'Nightlife', zh: '夜生活', km: 'ជីវិតរាត្រី' },
  'starter.daysOption': {
    en: '{count, plural, one {# day} other {# days}}',
    zh: '{count, plural, other {# 天}}',
    km: '{count, plural, other {# ថ្ងៃ}}',
  },
  'starter.party.solo': { en: 'Just me', zh: '我一个人', km: 'ខ្ញុំម្នាក់ឯង' },
  'starter.party.couple': { en: 'Couple', zh: '情侣两人', km: 'គូស្នេហ៍' },
  'starter.party.family': { en: 'Family', zh: '家庭出游', km: 'គ្រួសារ' },
  'starter.party.friends': { en: 'Friends', zh: '朋友同行', km: 'មិត្តភក្តិ' },
  'starter.budgetOption': { en: 'Around ${amount}', zh: '约 {amount} 美元', km: 'ប្រហែល ${amount}' },
  'starter.previewLabel': { en: "We'll ask", zh: '我们会这样问', km: 'យើងនឹងសួរថា' },
  'starter.send': { en: 'Ask the concierge', zh: '问问管家', km: 'សួរអ្នកណែនាំ' },
  'starter.reset': { en: 'Clear', zh: '清空', km: 'សម្អាត' },

  'starter.prompt.moodLeadDefault': {
    en: "I'd like a trip somewhere in Cambodia",
    zh: '我想在柬埔寨安排一趟旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរនៅកម្ពុជា',
  },
  'starter.prompt.moodLead.peaceful': {
    en: "I'd like a peaceful, relaxing trip in Cambodia",
    zh: '我想在柬埔寨安排一趟宁静放松的旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរស្ងប់ស្ងាត់ និងសម្រាកនៅកម្ពុជា',
  },
  'starter.prompt.moodLead.temples': {
    en: "I'd like a trip in Cambodia focused on temples and history",
    zh: '我想在柬埔寨安排一趟以寺庙和历史为主的旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរនៅកម្ពុជាដែលផ្តោតលើប្រាសាទ និងប្រវត្តិសាស្ត្រ',
  },
  'starter.prompt.moodLead.beach': {
    en: "I'd like a beach trip in Cambodia",
    zh: '我想在柬埔寨安排一趟海滨旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរទៅឆ្នេរនៅកម្ពុជា',
  },
  'starter.prompt.moodLead.nature': {
    en: "I'd like a nature trip in Cambodia with mountains or jungle",
    zh: '我想在柬埔寨安排一趟有山林自然风光的旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរធម្មជាតិនៅកម្ពុជា ដែលមានភ្នំ ឬព្រៃ',
  },
  'starter.prompt.moodLead.food': {
    en: "I'd like a trip in Cambodia built around great food",
    zh: '我想在柬埔寨安排一趟以美食为主的旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរនៅកម្ពុជាដែលផ្តោតលើម្ហូបឆ្ងាញ់',
  },
  'starter.prompt.moodLead.nightlife': {
    en: "I'd like a lively trip in Cambodia with good nightlife",
    zh: '我想在柬埔寨安排一趟热闹、夜生活丰富的旅行',
    km: 'ខ្ញុំចង់ធ្វើដំណើរសប្បាយរីករាយនៅកម្ពុជា ដែលមានជីវិតរាត្រីល្អ',
  },
  'starter.prompt.days': {
    en: 'for {count, plural, one {# day} other {# days}}',
    zh: '为期 {count, plural, other {# 天}}',
    km: 'រយៈពេល {count, plural, other {# ថ្ងៃ}}',
  },
  'starter.prompt.party.solo': {
    en: 'travelling on my own',
    zh: '我一个人出行',
    km: 'ធ្វើដំណើរម្នាក់ឯង',
  },
  'starter.prompt.party.couple': {
    en: 'with my partner',
    zh: '和伴侣一起',
    km: 'ជាមួយគូស្នេហ៍របស់ខ្ញុំ',
  },
  'starter.prompt.party.family': {
    en: 'with my family',
    zh: '和家人一起',
    km: 'ជាមួយគ្រួសាររបស់ខ្ញុំ',
  },
  'starter.prompt.party.friends': {
    en: 'with friends',
    zh: '和朋友一起',
    km: 'ជាមួយមិត្តភក្តិ',
  },
  'starter.prompt.budget': {
    en: 'and a budget of around ${amount} per person',
    zh: '每人预算大约 {amount} 美元',
    km: 'និងថវិកាប្រហែល ${amount} ក្នុងមួយនាក់',
  },
  'starter.prompt.tail': {
    en: '— what do you recommend?',
    zh: '有什么推荐吗？',
    km: 'តើអ្នកណែនាំអ្វី?',
  },
}

export default workspaceKeys
