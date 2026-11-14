/**
 * 右鍵 / Shift+F10 / 選單鍵 / Delete 的共用綁定（#1694、#1695）：所有卡片的選單（RailRowMenu、TripCardMenu）
 * 都走這一支，不各寫一套。`openAt` 收游標座標（鍵盤則為元素左側垂直置中）；`onDeleteKey` 沒傳＝沒有 Delete 行為。
 */
import { useEffect, useRef } from 'react';

import { isEditableTarget } from '../lib/isEditableTarget';
export { isEditableTarget };

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
      const { clientX: x, clientY: y } = e;
      // WebKit 在按下時就送 contextmenu，之後的 pointerup 會把剛開的 popover 當成「點外面」關掉；
      // 按鍵還沒放開就等放開之後再開（Chromium／鍵盤 buttons 為 0，照舊立即開）。
      if (e.buttons) {
        const done = () => { el.ownerDocument.removeEventListener('pointerup', done, true); el.ownerDocument.removeEventListener('pointercancel', done, true); setTimeout(() => openRef.current(x, y), 0); };
        el.ownerDocument.addEventListener('pointerup', done, true);
        el.ownerDocument.addEventListener('pointercancel', done, true);
      } else openRef.current(x, y);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.repeat || isEditableTarget(e.target)) return;
      if ((e.shiftKey && e.key === 'F10') || e.key === 'ContextMenu') {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        openRef.current(r.left + 16, r.top + r.height / 2);
      } else if (e.key === 'Delete' && deleteRef.current && !(e.target instanceof HTMLInputElement && e.target.type === 'checkbox')) {
        e.preventDefault();
        deleteRef.current();
      }
    };
    el.addEventListener('contextmenu', onCtx);
    el.addEventListener('keydown', onKey);
    return () => { el.removeEventListener('contextmenu', onCtx); el.removeEventListener('keydown', onKey); };
  }, [targetRef]);
}
