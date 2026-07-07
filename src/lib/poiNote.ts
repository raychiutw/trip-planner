/**
 * poiNote — 加景點時把 Place Details 的營業時間 + 價位組成備註文字（2026-07-08）。
 *
 * user 要求：加 Google 景點時，若有消費金額 / 營業時間要帶進備註（訂位 Google
 * 無此欄位 → 由 user 自行在編輯景點頁補）。原本備註只放地址，現在營業/價位優先，
 * 地址墊底。純函數：AddStopPage 直接用，unit test 直測。
 */
import { condenseHours } from './poiHours';

/** Google Places (New) priceLevel enum → ￥ 符號（Japan 行程語境）。 */
const PRICE_LEVEL_SYMBOL: Record<string, string> = {
  PRICE_LEVEL_FREE: '免費',
  PRICE_LEVEL_INEXPENSIVE: '￥',
  PRICE_LEVEL_MODERATE: '￥￥',
  PRICE_LEVEL_EXPENSIVE: '￥￥￥',
  PRICE_LEVEL_VERY_EXPENSIVE: '￥￥￥￥',
};

export function priceLevelSymbol(level: string | null | undefined): string {
  if (!level) return '';
  return PRICE_LEVEL_SYMBOL[level] ?? '';
}

/**
 * 組備註：`營業 <condensed hours>` / `消費 <￥符號>` / `<地址>`，各佔一行。
 * 全空 → undefined（呼叫端不帶 note）。
 */
export function buildPoiNote(input: {
  hoursRaw?: string | null;
  priceLevel?: string | null;
  address?: string | null;
}): string | undefined {
  const parts: string[] = [];
  const hours = condenseHours(input.hoursRaw);
  if (hours) parts.push(`營業 ${hours}`);
  const price = priceLevelSymbol(input.priceLevel);
  if (price) parts.push(`消費 ${price}`);
  const address = input.address?.trim();
  if (address) parts.push(address);
  return parts.length > 0 ? parts.join('\n') : undefined;
}
