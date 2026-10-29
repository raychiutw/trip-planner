/**
 * #1262：TimelineRail 拆成 RailRow / EntryTimeChip / RailRowMenu / StopPoiChoiceCard + styles。
 * 既有 source-lock 測試鎖的是「時間軸這個 module」的原始碼，拆檔後改讀整個家族的串接。
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const RAIL_FAMILY_FILES = [
  'src/components/trip/TimelineRail.tsx',
  'src/components/trip/RailRow.tsx',
  'src/components/trip/EntryTimeChip.tsx',
  'src/components/trip/RailRowMenu.tsx',
  'src/components/trip/StopPoiChoiceCard.tsx',
  'src/components/trip/TimelineRail.styles.ts',
];

export function readTimelineRailSources(): string {
  const root = resolve(__dirname, '../../..');
  return RAIL_FAMILY_FILES.map((f) => readFileSync(resolve(root, f), 'utf8')).join('\n');
}
