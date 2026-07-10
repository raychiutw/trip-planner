import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  captureDragScroll,
  restoreDragScroll,
  rememberScroll,
  recallScroll,
  restoreScrollTo,
} from '../../src/lib/preserveScroll';

/**
 * captureDragScroll（onDragStart）記下拖曳開始前的 `.app-shell-main` scrollTop；
 * restoreDragScroll（onDragEnd）用 double-rAF 還原回去 → 抵消拖曳中的 autoScroll
 * 與 drop 後 dnd-kit 的 focus-scroll，頁面不移動。mock document + rAF 驗證。
 * （實測 baseline：往下拖近邊緣 autoScroll 把容器 1690→1996。）
 */
function setup(initialTop: number) {
  let top = initialTop;
  let writes = 0;
  const rafCbs: FrameRequestCallback[] = [];
  const el = {
    get scrollTop() { return top; },
    set scrollTop(v: number) { top = v; writes += 1; },
  };
  vi.stubGlobal('document', {
    querySelector: (sel: string) => (sel === '.app-shell-main' ? el : null),
    scrollingElement: null,
    documentElement: el,
  });
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafCbs.push(cb));
  return {
    getTop: () => top,
    setTop: (v: number) => { top = v; },
    writes: () => writes,
    flush: () => rafCbs.splice(0).forEach((cb) => cb(0)),
  };
}

describe('preserveScroll — drag capture/restore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('capture 開始位置 → autoScroll 捲走 → double-rAF 還原回開始位置', () => {
    const s = setup(1690);
    captureDragScroll();  // 記下 1690
    s.setTop(1996);       // 模擬拖曳中 autoScroll 捲到 1996
    restoreDragScroll();
    s.flush();            // frame 1 → 排 frame 2
    expect(s.getTop()).toBe(1996); // 還沒還原
    s.flush();            // frame 2 → 還原
    expect(s.getTop()).toBe(1690);
  });

  it('沒 autoScroll（位置沒變）時不寫 scrollTop', () => {
    const s = setup(1690);
    captureDragScroll();
    restoreDragScroll();
    s.flush();
    s.flush();
    expect(s.writes()).toBe(0);
  });

  it('沒先 capture 時 restore 是 no-op（不亂捲）', () => {
    const s = setup(1690);
    restoreDragScroll(); // capturedTop 為 null
    s.flush();
    s.flush();
    expect(s.writes()).toBe(0);
  });
});

