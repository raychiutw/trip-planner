/**
 * Drag 捲動保持 — 讓「拖動景點」不移動頁面。
 *
 * 主捲動容器是 AppShell 的 `.app-shell-main`（overflow-y:auto）——**不是 window**：
 * `.app-shell` 用 `height:100dvh` grid，各 cell 自成 scroller，window 恆不捲。
 *
 * 拖曳時頁面會「跳到不相關位置」有兩個來源，都在此一次擋掉：
 *   1. dnd-kit 內建 autoScroll：手指/游標靠近容器邊緣時，拖曳過程中會捲動容器
 *      去追被拖項（同日小幅 reorder 也常誤觸）。
 *   2. @dnd-kit/core 6.x drop 後在 useEffect 內用 `requestAnimationFrame(() =>
 *      node.focus())` 重新聚焦被拖項，且 `.focus()` 沒帶 `preventScroll` → 把已
 *      移出視野的項目 scrollIntoView 進來。
 *
 * 做法：`captureDragScroll()` 在 onDragStart 記下拖曳「開始前」的 scrollTop；
 * `restoreDragScroll()` 在 onDragEnd 用 double rAF（排在 dnd-kit 那次 rAF focus
 * 之後）還原回去 → 拖完停在開始拖的位置，頁面不移動。
 * 小幅未觸發 autoScroll 的 reorder：capture≈restore，等於 no-op。
 */
function scrollContainer(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.app-shell-main')
    ?? (document.scrollingElement as HTMLElement | null)
    ?? document.documentElement;
}

let capturedTop: number | null = null;

export function captureDragScroll(): void {
  const el = scrollContainer();
  capturedTop = el ? el.scrollTop : null;
}

export function restoreDragScroll(): void {
  const top = capturedTop;
  capturedTop = null;
  if (top == null) return;
  const el = scrollContainer();
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (Math.abs(el.scrollTop - top) > 1) el.scrollTop = top;
    });
  });
}

/**
 * 跨導航捲動記憶 — 讓「編輯/新增景點」返回行程頁時不移動頁面。
 *
 * TripPage 掛 scroll listener 持續呼 `rememberScroll` 記下 `.app-shell-main` scrollTop
 * （不能等 unmount 才讀 — 屆時 timeline 已被移除、scrollTop 被 clamp 成 0）；導向
 * /stop/:eid/edit、/add-entry 等子頁再返回 mount 時 `recallScroll` 取回還原。走 module-
 * level Map（跨 mount 存活；整頁 reload 才清），所以只在 SPA 內導航返回時有值 →
 * 冷開（reload / 首訪）走預設 auto-locate 行為，不受影響。
 */
const scrollMemory = new Map<string, number>();

export function rememberScroll(key: string): void {
  const el = scrollContainer();
  if (el) scrollMemory.set(key, el.scrollTop);
}

export function recallScroll(key: string): number | undefined {
  return scrollMemory.get(key);
}

/**
 * 還原捲動到 `top` — bounded retry 版。
 *
 * 返回行程頁時各頁自建 AppShell（無持久 layout），`.app-shell-main` 是全新的，
 * per-day timeline 還在 async 載入 → scrollHeight 不夠高，單次 `scrollTop = top`
 * 會被 clamp 到頂。故每幀重試設值，直到內容長到能容納 top（scrollTop 站得住）或
 * 用完 frame 預算（~0.75s）。內容一到位就停；期間 user 一動（任何輸入：wheel / 鍵盤 /
 * 捲軸 / 慣性）即讓位，且若 call 時 user 已在載入空窗捲過也不搶回 — 不硬跟 user 搶捲動。
 */
export function restoreScrollTo(top: number, maxFrames = 45): void {
  // el 抓一次就鎖定：若逐幀重查，還原途中 user 又導航到別的子頁時，tick 會解析到
  // 新頁的 .app-shell-main 並亂設它的 scrollTop（把不相關表單捲到本 trip 的位置）。
  const el = scrollContainer();
  if (!el) return;
  // 返回時 per-day 內容 async 載入需時，restore 常在載入完（loading 轉 false）才 fire。
  // fresh mount 的 .app-shell-main 起始 scrollTop=0、本 path 不做任何程式捲動，故 call
  // 時若 scrollTop 已 >8 只可能是 user 在這段空窗自行捲動 → 直接讓位，不搶回 savedTop。
  if (el.scrollTop > 8) return;
  let frames = 0;
  let prevHeight = -1;
  // 讓位偵測分兩層，任一觸發就停手，不跟 user 搶捲動：
  //  A) 事件層：wheel / touchstart 一來就中止 — 涵蓋「有意圖但 scrollTop 還沒動」的 case
  //     （touchstart 按住未拖、邊界 wheel 已到頂捲不動、微小 trackpad delta）。這是舊行為。
  //  B) divergence 層：scrollTop 偏離本函式上次設的值 → 中止 — 涵蓋不發 wheel/touch 的輸入
  //     （鍵盤 PageUp/方向鍵、捲軸拖曳、慣性）。舊版只有 A 故漏掉這些 → 還原空窗被逐幀扯回
  //     savedTop（往上彈回）。seed expected 為當下值（guard 後 ~0），讓 call→首幀空窗的離散
  //     捲動在首幀就被 B 抓到，不會被首幀無條件 set 蓋掉。
  let expected = el.scrollTop;
  let aborted = false;
  const abort = () => { aborted = true; };
  const cleanup = () => {
    el.removeEventListener('wheel', abort);
    el.removeEventListener('touchstart', abort);
  };
  el.addEventListener('wheel', abort, { passive: true, once: true });
  el.addEventListener('touchstart', abort, { passive: true, once: true });
  const tick = () => {
    // shell 已被拆掉（又導航走）或 user 已用 wheel/touch 接手 → 停，別碰
    if (aborted || !el.isConnected) { cleanup(); return; }
    // user 已接手捲動（scrollTop 偏離我們設的值：鍵盤 / 捲軸 / 慣性）→ 讓位
    if (Math.abs(el.scrollTop - expected) > 2) { cleanup(); return; }
    el.scrollTop = top;
    expected = el.scrollTop; // 記錄 clamp 後實際落點，供下一幀比對
    frames += 1;
    const reached = el.scrollTop >= top - 1;
    const grew = el.scrollHeight > prevHeight; // 內容還在 async 長高？
    prevHeight = el.scrollHeight;
    // 續試條件：沒到位 + 內容仍長高 + 沒用完預算。內容長完仍搆不到 top（e.g. 編輯時
    // 刪了景點、當天變短）→ grew 轉 false 就停，不跟 user 搶捲動。
    if (!reached && grew && frames < maxFrames) requestAnimationFrame(tick);
    else cleanup();
  };
  requestAnimationFrame(tick);
}
