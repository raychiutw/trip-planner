/**
 * 右鍵 / Shift+F10 / 選單鍵 / Delete 的共用綁定（#1694、#1695）：所有卡片的選單（RailRowMenu、TripCardMenu）
 * 都走這一支，不各寫一套。`openAt` 收游標座標（鍵盤則為元素左側垂直置中）；`onDeleteKey` 沒傳＝沒有 Delete 行為。
 */
import { useEffect, useRef } from 'react';

/** 輸入框、選單內保留原生行為（複製貼上、文字刪除、Shift+F10 等）；checkbox / radio 不算輸入框。 */
export function isEditableTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement
    && !!t.closest('input:not([type="checkbox"]):not([type="radio"]),textarea,select,[contenteditable="true"],[role="menu"]');
}

export function useContextMenuTrigger(
  targetRef: React.RefObject<HTMLElement | null> | undefined,
  openAt: (x: number, y: number) => void,
  onDeleteKey?: () => void,
) {
  const openRef = useRef(openAt);
  const deleteRef = useRef(onDeleteKey);
  openRef.current = openAt;
  deleteRef.current = onDeleteKey;
  useEffect(() => {
    const el = targetRef?.current;
    if (!el) return;
    const onCtx = (e: MouseEvent) => {
      // 列內的連結保留瀏覽器原生選單；列本身就是連結（側欄行程列）則照開。
      const link = (e.target as HTMLElement).closest('a[href]');
      if (isEditableTarget(e.target) || (link && link !== el)) return;
      e.preventDefault();
      openRef.current(e.clientX, e.clientY);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        openRef.current(r.left + 16, r.top + r.height / 2);
      } else if (e.key === 'Delete' && deleteRef.current) {
        e.preventDefault();
        deleteRef.current();
      }
    };
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('contextmenu', onCtx); el.removeEventListener('keydown', onKey); };
  }, [targetRef]);
}