describe('preserveScroll — 跨導航捲動記憶', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('rememberScroll → recallScroll 往返取回同值（tripId 為 key）', () => {
    const s = setup(2113);
    rememberScroll('trip-A');
    s.setTop(0);            // 模擬子頁 mount、容器歸零
    expect(recallScroll('trip-A')).toBe(2113);
    expect(recallScroll('trip-unknown')).toBeUndefined();
  });

  // clamp 容器 mock：scrollHeight 逐幀長高（模擬 timeline async 載入），scrollTop 被
  // clamp 到 scrollHeight-clientHeight。isConnected 供 restoreScrollTo 偵測「shell 是否
  // 還在」。sets 計數驗「停手後不再寫」。
  function clampEl() {
    let top = 0;
    let scrollHeight = 800;
    let connected = true;
    let sets = 0;
    const clientHeight = 800;
    const listeners: Record<string, Array<{ cb: () => void; once: boolean }>> = {};
    const el = {
      get isConnected() { return connected; },
      get clientHeight() { return clientHeight; },
      get scrollHeight() { return scrollHeight; },
      get scrollTop() { return top; },
      set scrollTop(v: number) { top = Math.max(0, Math.min(v, scrollHeight - clientHeight)); sets += 1; },
      addEventListener(type: string, cb: () => void, opts?: { once?: boolean }) {
        (listeners[type] ??= []).push({ cb, once: !!opts?.once });
      },
      removeEventListener(type: string, cb: () => void) {
        listeners[type] = (listeners[type] ?? []).filter((e) => e.cb !== cb);
      },
    };
    const rafCbs: FrameRequestCallback[] = [];
    vi.stubGlobal('document', { querySelector: () => el, scrollingElement: null, documentElement: el });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => rafCbs.push(cb));
    return {
      getTop: () => top,
      sets: () => sets,
      pending: () => rafCbs.length,
      detach: () => { connected = false; },
      // 模擬 user 原生捲動：瀏覽器直接改 scrollTop，不走我們的 setter（不計入 sets）
      userScroll: (v: number) => { top = Math.max(0, Math.min(v, scrollHeight - clientHeight)); },
      // 觸發已註冊的事件（wheel / touchstart）；忠實模擬 once:true → fire 後自動移除,
      // 讓 listenerCount 能抓到「拿掉顯式 cleanup、只靠 once」會漏掉未觸發的兄弟 listener
      fire: (type: string) => {
        (listeners[type] ?? []).slice().forEach((e) => {
          e.cb();
          if (e.once) listeners[type] = (listeners[type] ?? []).filter((x) => x !== e);
        });
      },
      // 已註冊的 listener 數（驗 cleanup 有沒有拆乾淨）
      listenerCount: () => Object.values(listeners).reduce((n, arr) => n + arr.length, 0),
      // 設定新內容高度後跑一幀
      step: (h: number) => { scrollHeight = h; rafCbs.splice(0).forEach((cb) => cb(0)); },
    };
  }

  it('內容 async 長高：retry 每幀重試直到還原成功', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1300);              // maxScroll 500：clamp 500，內容長高 → 續試
    expect(s.getTop()).toBe(500);
    s.step(2100);             // maxScroll 1300：clamp 1300 → 續試
    expect(s.getTop()).toBe(1300);
    s.step(2913);             // maxScroll 2113：到位 → 停
    expect(s.getTop()).toBe(2113);
  });

  it('頁面比 savedTop 短（編輯刪景點）：內容長完仍搆不到 → 停手，不硬撐搶捲動', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1000);             // maxScroll 200，內容長高 → 續試
    s.step(1000);             // 高度沒再變（載完只到 1000<2113）→ 停
    const settled = s.sets();
    s.step(1000); s.step(1000); // 再跑幾幀不應再寫
    expect(s.sets()).toBe(settled);
    expect(s.pending()).toBe(0);
  });

  it('還原途中 shell 被拆（又導航走）：isConnected=false → 停，不亂設新頁', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1300);             // 一次還原到 500
    const before = s.sets();
    s.detach();               // 這個 .app-shell-main 被拆掉
    s.step(2913);             // 內容就算長高也不該再寫
    expect(s.sets()).toBe(before);
    expect(s.pending()).toBe(0);
  });

  // 主 bug：返回行程頁還原途中往上捲 → 每幀被拉回 savedTop（「位置被拉回去」）。
  it('還原途中 user 手動捲動（wheel）→ 立即讓位，不再把位置拉回 top', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1300);             // 內容長高中，還原到 500、續試
    expect(s.getTop()).toBe(500);
    const before = s.sets();
    s.fire('wheel');          // user 往上捲的意圖
    s.userScroll(120);        // user 實際捲到 120（原生，不走 setter）
    s.step(2913);             // 內容續長高：讓位後這幀不該再寫
    expect(s.getTop()).toBe(120);     // 沒被拉回 2113
    expect(s.sets()).toBe(before);    // tick 沒再寫 scrollTop
    expect(s.pending()).toBe(0);      // loop 已停
    expect(s.listenerCount()).toBe(0); // abort 後 listener 拆乾淨
  });

  it('touchstart 同樣讓位（mobile 手指捲動）', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1300);
    const before = s.sets();
    s.fire('touchstart');
    s.step(2913);
    expect(s.sets()).toBe(before);
    expect(s.pending()).toBe(0);
  });

  it('還原正常完成後 listener 也拆乾淨（無洩漏）', () => {
    const s = clampEl();
    restoreScrollTo(2113);
    s.step(1300);             // 500
    s.step(2100);             // 1300
    s.step(2913);             // 到位 2113 → 停
    expect(s.getTop()).toBe(2113);
    expect(s.listenerCount()).toBe(0);
  });
});
