/**
 * POI keyword → SVG element index mapping for DayArt.
 * Each keyword maps to an art key used by DayArt to render the corresponding SVG element.
 */

export type ArtKey =
  | 'snorkel' | 'beach' | 'aquarium' | 'sunset'
  | 'shrine' | 'castle' | 'temple' | 'torii' | 'garden'
  | 'market' | 'shopping' | 'nightmarket'
  | 'airport' | 'rental' | 'train'
  | 'park' | 'mountain' | 'bridge' | 'island'
  | 'hotel' | 'onsen' | 'cafe' | 'ramen'
  | 'museum' | 'tower' | 'lighthouse'
  | 'default';

interface KeywordMapping {
  keyword: string;
  art: ArtKey;
}

/**
 * Ordered list of keyword → art mappings.
 * Earlier entries take priority when multiple keywords match.
 */
const KEYWORD_MAPPINGS: KeywordMapping[] = [
  // Water activities
  { keyword: '浮潛', art: 'snorkel' },
  { keyword: 'シュノーケル', art: 'snorkel' },
  { keyword: '海灘', art: 'beach' },
  { keyword: 'Beach', art: 'beach' },
  { keyword: 'ビーチ', art: 'beach' },
  { keyword: '水族館', art: 'aquarium' },
  { keyword: 'Aquarium', art: 'aquarium' },
  { keyword: 'Sunset', art: 'sunset' },
  { keyword: '夕陽', art: 'sunset' },

  // Culture / Religion
  { keyword: '神社', art: 'shrine' },
  { keyword: '城', art: 'castle' },
  { keyword: '寺', art: 'temple' },
  { keyword: '鳥居', art: 'torii' },
  { keyword: '花園', art: 'garden' },
  { keyword: 'Garden', art: 'garden' },

  // Shopping / Food
  { keyword: '市場', art: 'market' },
  { keyword: '夜市', art: 'nightmarket' },
  { keyword: 'AEON', art: 'shopping' },
  { keyword: '唐吉', art: 'shopping' },
  { keyword: 'Mall', art: 'shopping' },
  { keyword: '來客夢', art: 'shopping' },
  { keyword: 'MEGA', art: 'shopping' },
  { keyword: 'Outlet', art: 'shopping' },
  { keyword: '拉麵', art: 'ramen' },
  { keyword: 'ラーメン', art: 'ramen' },
  { keyword: '咖啡', art: 'cafe' },
  { keyword: 'Cafe', art: 'cafe' },

  // Transport
  { keyword: '機場', art: 'airport' },
  { keyword: '空港', art: 'airport' },
  { keyword: 'Airport', art: 'airport' },
  { keyword: '租車', art: 'rental' },
  { keyword: '取車', art: 'rental' },
  { keyword: '還車', art: 'rental' },
  { keyword: '電車', art: 'train' },
  { keyword: '單軌', art: 'train' },

  // Nature
  { keyword: '公園', art: 'park' },
  { keyword: 'Park', art: 'park' },
  { keyword: '登山', art: 'mountain' },
  { keyword: '富士山', art: 'mountain' },
  { keyword: '岳', art: 'mountain' },
  { keyword: '大橋', art: 'bridge' },
  { keyword: '新月橋', art: 'bridge' },
  { keyword: '古橋', art: 'bridge' },
  { keyword: 'Bridge', art: 'bridge' },
  { keyword: '島', art: 'island' },
  { keyword: '古宇利', art: 'island' },
  { keyword: '瀨底', art: 'island' },

  // Accommodation
  { keyword: 'Hotel', art: 'hotel' },
  { keyword: '飯店', art: 'hotel' },
  { keyword: 'Check in', art: 'hotel' },
  { keyword: '溫泉', art: 'onsen' },
  { keyword: '湯', art: 'onsen' },

  // Landmarks
  { keyword: '博物館', art: 'museum' },
  { keyword: 'Museum', art: 'museum' },
  { keyword: '塔', art: 'tower' },
  { keyword: 'Tower', art: 'tower' },
  { keyword: '燈塔', art: 'lighthouse' },
];

/**
 * Extract up to `limit` unique art keys from entry titles.
 * Returns at least ['default'] if no keywords match.
 */
export function extractArtKeys(titles: string[], limit = 3): ArtKey[] {
  const found: ArtKey[] = [];
  const seen = new Set<ArtKey>();

  for (const mapping of KEYWORD_MAPPINGS) {
    if (found.length >= limit) break;
    for (const title of titles) {
      if (title.includes(mapping.keyword) && !seen.has(mapping.art)) {
        found.push(mapping.art);
        seen.add(mapping.art);
        break;
      }
    }
  }

  return found.length > 0 ? found : ['default'];
}
