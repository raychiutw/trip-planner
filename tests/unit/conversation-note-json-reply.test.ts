/**
 * 筆記生成請求的 reply 是原始 JSON 陣列時，聊天不能把它整段秀給旅伴。
 *
 * 背景：agent 對系統筆記請求（訊息以 `[行程筆記-…]` 開頭）的 reply「必須是純 JSON 陣列」，
 * 由後端 completion 套用到筆記後，再把 reply 改寫成「AI 生成完成 — 新增…」。但請求若在工作逾時
 * （10 分鐘）之後才完成，completion 看到工作已不是進行中就直接 return，不套用也不改寫，
 * 原始 JSON 就留在 reply，聊天頁照原樣顯示（production 的 #278、#279 就是如此）。
 * 這層只處理顯示：reply 仍是原始 JSON 陣列時，改顯示人話。
 */
import { describe, it, expect } from 'vitest';
import { rowToMessages, type RawRequestRow } from '../../src/lib/conversation';

const TRIP = 'trip-z7ot4qyh';
const EMERGENCY_JSON = JSON.stringify([
  { name: '日本警察', phone: '110', kind: 'police', relationship: '報案、失竊、事故處理' },
  { name: '消防局・救護車', phone: '119', kind: 'medical', relationship: '火災通報、24小時救護車招援' },
]);

function row(over: Partial<RawRequestRow>): RawRequestRow {
  return { id: 279, tripId: TRIP, status: 'completed', message: '[行程筆記-emergency] 請生成…', reply: EMERGENCY_JSON, ...over };
}
const assistant = (r: RawRequestRow) => rowToMessages(r).find((m) => m.role === 'assistant')!;

describe('rowToMessages — 筆記請求的 reply 是原始 JSON 陣列', () => {
  it.each([
    ['[行程筆記-emergency] 請生成…', '緊急聯絡'],
    ['[行程筆記-tips] 請生成…', '行前須知'],
    ['[行程筆記-lodging-tips] 請生成…', '住宿在地建議'],
  ])('%s → 不顯示原始 JSON，說明是哪一種筆記、沒有套用，並附前往筆記頁的連結', (message, label) => {
    const text = assistant(row({ message })).text;
    expect(text.trimStart().startsWith('[{')).toBe(false);
    expect(text).not.toContain('"phone"');
    expect(text).toContain(label);
    expect(text).toContain('沒有套用');
    expect(text).toContain(`/trip/${TRIP}/notes`);
  });

  it('說明裡帶回傳的筆數（來自 reply 本身，不是猜的）', () => {
    expect(assistant(row({})).text).toContain('2 筆');
  });

  it('仍以 markdown 渲染（連結要能點）', () => {
    expect(assistant(row({})).markdown).toBe(true);
  });

  it('使用者那則維持原本的短摘要', () => {
    const user = rowToMessages(row({})).find((m) => m.role === 'user')!;
    expect(user.text).toBe('已觸發 AI 行程筆記生成（緊急聯絡）');
  });
});

describe('rowToMessages — 不該被動到的情況', () => {
  it('後端已改寫成摘要（AI 生成完成 …）→ 原樣顯示', () => {
    const reply = 'AI 生成完成 — 新增 6、替換 0。\n\n[前往行程筆記 →](/trip/x/notes)';
    expect(assistant(row({ reply })).text).toBe(reply);
  });

  it('agent 回的是一般中文說明（例如「行程筆記請到 App …」）→ 原樣顯示', () => {
    const reply = '行程筆記請到 App 的「行程 → 筆記」頁按該區塊的 AI 生成鈕。';
    expect(assistant(row({ reply })).text).toBe(reply);
  });

  it('筆記請求但 reply 以 [ 開頭卻不是合法 JSON（例如 markdown 連結）→ 原樣顯示', () => {
    const reply = '[前往行程筆記 →](/trip/x/notes) 已完成';
    expect(assistant(row({ reply })).text).toBe(reply);
  });

  it('JSON 但不是陣列（物件）→ 原樣顯示（協定規定是陣列，不猜）', () => {
    const reply = '{"name":"日本警察"}';
    expect(assistant(row({ reply })).text).toBe(reply);
  });

  it('一般聊天請求，reply 剛好長得像 JSON 陣列 → 原樣顯示（只處理筆記請求）', () => {
    const r = row({ message: '幫我列出三個景點的 JSON', reply: '[{"name":"首里城"}]' });
    expect(assistant(r).text).toBe('[{"name":"首里城"}]');
  });

  it('筆記請求但狀態是 failed → 原樣顯示失敗原因', () => {
    const r = row({ status: 'failed', reply: 'AI 生成失敗 — 格式錯誤' });
    expect(assistant(r).text).toBe('AI 生成失敗 — 格式錯誤');
  });
});
