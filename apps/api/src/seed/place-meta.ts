import { PlaceCategory } from '@prisma/client';

/**
 * Editorial metadata for the places collected in `data/`. The folders give us a
 * name, coordinates and images; category, copy, price and dwell time are
 * curated here so the catalogue reads like a real product rather than a scrape.
 *
 * Fees are in integer USD cents. Capacity is a per-day cap used by the
 * availability engine (Task 8).
 */
export interface PlaceMeta {
  category: PlaceCategory;
  description: string;
  entranceFeeCents: number;
  visitDurationMinutes: number;
  dailyCapacity: number;
}

export const PLACE_META: Record<string, PlaceMeta> = {
  // ---------------------------------------------------------- Siem Reap
  'Angkor Wat': {
    category: 'TEMPLE',
    description:
      'The largest religious monument on earth and Cambodia’s emblem. Come for sunrise over the reflecting pools, then trace the 600 metres of bas-relief that wrap the third enclosure.',
    entranceFeeCents: 3700,
    visitDurationMinutes: 180,
    dailyCapacity: 400,
  },
  // Keys match the `Place` field inside location.txt, which occasionally differs
  // from the folder name (e.g. parenthesised sub-locations).
  'Angkor Thom (South Gate)': {
    category: 'TEMPLE',
    description:
      'Jayavarman VII’s walled capital, entered through the south gate with its causeway of gods and demons. Nine square kilometres of city, temples and terraces.',
    entranceFeeCents: 0,
    visitDurationMinutes: 150,
    dailyCapacity: 400,
  },
  'Bayon Temple': {
    category: 'TEMPLE',
    description:
      'Two hundred serene stone faces watch you from every direction at the centre of Angkor Thom. Best in late-afternoon light when the towers throw long shadows.',
    entranceFeeCents: 0,
    visitDurationMinutes: 90,
    dailyCapacity: 300,
  },
  'Ta Prohm': {
    category: 'TEMPLE',
    description:
      'The temple the jungle kept. Silk-cotton roots pour over collapsed galleries, deliberately left half-cleared by conservators.',
    entranceFeeCents: 0,
    visitDurationMinutes: 75,
    dailyCapacity: 300,
  },
  'Banteay Srei': {
    category: 'TEMPLE',
    description:
      'Pink sandstone carved so finely it looks like woodwork — the most detailed relief carving in the Angkor region, 25 km north-east of town.',
    entranceFeeCents: 0,
    visitDurationMinutes: 75,
    dailyCapacity: 200,
  },
  'Banteay Kdei': {
    category: 'TEMPLE',
    description:
      'A quiet, rarely-crowded monastery temple beside Srah Srang. A good first stop if you want Angkor without the coach parties.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 150,
  },
  'Banteay Samre': {
    category: 'TEMPLE',
    description:
      'A compact, beautifully restored temple with an intact moat and courtyard, well off the main circuits.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 120,
  },
  Baphuon: {
    category: 'TEMPLE',
    description:
      'An eleventh-century pyramid reassembled stone by stone after decades of painstaking archaeological jigsaw work. Climb the wooden stair for the view over Angkor Thom.',
    entranceFeeCents: 0,
    visitDurationMinutes: 45,
    dailyCapacity: 150,
  },
  'Beng Mealea': {
    category: 'TEMPLE',
    description:
      'A vast unrestored temple 65 km east of Siem Reap, half-swallowed by forest. Wear proper shoes: you climb over the collapse itself.',
    entranceFeeCents: 500,
    visitDurationMinutes: 120,
    dailyCapacity: 120,
  },
  'East Mebon': {
    category: 'TEMPLE',
    description:
      'A tenth-century temple-island once surrounded by a reservoir, guarded by two-metre stone elephants at each corner.',
    entranceFeeCents: 0,
    visitDurationMinutes: 45,
    dailyCapacity: 120,
  },
  'Neak Pean': {
    category: 'TEMPLE',
    description:
      'A tiny island shrine reached by a wooden walkway across a lake — built as a Buddhist hospital where four basins represented water, earth, fire and wind.',
    entranceFeeCents: 0,
    visitDurationMinutes: 40,
    dailyCapacity: 120,
  },
  'Phnom Bakheng': {
    category: 'TEMPLE',
    description:
      'The classic Angkor sunset hill. Numbers on the upper terrace are capped, so arrive early or book a timed climb.',
    entranceFeeCents: 0,
    visitDurationMinutes: 90,
    dailyCapacity: 150,
  },
  'Pre Rup': {
    category: 'TEMPLE',
    description:
      'A steep laterite state temple whose brick towers turn deep red at sunset. The alternative to Bakheng, with more room to breathe.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 150,
  },
  'Preah Khan': {
    category: 'TEMPLE',
    description:
      'A sprawling monastic city of corridors that narrow as you walk east, ending at a two-storey building unlike anything else at Angkor.',
    entranceFeeCents: 0,
    visitDurationMinutes: 90,
    dailyCapacity: 200,
  },
  'Srah Srang': {
    category: 'LANDMARK',
    description:
      'The royal bathing pool, still lined with its original steps and naga balustrade. A five-minute sunrise stop with almost no one else there.',
    entranceFeeCents: 0,
    visitDurationMinutes: 30,
    dailyCapacity: 200,
  },
  'Terrace of the Elephants': {
    category: 'LANDMARK',
    description:
      'The 350-metre royal viewing platform where the king reviewed his armies, carved end to end with elephants and garudas.',
    entranceFeeCents: 0,
    visitDurationMinutes: 40,
    dailyCapacity: 250,
  },
  'Phnom Kulen': {
    category: 'NATURE',
    description:
      'The sacred mountain where the Khmer empire was declared in 802 AD. Waterfalls, a reclining Buddha carved into the summit rock, and river-bed carvings.',
    entranceFeeCents: 2000,
    visitDurationMinutes: 300,
    dailyCapacity: 150,
  },
  'Kbal Spean': {
    category: 'NATURE',
    description:
      'A 1.5 km forest walk to the “river of a thousand lingas”, where eleventh-century carvings lie under flowing water.',
    entranceFeeCents: 0,
    visitDurationMinutes: 150,
    dailyCapacity: 100,
  },
  'Tonle Sap Lake': {
    category: 'NATURE',
    description:
      'South-east Asia’s largest freshwater lake, which quadruples in size each monsoon. Boat trips leave from Chong Kneas year-round.',
    entranceFeeCents: 2500,
    visitDurationMinutes: 180,
    dailyCapacity: 200,
  },
  'Kampong Phluk Floating Village': {
    category: 'NATURE',
    description:
      'Stilted houses standing eight metres above the dry-season mud, and a flooded forest you paddle through when the water is high.',
    entranceFeeCents: 2000,
    visitDurationMinutes: 210,
    dailyCapacity: 120,
  },
  'Angkor National Museum': {
    category: 'MUSEUM',
    description:
      'Eight galleries that make sense of what you are about to see in the temples — start here if it is your first day in Siem Reap.',
    entranceFeeCents: 1200,
    visitDurationMinutes: 120,
    dailyCapacity: 300,
  },
  'War Museum Cambodia': {
    category: 'MUSEUM',
    description:
      'An open-air collection of tanks, helicopters and mines, guided by veterans who lived through the conflict they describe.',
    entranceFeeCents: 500,
    visitDurationMinutes: 90,
    dailyCapacity: 150,
  },
  'Old Market (Psar Chaa)': {
    category: 'MARKET',
    description:
      'The original Siem Reap market: krama scarves, palm sugar, kampot pepper and a wet-market wing that is busiest before 8am.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 400,
  },
  'Pub Street': {
    category: 'FOOD',
    description:
      'Two pedestrianised blocks of grills, cocktails and amok curry. Loud after nine, genuinely good if you know which lanes to turn down.',
    entranceFeeCents: 0,
    visitDurationMinutes: 120,
    dailyCapacity: 500,
  },

  // -------------------------------------------------------- Phnom Penh
  'Royal Palace': {
    category: 'LANDMARK',
    description:
      'The working residence of the king since 1866. The Throne Hall and its Italian-tiled courtyards are open most mornings — shoulders and knees covered.',
    entranceFeeCents: 1000,
    visitDurationMinutes: 120,
    dailyCapacity: 400,
  },
  'Silver Pagoda': {
    category: 'TEMPLE',
    description:
      'Five thousand silver floor tiles and a life-size gold Buddha, inside the Royal Palace walls. Photography is restricted indoors.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 300,
  },
  'National Museum of Cambodia': {
    category: 'MUSEUM',
    description:
      'The world’s finest collection of Khmer sculpture, arranged around a courtyard garden in a terracotta pavilion from 1920.',
    entranceFeeCents: 1000,
    visitDurationMinutes: 120,
    dailyCapacity: 300,
  },
  'Tuol Sleng Genocide Museum': {
    category: 'MUSEUM',
    description:
      'The former S-21 prison, left as it was found in 1979. Difficult and essential; take the audio guide and give yourself time afterwards.',
    entranceFeeCents: 1000,
    visitDurationMinutes: 120,
    dailyCapacity: 300,
  },
  'Choeung Ek Killing Fields': {
    category: 'LANDMARK',
    description:
      'A memorial stupa and quiet orchard 15 km south of the city. The audio guide, narrated by survivors, is among the best anywhere.',
    entranceFeeCents: 600,
    visitDurationMinutes: 150,
    dailyCapacity: 300,
  },
  'Wat Phnom': {
    category: 'TEMPLE',
    description:
      'The hill the city is named after, and the shrine Phnom Penh grew around. Locals come to make offerings before exams and journeys.',
    entranceFeeCents: 100,
    visitDurationMinutes: 45,
    dailyCapacity: 250,
  },
  'Wat Ounalom': {
    category: 'TEMPLE',
    description:
      'Headquarters of Cambodian Buddhism, founded in 1443 on the riverfront. Forty-four stupas and a working monastic school.',
    entranceFeeCents: 0,
    visitDurationMinutes: 45,
    dailyCapacity: 200,
  },
  'Wat Botum': {
    category: 'TEMPLE',
    description:
      'A royal monastery beside the park of the same name, its grounds full of ornate stupas holding royal and monastic ashes.',
    entranceFeeCents: 0,
    visitDurationMinutes: 40,
    dailyCapacity: 200,
  },
  'Independence Monument': {
    category: 'LANDMARK',
    description:
      'The lotus-shaped 1958 monument marking independence from France, floodlit in the national colours after dark.',
    entranceFeeCents: 0,
    visitDurationMinutes: 30,
    dailyCapacity: 300,
  },
  'Cambodia Vietnam Friendship Monument': {
    category: 'LANDMARK',
    description:
      'A Soviet-era concrete monument in Botum Park, and a useful landmark for orienting yourself on foot.',
    entranceFeeCents: 0,
    visitDurationMinutes: 20,
    dailyCapacity: 200,
  },
  'Sisowath Quay': {
    category: 'LANDMARK',
    description:
      'The Mekong-front promenade. Walk it at dusk when the aerobics classes start and the boats turn on their lights.',
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 500,
  },
  'Central Market (Phsar Thmei)': {
    category: 'MARKET',
    description:
      'A 1937 art-deco dome, ochre and enormous, selling silver, gems, electronics and the city’s cheapest breakfast noodles.',
    entranceFeeCents: 0,
    visitDurationMinutes: 75,
    dailyCapacity: 400,
  },
  'Russian Market (Toul Tom Poung)': {
    category: 'MARKET',
    description:
      'Low tin roofs, narrow aisles, and the best place in the country for tailoring, vinyl records and iced coffee.',
    entranceFeeCents: 0,
    visitDurationMinutes: 75,
    dailyCapacity: 350,
  },
  'Aeon Mall Phnom Penh': {
    category: 'ENTERTAINMENT',
    description:
      'Air-conditioned refuge with a cinema, ice rink and food hall — genuinely useful in April when it hits 38 degrees.',
    entranceFeeCents: 0,
    visitDurationMinutes: 120,
    dailyCapacity: 600,
  },
  'Garden City Water Park': {
    category: 'ENTERTAINMENT',
    description:
      'Slides, wave pool and lazy river on the northern edge of the city. The reliable answer to travelling with children.',
    entranceFeeCents: 1500,
    visitDurationMinutes: 240,
    dailyCapacity: 400,
  },
  'Phnom Penh Railway Station': {
    category: 'LANDMARK',
    description:
      'A 1932 art-deco terminus, still the departure point for the slow train to Sihanoukville and Battambang.',
    entranceFeeCents: 0,
    visitDurationMinutes: 30,
    dailyCapacity: 200,
  },
};

/**
 * Fallback so the seed keeps working if new folders appear in `data/` before
 * anyone writes copy for them.
 */
export function inferPlaceMeta(name: string): PlaceMeta {
  const lower = name.toLowerCase();

  const category: PlaceCategory = lower.includes('wat')
    ? 'TEMPLE'
    : lower.includes('museum')
      ? 'MUSEUM'
      : lower.includes('market') || lower.includes('psar')
        ? 'MARKET'
        : lower.includes('lake') || lower.includes('mountain') || lower.includes('phnom kulen')
          ? 'NATURE'
          : 'LANDMARK';

  return {
    category,
    description: `${name} — a point of interest on the DerLg Cambodia map. Editorial copy pending.`,
    entranceFeeCents: 0,
    visitDurationMinutes: 60,
    dailyCapacity: 150,
  };
}
