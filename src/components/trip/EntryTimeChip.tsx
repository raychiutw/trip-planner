/** 時間 chip + popover（#1262 自 TimelineRail 拆出）。改時間走 entry 變更 module 的 updateEntry。 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { updateEntry } from '../../lib/entryMutations';
import Icon from '../shared/Icon';
import { showToast } from '../shared/Toast';
import { TripTimePicker } from '../TripTimePicker';
import { formatTimeRange } from '../../lib/timelineUtils';

export function EntryTimeChip({ tripId, entryId, dayNum, start, end }: {
  tripId: string | null;
  entryId: number | null;
  dayNum: number | null;
  start: string | null;
  end: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [startDraft, setStartDraft] = useState(start ?? '');
  const [endDraft, setEndDraft] = useState(end ?? '');
  const chipRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // popup 關閉時，隨 entry 最新值 seed draft（refetch / master swap 帶新時間）；開啟中
  // 不動，保住使用者進行中的編輯。
  useEffect(() => {
    if (!open) { setStartDraft(start ?? ''); setEndDraft(end ?? ''); }
  }, [start, end, open]);

  // 定位：chip 正下方；open 期間隨 scroll / resize 重算（fixed viewport 座標）。存檔改在
  // 關閉時（見下），open 期間不觸發重排，故 popup 不會邊編邊跳位、deps 只需 [open]。
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = chipRef.current?.getBoundingClientRect();
      if (r) setPos({ top: r.bottom + 6, left: r.left });
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  // 開啟時把焦點移入 popup（容器 tabIndex=-1）：否則鍵盤使用者停在 chip、要 tab 過整頁才到
  // picker（popup portal 到 body、位於 DOM 末端）。pos 已於上方 layout effect 同步設好 → 此 passive
  // effect 執行時 portal 已掛載，popRef.current 可用。
  useEffect(() => {
    if (open) popRef.current?.focus();
  }, [open]);

  // 存檔：關閉 popup 時把 draft 與原值 diff，只送有變的欄位、一次 PATCH（起訖同批 → 後端
  // effective-merge 驗證先後、只觸發一次重排/重算；避免每 pick 一發 + LWW 亂序 race）。
  const flushSave = useCallback(async () => {
    if (!tripId || entryId == null) return;
    const nextStart = startDraft === '' ? null : startDraft;
    const nextEnd = endDraft === '' ? null : endDraft;
    const body: Record<string, string | null> = {};
    if (nextStart !== (start || null)) body.start_time = nextStart;
    if (nextEnd !== (end || null)) body.end_time = nextEnd;
    if (Object.keys(body).length === 0) return; // 無變動 → 不打
    // #1260：後端已依抵達時間重排當日；module 內 emit + 重算，這裡只決定 toast。
    const r = await updateEntry(tripId, entryId, dayNum, body);
    if (!r.ok) {
      // 400 = 起訖倒置（後端 effective merge 驗證）；其餘一律失敗。draft 隨關閉後 re-seed 回原值。
      showToast(r.status === 400 ? '抵達時間需早於離開時間' : '時間儲存失敗', 'error', 5000);
      return;
    }
    void r.recompute.then((ok) => {
      if (!ok) showToast('時間已儲存，車程更新失敗，重新整理後再試', 'info', 5000);
    });
  }, [tripId, entryId, dayNum, startDraft, endDraft, start, end]);

  const closeAndSave = useCallback(() => {
    setOpen(false);
    void flushSave();
  }, [flushSave]);

  // outside-click 關閉並存檔：排除本 popup、chip、以及內層 TripTimePicker 的 .tp-time-popover portal。
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest('.tp-rail-time-pop, .tp-time-popover') || (t && chipRef.current?.contains(t))) return;
      closeAndSave();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, closeAndSave]);

  const hasTime = !!(start || end);
  const disabled = entryId == null || tripId == null;

  return (
    <>
      <button
        ref={chipRef}
        type="button"
        className={clsx('tp-rail-time-chip', !hasTime && 'is-empty')}
        onClick={(e) => { e.stopPropagation(); if (disabled) return; if (open) closeAndSave(); else setOpen(true); }}
        disabled={disabled}
        aria-expanded={open}
        aria-label="編輯起訖時間"
        data-testid={entryId != null ? `timeline-rail-time-chip-${entryId}` : undefined}
      >
        <span>{hasTime ? formatTimeRange(start ?? '', end ?? '') : '設定時間'}</span>
        <Icon name="pencil" />
      </button>
      {open && pos && createPortal(
        <div
          ref={popRef}
          className="tp-rail-time-pop"
          style={{ top: pos.top, left: pos.left }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            // Escape 關閉並存檔、焦點歸還 chip（鍵盤流程收尾；chip 常駐掛載，resort 後 React 復用同節點）。
            if (e.key === 'Escape') { e.stopPropagation(); closeAndSave(); chipRef.current?.focus(); }
          }}
          role="dialog"
          /* ⚠ 刻意**不加** aria-modal（#1150 story 6）。它是錨定在 chip 旁的 popover：
           * 沒有 backdrop、底下內容完全可見可互動、點外面會關閉並存檔（見上方 outside-click）。
           * `aria-modal="true"` 對輔助技術的意思是「這層外面的東西是 inert 的」—— 這裡不是，
           * 宣告了就是假宣稱（螢幕閱讀器會把實際上還能用的內容藏起來）。
           * 非模態的正確收尾本來就已經有了：Escape 關閉存檔 + 焦點歸還 chip。 */
          aria-label="起訖時間"
          tabIndex={-1}
        >
          <div className="tp-rail-time-pop-row">
            <span className="tp-rail-time-pop-label">抵達</span>
            <TripTimePicker value={startDraft} onChange={setStartDraft} clearable ariaLabel="抵達時間" />
          </div>
          <div className="tp-rail-time-pop-row">
            <span className="tp-rail-time-pop-label">離開</span>
            <TripTimePicker value={endDraft} onChange={setEndDraft} clearable ariaLabel="離開時間" />
          </div>
          <button type="button" className="tp-rail-time-pop-done" onClick={closeAndSave}>完成</button>
        </div>,
        document.body,
      )}
    </>
  );
}

