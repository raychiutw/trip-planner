import { useEffect } from 'react';
import { isEditableTarget } from './isEditableTarget';

/**
 * 全域快捷鍵（桌機 HIG，#1697）。一律帶修飾鍵，避開瀏覽器保留鍵（⌘N/⌘W/⌘T…）；不做 ⌘Z（產品沒有 Undo）。
 *
 * 路由感知靠 DOM：頁面把「該動作的目標元素」標上 `data-shortcut="<action>"`（用 `shortcutAttrs`），
 * 沒標的頁面按了就不做事。新增快捷鍵 = 在 SHORTCUTS 加一列 + 把目標元素標上 attrs
 * （例：`sidebar` ＝ #1708 側欄切換鈕）。
 *
 * 用 `e.code` 比對：Mac 上 Option 會把 `e.key` 變成 'ƒ'。
 * shortcut: Windows/Linux 以 Ctrl 取代 ⌘（Ctrl+Alt 在部分鍵盤等於 AltGr），有衝突再改鍵。
 */
interface Shortcut {
  action: string;
  /** aria-keyshortcuts 值 */
  keys: string;
  /** tooltip 顯示用 */
  glyph: string;
  match: (e: KeyboardEvent) => boolean;
}

const cmd = (e: KeyboardEvent) => e.metaKey || e.ctrlKey;

const SHORTCUTS: Shortcut[] = [
  { action: 'search', keys: 'Alt+Meta+F', glyph: '⌥⌘F', match: (e) => e.code === 'KeyF' && e.altKey && cmd(e) && !e.shiftKey },
  { action: 'new', keys: 'Alt+Shift+N', glyph: '⌥⇧N', match: (e) => e.code === 'KeyN' && e.altKey && e.shiftKey && !cmd(e) },
  { action: 'sidebar', keys: 'Alt+Shift+S', glyph: '⌥⇧S', match: (e) => e.code === 'KeyS' && e.altKey && e.shiftKey && !cmd(e) },
];

/** 目標元素的 props：標記動作 + 無障礙公告。 */
export function shortcutAttrs(action: string) {
  const s = SHORTCUTS.find((x) => x.action === action);
  return { 'data-shortcut': action, 'aria-keyshortcuts': s?.keys };
}

/** tooltip：「說明（快捷鍵）」。 */
export function shortcutTitle(label: string, action: string): string {
  const s = SHORTCUTS.find((x) => x.action === action);
  return s ? `${label}（${s.glyph}）` : label;
}

function runAction(action: string): boolean {
  const els = document.querySelectorAll<HTMLElement>(`[data-shortcut="${action}"]`);
  const el = Array.from(els).find((x) => x.offsetParent !== null && !(x as HTMLButtonElement).disabled);
  if (!el) return false;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.focus();
  else el.click();
  return true;
}

/** 全站掛一次（app root）。 */
export function useGlobalShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat || e.defaultPrevented) return;
      const s = SHORTCUTS.find((x) => x.match(e));
      if (!s) return;
      // 不帶 ⌘/Ctrl 的組合（⌥⇧N 等）在 Mac 輸入框是特殊字元，輸入中不攔截。
      if (!cmd(e) && isEditableTarget(e.target)) return;
      if (runAction(s.action)) e.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);
}
