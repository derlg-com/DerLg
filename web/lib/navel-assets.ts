/**
 * NAVEL Travel Booking App UI Kit Authentic Assets
 * Extracted directly from NAVEL - Travel Booking App UI Kit [LIGHT].fig
 */

export const NAVEL_ASSETS = {
  // Onboarding & Splash
  onboarding: {
    slide1: '/assets/navel/01a8cf5433da9c46c0cc74cfeb3ca5ed5fa63329.jpg',
    slide2: '/assets/navel/e7d0c33df2e4e341e09965dbdf1d26a4ef7c8edf.jpg',
    slide3: '/assets/navel/fe7320ce967c4bb9b1fc24da0ece20f20018f4b7.jpg',
  },

  // Avatars
  avatars: {
    evelyn: '/assets/navel/2a276ac6bc82a0bf847835162b8ac387650bde9f.png',
    reviewer1: '/assets/navel/e812eff1187048896ebb69f73312f63a0e972385.jpg',
    reviewer2: '/assets/navel/1abbac014d076e01dd348c2b28c40de435cf3171.png',
  },

  // Hero & Destination Highlights (Tall 265x534 & Detail 1920x1080)
  destinations: {
    kelingking: '/assets/navel/41fc599cba4fc79712cd5dfe3ea142cad9b23486.jpg',
    borobudur: '/assets/navel/83ac231320605b8d66431a5febb166d94ea0d67f.jpg',
    machuPicchu: '/assets/navel/f7b66f3c82111aeeb21fd90b6abb87f86ebca8f5.jpg',
    baliGreen: '/assets/navel/6b3f3e290197d661781e4886f9b52ed30f2210da.jpg',
    mountFuji: '/assets/navel/e38aa92e89b9b115c34223aff9cdf24acc23554b.jpg',
    angkorWat: '/assets/navel/f6be1be2a1e237e74bf71b034d643d85bcbb30c9.jpg',
    indonesiaLake: '/assets/navel/fc72ab063cd5f2cb6c7005651ce1faf571ab2800.jpg',
    peruMountain: '/assets/navel/561898a51629dd70525d0ce9d3ad5463162b5e52.jpg',
  },

  // Gallery thumbnails
  thumbnails: [
    '/assets/navel/c1e4350c69ef4bbcdcb11e72b43c94fec17ff155.jpg',
    '/assets/navel/e90810d82839de07664ce9d5727cae316becbfea.jpg',
    '/assets/navel/4469eb7c6ce5bb4df26527b7b60f25be81563b7f.jpg',
    '/assets/navel/3a9ab7fbac6bda2cd01386ab1f779e22dfbdf2e9.jpg',
  ],

  // Countries highlights
  countries: [
    {
      id: 'kh',
      name: 'Cambodia',
      destinationsCount: 42,
      image: '/assets/navel/f6be1be2a1e237e74bf71b034d643d85bcbb30c9.jpg',
      citiesCount: 8,
    },
    {
      id: 'id',
      name: 'Indonesia',
      destinationsCount: 68,
      image: '/assets/navel/41fc599cba4fc79712cd5dfe3ea142cad9b23486.jpg',
      citiesCount: 14,
    },
    {
      id: 'pe',
      name: 'Peru',
      destinationsCount: 35,
      image: '/assets/navel/f7b66f3c82111aeeb21fd90b6abb87f86ebca8f5.jpg',
      citiesCount: 6,
    },
    {
      id: 'jp',
      name: 'Japan',
      destinationsCount: 54,
      image: '/assets/navel/e38aa92e89b9b115c34223aff9cdf24acc23554b.jpg',
      citiesCount: 12,
    },
  ],
} as const

const FALLBACK_LIST = [
  NAVEL_ASSETS.destinations.kelingking,
  NAVEL_ASSETS.destinations.borobudur,
  NAVEL_ASSETS.destinations.machuPicchu,
  NAVEL_ASSETS.destinations.baliGreen,
  NAVEL_ASSETS.destinations.mountFuji,
  NAVEL_ASSETS.destinations.angkorWat,
  NAVEL_ASSETS.destinations.indonesiaLake,
  NAVEL_ASSETS.destinations.peruMountain,
]

/**
 * Returns a high-res NAVEL destination image, with a deterministic fallback based on identifier.
 */
export function getNavelImage(preferredUrl?: string | null, seed?: string | number): string {
  if (preferredUrl && (preferredUrl.startsWith('/') || preferredUrl.startsWith('http'))) {
    return preferredUrl
  }
  if (seed !== undefined) {
    const seedStr = String(seed)
    let hash = 0
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i)
      hash |= 0
    }
    const idx = Math.abs(hash) % FALLBACK_LIST.length
    return FALLBACK_LIST[idx] ?? NAVEL_ASSETS.destinations.kelingking
  }
  return NAVEL_ASSETS.destinations.kelingking
}
