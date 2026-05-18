/**
 * v2.31.86：ChatPage 加 embedded + lockTripId props，可嵌進 TripSheet chat tab。
 * Source-grep contract — 鎖 embedded conditional render path 不被未來 refactor 砍掉。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

describe('v2.31.86 #4: ChatPage embedded + lockTripId props', () => {
  const chatSrc = read('src/pages/ChatPage.tsx');
  const sheetSrc = read('src/components/trip/TripSheet.tsx');

  it('ChatPage 有 ChatPageProps interface 含 embedded + lockTripId', () => {
    expect(chatSrc).toMatch(/export interface ChatPageProps\s*\{[\s\S]*?embedded\?:\s*boolean[\s\S]*?lockTripId\?:\s*string[\s\S]*?\}/);
  });

  it('ChatPage default function 接 ChatPageProps default {}', () => {
    expect(chatSrc).toMatch(/export default function ChatPage\(\{\s*embedded\s*=\s*false,\s*lockTripId\s*\}:\s*ChatPageProps\s*=\s*\{\}\)/);
  });

  it('ChatPage 內 useEffect lock activeTripId 到 lockTripId', () => {
    expect(chatSrc).toMatch(/useEffect\(\(\) => \{\s*if \(lockTripId && lockTripId !== activeTripId\) \{\s*setActiveTripId\(lockTripId\);/);
  });

  it('ChatPage TitleBar 被 conditional render（embedded mode skip）', () => {
    expect(chatSrc).toMatch(/\{!embedded && <TitleBar/);
  });

  it('ChatPage embedded mode return main 不 wrap AppShell', () => {
    expect(chatSrc).toMatch(/if \(embedded\) return main;/);
  });

  it('TripSheet chat tab embed ChatPage with embedded + lockTripId', () => {
    expect(sheetSrc).toMatch(/import\('\.\.\/\.\.\/pages\/ChatPage'\)/);
    expect(sheetSrc).toMatch(/<ChatPage embedded lockTripId=\{tripId\}/);
  });

  it('TripSheet chat tabpanel 不再是 placeholder JSX（拿掉「行程專屬對話」+「下一階段推出」render block）', () => {
    // 拔掉 chat tab placeholder <div className="trip-sheet-placeholder"> 結構 + 文案。
    // Comment 內仍可保留歷史敘述（即將推出），但實際 JSX render 不該有這些文案。
    expect(sheetSrc).not.toMatch(/<h3>行程專屬對話<\/h3>/);
    expect(sheetSrc).not.toMatch(/<p>針對這趟行程的 AI 對話，下一階段推出/);
  });
});
