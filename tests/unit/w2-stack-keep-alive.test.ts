/**
 * W2（owner 2026-07-24 二次確認「照原意真修」）— TripStackLayout 跨 1024px keep-alive。
 *
 * 桌機（3 欄 shell 右欄 sheet）與手機（bare 全頁）原本是兩個結構不同的 tree，跨 1024px
 * （旋轉 / 縮放）React 會 unmount/remount 操作頁 → 未存表單 state 丟。修法：`<Outlet/>`
 * 只宣告一次、用 createPortal 掛在穩定 tree 位置，DOM 依斷點搬進「桌機 sheet 槽」或
 * 「手機全頁 host」—— portal children 換 container 只移 DOM、不 remount。
 *
 * 已 /browse 真 viewport resize 實測：填未存 marker → 桌機↔手機多次翻轉 → 值全程保留。
 * 這裡 source-lock 住 keep-alive 結構，防未來重構把單一 portal 拆回兩個 tree（=回到會
 * remount 的舊行為）。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = readFileSync(join(__dirname, '../../src/pages/TripStackLayout.tsx'), 'utf8');

describe('W2 TripStackLayout 跨斷點 keep-alive（portal 單一 Outlet）', () => {
  it('Outlet 只宣告一次（單一 instance，非兩個 tree 各一份）', () => {
    // 先剝除 block/line 註解，避免比對到 docstring 裡當說明用的 <Outlet/> 文字。
    const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const outletCount = (code.match(/<Outlet\s*\/>/g) ?? []).length;
    expect(outletCount, 'Outlet 應只出現一次；出現兩次代表回到跨斷點會 remount 的舊結構').toBe(1);
  });

  it('Outlet 經 createPortal 掛出（不直接當 sheet content / 不直接全頁）', () => {
    expect(SRC).toMatch(/import \{ createPortal \} from 'react-dom'/);
    expect(SRC).toMatch(/createPortal\(<Outlet \/>, container\)/);
  });

  it('桌機 sheet 槽 + 手機全頁 host 為 portal 落點（callback ref）', () => {
    expect(SRC).toMatch(/ref=\{setDesktopSlot\}[\s\S]{0,120}data-testid="tp-stack-sheet-slot"/);
    expect(SRC).toMatch(/ref=\{setMobileSlot\}[\s\S]{0,120}data-testid="tp-stack-mobile-host"/);
  });

  it('stable fallback container 防切換瞬間 null→remount', () => {
    expect(SRC).toMatch(/fallbackRef/);
    expect(SRC).toMatch(/document\.createElement\('div'\)/);
    // container 落地：active slot 為 null 時退回 fallback（?? 兜底）
    expect(SRC).toMatch(/\(isDesktop \? desktopSlot : mobileSlot\) \?\? fallbackRef\.current/);
  });

  it('inStack 仍隨斷點（桌機 true 面板 / 手機 false 全頁）', () => {
    expect(SRC).toMatch(/inStack: isDesktop/);
  });
});
