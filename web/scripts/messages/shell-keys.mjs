/**
 * Message keys required by the app shell (Task 5).
 *
 * The ported catalogue covers the old app's five-tab IA. The new shell adds a
 * desktop navigation across trips/hotels/guides/transport, plus the landmarks,
 * command palette and footer strings that IA needs.
 */
const shellKeys = {
  'shell.nav.trips': { en: 'Trips', zh: '行程', km: 'កម្មវិធីទេសចរណ៍' },
  'shell.nav.hotels': { en: 'Hotels', zh: '酒店', km: 'សណ្ឋាគារ' },
  'shell.nav.guides': { en: 'Guides', zh: '导游', km: 'មគ្គុទ្ទេសក៍' },
  'shell.nav.transport': { en: 'Transport', zh: '交通', km: 'ការដឹកជញ្ជូន' },

  'shell.navLandmark': { en: 'Main navigation', zh: '主导航', km: 'ការរុករកសំខាន់' },
  'shell.mobileNavLandmark': { en: 'Primary sections', zh: '主要板块', km: 'ផ្នែកសំខាន់' },
  'shell.skipToContent': { en: 'Skip to content', zh: '跳至主要内容', km: 'ទៅកាន់មាតិកា' },
  'shell.openMenu': { en: 'Open menu', zh: '打开菜单', km: 'បើកមឺនុយ' },
  'shell.closeMenu': { en: 'Close menu', zh: '关闭菜单', km: 'បិទមឺនុយ' },
  'shell.menu': { en: 'Menu', zh: '菜单', km: 'មឺនុយ' },
  'shell.currency': { en: 'Currency', zh: '货币', km: 'រូបិយប័ណ្ណ' },
  'shell.searchHint': { en: 'Search', zh: '搜索', km: 'ស្វែងរក' },
  'shell.searching': { en: 'Searching…', zh: '搜索中…', km: 'កំពុងស្វែងរក…' },
  'shell.searchMinChars': {
    en: 'Type at least 2 characters',
    zh: '请输入至少 2 个字符',
    km: 'សូមបញ្ចូលយ៉ាងតិច ២ អក្សរ',
  },
  'shell.online': { en: 'Back online', zh: '已恢复连接', km: 'បានភ្ជាប់ឡើងវិញ' },
  'shell.signIn': { en: 'Sign in', zh: '登录', km: 'ចូលគណនី' },

  'shell.errorTitle': {
    en: 'Something went wrong',
    zh: '出现问题',
    km: 'មានអ្វីមួយខុសប្រក្រតី',
  },
  'shell.errorDesc': {
    en: 'We hit an unexpected error. Try again, or head back home.',
    zh: '我们遇到了意外错误。请重试或返回首页。',
    km: 'យើងជួបប្រទះបញ្ហាដែលមិនបានរំពឹងទុក។ សូមព្យាយាមម្តងទៀត។',
  },

  'shell.footer.explore': { en: 'Explore', zh: '探索', km: 'ស្វែងរក' },
  'shell.footer.support': { en: 'Support', zh: '支持', km: 'ជំនួយ' },
  'shell.footer.contact': { en: 'Contact us', zh: '联系我们', km: 'ទាក់ទងមកយើង' },
  'shell.footer.rights': {
    en: '© {year} DerLg. Built for travelers, built for Cambodia.',
    zh: '© {year} DerLg。为旅行者而建，为柬埔寨而建。',
    km: '© {year} DerLg។ បង្កើតឡើងសម្រាប់អ្នកដំណើរ និងសម្រាប់កម្ពុជា។',
  },
}

export default shellKeys
