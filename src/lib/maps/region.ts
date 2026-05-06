/**
 * City / region → ISO 3166-1 alpha-2 country code mapping.
 *
 * Used to set `regionCode` on Google Places Text Search so a Taiwan-IP user
 * searching for "東京駅" gets Tokyo results instead of Taipei results.
 *
 * regionCode 只接受 country level（ISO alpha-2）。City-level bias 要走 locationBias
 * （未實作）。所以「東京 / 京都 / 大阪」皆映射到 JP — 起碼國家對。
 *
 * Returns undefined for "全部地區" / unknown user-typed region — let Google fall
 * back to caller-IP geolocation (legacy behaviour, accepted trade-off).
 */
const CITY_TO_COUNTRY: Record<string, string> = {
  // Japan
  '沖繩': 'JP',
  '東京': 'JP',
  '京都': 'JP',
  '大阪': 'JP',
  '北海道': 'JP',
  '福岡': 'JP',
  '名古屋': 'JP',
  '橫濱': 'JP',
  '神戶': 'JP',
  '九州': 'JP',
  '日本': 'JP',
  // Korea
  '首爾': 'KR',
  '釜山': 'KR',
  '濟州': 'KR',
  '濟州島': 'KR',
  '韓國': 'KR',
  // Taiwan
  '台北': 'TW',
  '台中': 'TW',
  '台南': 'TW',
  '高雄': 'TW',
  '花蓮': 'TW',
  '台東': 'TW',
  '宜蘭': 'TW',
  '台灣': 'TW',
  // Hong Kong / Macau
  '香港': 'HK',
  '澳門': 'MO',
  // Southeast Asia
  '曼谷': 'TH',
  '清邁': 'TH',
  '泰國': 'TH',
  '新加坡': 'SG',
  '吉隆坡': 'MY',
  '馬來西亞': 'MY',
  '河內': 'VN',
  '胡志明市': 'VN',
  '越南': 'VN',
  '峇里島': 'ID',
  '巴里島': 'ID',
  '印尼': 'ID',
  '馬尼拉': 'PH',
  '宿霧': 'PH',
  '菲律賓': 'PH',
};

export function regionToCountryCode(region: string | null | undefined): string | undefined {
  if (!region) return undefined;
  if (region === '全部地區') return undefined;
  return CITY_TO_COUNTRY[region.trim()];
}
