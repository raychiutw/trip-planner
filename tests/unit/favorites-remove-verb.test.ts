import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * 收藏／備選的使用者可見文案必須用「移除」而非「刪除」（#1187）。
 *
 * DESIGN.md §Desktop CRUD Interaction 的動詞語意條款：
 *   **移除**（Remove）＝ 解除關聯，可復原、不銷毀底層資料
 *   **刪除**（Delete）＝ 真正銷毀資料
 *
 * 收藏解除的是 `poi_favorites` 的關聯，**底層 POI 仍在 universal pool**。寫「刪除」會讓
 * 使用者以為 POI 被毀掉，於是不敢用這個功能。
 *
 * ⚠ 這條**與 undo 無關**。owner 2026-07-26 裁定維持 W12：收藏移除照舊跳確認、無 undo、
 * 不提供 restore（#1165 已因此關為 superseded）。動詞條款講的是「這個動作有沒有銷毀底層
 * 資料」，跟「事後能不能反悔」是兩件事，兩者並存不矛盾 —— **不要因為這條守衛而把確認框
 * 拿掉**，所以下面另有一條測試鎖住確認框還在。
 *
 * ⚠ testid `favorites-delete-selected` 刻意保留原名（unit + e2e 都在用），本守衛只看
 * 使用者看得到的字。
 */

const root = resolve(__dirname, '../..');

/** 剝掉註解 —— 本檔的說明註解自己就寫著「刪除」，不剝會拿註解當違規。 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** 抽出所有字串字面值與樣板字串內容（使用者可見文案就住在這裡）。 */
function userFacingStrings(src: string): string[] {
  return [
    ...src.matchAll(/'([^'\\]*)'/g),
    ...src.matchAll(/"([^"\\]*)"/g),
    ...src.matchAll(/`([^`]*)`/g),
  ].map((m) => m[1]);
}

describe('收藏／備選的動作動詞（#1187）', () => {
  const favorites = stripComments(readFileSync(resolve(root, 'src/pages/PoiFavoritesPage.tsx'), 'utf-8'));

  it('收藏頁沒有任何使用者可見的「刪除」', () => {
    const offenders = userFacingStrings(favorites).filter((s) => s.includes('刪除'));
    // 允許「景點本身不會被刪除」這種**說明 POI 不會被銷毀**的句子 —— 它正是本票要傳達的語意
    const real = offenders.filter((s) => !s.includes('不會被刪除'));
    expect(real, '收藏移除的是 poi_favorites 關聯，不銷毀 POI → 文案用「移除」').toEqual([]);
  });

  it('收藏頁的批次動作鈕寫「移除」', () => {
    expect(favorites, '批次鈕文案').toMatch(/'移除中…'\s*:\s*'移除'/);
  });

  it('確認對話框仍在，只是文案改了（W12 維持，不要順手拿掉）', () => {
    // 用 `<ConfirmModal` 這種前綴比對會讓 `<ConfirmModalXX` 也算通過（mutation 實測過）。
    // 綁「元素標籤 + 它必有的 open prop」才擋得住。
    expect(favorites, '確認框被拿掉了 —— 那是被推翻的方向，見 #1165')
      .toMatch(/<ConfirmModal\s+open=\{deleteConfirmOpen\}/);
    expect(favorites, '確認框標題應為「移除」語系').toMatch(/title="確定移除收藏？"/);
    expect(favorites, '確認鈕應為「移除」').toMatch(/confirmLabel="移除"/);
  });

  it('testid 未被改名（unit + e2e 都在用）', () => {
    expect(favorites).toContain('favorites-delete-selected');
  });

  it('備選的移除鈕 aria-label 與它的確認框同一個動詞', () => {
    const edit = stripComments(readFileSync(resolve(root, 'src/pages/EditEntryPage.tsx'), 'utf-8'));
    // 備選解除的是 entry↔poi 關聯，POI 仍在 → 同樣走「移除」。
    // 這裡不掃整份 EditEntryPage —— 同檔的「刪除整個停留點」是**真的**銷毀 trip_entries，
    // 那個「刪除」是正確用字，不能一起禁掉。
    expect(edit, '備選移除鈕的 aria-label 仍寫「刪除」，與確認框的「移除備選」不一致')
      .toMatch(/aria-label=\{`移除備選 \$\{alt\.name\}`\}/);
    expect(edit, '備選確認框').toMatch(/confirmLabel="移除備選"/);
    expect(edit, '「刪除整個停留點」是真的銷毀資料，動詞正確，不該被改掉')
      .toMatch(/confirmLabel="刪除停留點"/);
  });
});
