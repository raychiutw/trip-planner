/**
 * TimelineRail 家族的 scoped styles（#1262 拆檔）—— 依所屬元件分段命名，
 * 由 TimelineRail 一次注入（<style>），避免每列 RailRow / EntryTimeChip 各塞一個 style tag。
 */
export const RAIL_ROW_STYLES = `
.tp-rail-detail {
  /* 2026-07-07 user 要求：展開明細與 header 卡同寬（原 margin-left 56/44px
   * 對齊 dot 縮排 — v2.30.12 註解保留於 git history）。 */
  margin: 4px 0 8px;
  padding: 14px 16px;
  /* owner 2026-07-19「展開的行程景點要壓在 timeline 上」：展開卡左緣(x≈30)蓋過 timeline
   * spine(.tp-rail-body::before，position:absolute@x≈49)。absolute pseudo 的 paint order
   * 高過 static 子元素 → 直線畫在展開卡「之上」穿過內容。給展開卡 relative + z-index:1
   * 建 stacking → 卡壓在 spine 之上（線在展開區被卡蓋住，符合「壓在 timeline 上」）。 */
  position: relative;
  z-index: 1;
  /* 展開明細與卡片同色系（繼承 .tp-rail-item[data-tone] 的 --tone-*；neutral fallback tertiary）。
   * v2.57.x：外層內容欄整片改 --color-secondary 後（見 TripPage.tsx .tp-trip-page-shell），
   * fallback 若還留在 secondary 會跟外層同色、展開明細沒層次 —— 調高一階到 tertiary。 */
  background: var(--tone-subtle, var(--color-tertiary));
  border: 1px solid var(--tone-bg, var(--color-border));
  border-radius: var(--radius-md);
  display: flex; flex-direction: column; gap: 12px;
  /* iOS 式展開（2026-07-07）：interpolate-size 讓 height:auto 可 transition，
   * 搭 @starting-style 從 0 高平滑長開（Apple bezier）。不支援的瀏覽器
   * height/overflow 宣告無害，動畫 fallback 到下方 keyframes fade。
   * 收合維持條件 unmount（立即消失）— 測試與 a11y 語意不變。 */
  interpolate-size: allow-keywords;
  height: auto;
  overflow: hidden;
  transition:
    height 320ms var(--transition-timing-function-apple, ease-out),
    margin 320ms var(--transition-timing-function-apple, ease-out),
    padding 320ms var(--transition-timing-function-apple, ease-out),
    opacity 240ms ease-out;
  animation: tp-rail-detail-in 160ms var(--transition-timing-function-apple, ease-out);
}
@starting-style {
  .tp-rail-detail {
    height: 0;
    margin-top: 0; margin-bottom: 0;
    padding-top: 0; padding-bottom: 0;
    opacity: 0;
  }
}
/* 支援 interpolate-size 的瀏覽器走高度 transition，關掉舊 fade keyframes
 * 避免 opacity 被 animation 蓋過 transition（兩者疊跑不協調）。 */
@supports (interpolate-size: allow-keywords) {
  .tp-rail-detail { animation: none; }
}
@media (max-width: 760px) {
  .tp-rail-detail { padding: 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .tp-rail-detail { transition: none; animation: none; }
}
@keyframes tp-rail-detail-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.tp-rail-detail-section h4 {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--color-muted);
  margin: 0 0 6px;
}
.tp-rail-detail-desc {
  font-size: var(--font-size-body); line-height: 1.55;
  color: var(--color-foreground);
  margin: 0;
}
/* v2.30.14：景點說明 section — master POI 整合 meta row + MapLinks */
.tp-rail-poi-meta {
  display: flex; align-items: center; gap: 6px;
  flex-wrap: wrap;
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-meta-sep { opacity: 0.4; }
.tp-rail-poi-meta-star { color: var(--color-accent); font-weight: 700; }
.tp-rail-poi-meta-strong { color: var(--color-foreground); font-weight: 600; }
.tp-rail-detail-maps { margin-bottom: 10px; }
.tp-rail-detail-desc-master {
  margin-top: 8px;
  color: var(--color-muted);
  font-size: var(--font-size-footnote);
}

.tp-rail-note-value {
  font-size: var(--font-size-body); line-height: 1.55;
  background: var(--color-background); border: 1.5px solid transparent;
  border-radius: var(--radius-md);
  padding: 10px 12px;
  cursor: text;
  min-height: var(--spacing-tap-min);
  white-space: pre-wrap;
  transition: border-color 120ms;
}
.tp-rail-note-value:hover { border-color: var(--color-border); }
.tp-rail-note-value.is-empty { color: var(--color-muted); font-style: italic; cursor: pointer; }
.tp-rail-note-input {
  font: inherit; font-size: var(--font-size-body); line-height: 1.55;
  width: 100%;
  background: var(--color-background); border: 1.5px solid var(--color-accent);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  resize: vertical;
  min-height: 88px;
  color: var(--color-foreground);
  box-shadow: 0 0 0 3px var(--color-accent-subtle);
}
.tp-rail-note-input:focus { outline: none; }
.tp-rail-note-actions {
  display: flex; align-items: center; gap: 8px; margin-top: 8px;
  flex-wrap: wrap;
}
.tp-rail-note-save, .tp-rail-note-cancel {
  font: inherit; font-size: var(--font-size-footnote); font-weight: 700;
  border-radius: var(--radius-full); cursor: pointer;
  /* H4: Apple HIG 44px tap target — these are primary edit-mode actions. */
  min-height: var(--spacing-tap-min);
  padding: 8px 16px;
  border: 1px solid transparent;
}
.tp-rail-note-save {
  background: var(--color-accent-fill); color: var(--color-accent-foreground); border-color: var(--color-accent-fill);
}
.tp-rail-note-save:hover:not(:disabled) { filter: brightness(0.95); }
.tp-rail-note-save:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-rail-note-cancel {
  background: transparent; color: var(--color-muted);
}
.tp-rail-note-cancel:hover { background: var(--color-background); color: var(--color-foreground); }
.tp-rail-note-kbd { font-size: var(--font-size-caption); color: var(--color-muted); margin-left: auto; }
.tp-rail-note-kbd kbd {
  background: var(--color-background); padding: 1px 6px; border-radius: var(--radius-xs);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: var(--font-size-caption); border: 1px solid var(--color-border);
}
/* 鍵盤捷徑提示只在有實體鍵盤的裝置顯示；觸控裝置（無 hover + 粗指標）沒有 ⌘/esc 鍵。 */
@media (hover: none) and (pointer: coarse) {
  .tp-rail-note-kbd { display: none; }
}
.tp-rail-note-error {
  font-size: var(--font-size-footnote); color: var(--color-destructive);
  margin-top: 4px;
}

/* caret 現為獨立 toggle button（無障礙 toggle）；rotate 由 tokens.css
   .tp-rail-item[data-expanded] 處理，這裡只補 button reset + focus/disabled。 */
.tp-rail-caret { transition: transform 120ms; display: inline-block; background: none; border: none; padding: 0; margin: 0; font: inherit; line-height: 1; color: var(--color-muted); cursor: pointer; }
.tp-rail-caret:disabled { cursor: default; opacity: 0.4; }
.tp-rail-caret:focus-visible { border-radius: var(--radius-sm); outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }

/* 備選景點 list — alternates only (v2.30.14)。master POI 已升格到 .tp-rail-poi-meta */

/* 2026-04-29 mockup parity:expanded toolbar 從 body 上方移到底部(mockup S12
 * Variant A 規範)。margin-top + padding-top + border-top 視覺分隔 body 內容。
 * gap 改 4px 讓 4+2 兩組看起來更緊。 */
/* rev2 Section 02：head 右側動作簇 — ⋯ context menu + 展開 caret。
 * 取代舊「展開明細底部一排 icon 工具列」（複/移/編/刪），把動作收進單顆 ⋯（Apple 列表語彙）。 */
.tp-rail-head-actions {
  /* owner 2026-07-19：⋯ 與 ⌄ 兩鈕 gap 2px 太近 → 6px 拉開。 */
  display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
}

/* ⋯ trigger：桌機 hover / focus / menu 開啟才顯（Apple Music track row 行為，resting 列乾淨）；
 * 觸控無 hover → 淡顯恆在，才點得到。 */
`;

export const STOP_POI_CARD_STYLES = `
.tp-rail-poi-list { display: flex; flex-direction: column; gap: 8px; }
.tp-rail-poi-card {
  /* 備選 = 第三色粉（柔褐三色主題 2026-06）*/
  background: var(--color-accent-3-subtle);
  border: 1px solid var(--color-accent-3-bg);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  transition: border-color 160ms var(--transition-timing-function-apple);
}
.tp-rail-poi-card:hover { border-color: var(--color-accent-3); }
.tp-rail-poi-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; row-gap: 4px; }
.tp-rail-poi-name {
  font-size: var(--font-size-callout);
  font-weight: 700;
  color: var(--color-foreground);
  line-height: 1.35;
}
.tp-rail-poi-type {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  background: var(--color-tertiary);
  border-radius: var(--radius-full);
  padding: 2px 8px;
}
.tp-rail-poi-card-meta {
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.tp-rail-poi-desc {
  font-size: var(--font-size-footnote);
  color: var(--color-foreground);
  margin-top: 6px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.tp-rail-poi-note {
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
  margin-top: 4px;
  line-height: 1.55;
}

/* 設為正選 按鈕（沿用 EditEntryPage .set-master：terracotta tonal，粉底備選卡上仍清晰）。 */
.tp-rail-poi-actions { display: flex; gap: 8px; margin-top: 10px; }
.tp-rail-set-master {
  display: inline-flex; align-items: center; gap: 6px;
  min-height: 32px; padding: 0 14px;
  border: none; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-caption); font-weight: 600;
  cursor: pointer;
}
.tp-rail-set-master:hover:not(:disabled) { background: var(--color-accent-bg); }
.tp-rail-set-master:disabled { opacity: 0.5; cursor: default; }
.tp-rail-set-master .svg-icon { width: 15px; height: 15px; }
.tp-rail-set-master:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }

/* 起訖時間 chip（V2）：header sub-line 內可點膠囊，terracotta tonal + pencil；空值虛線提示。 */
`;

export const ENTRY_TIME_CHIP_STYLES = `
.tp-rail-time-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 1px 8px;
  border: 1px solid transparent; border-radius: var(--radius-full);
  background: var(--color-accent-subtle); color: var(--color-accent-deep);
  font: inherit; font-size: var(--font-size-caption2); font-weight: 700;
  font-variant-numeric: tabular-nums; letter-spacing: -0.01em;
  cursor: pointer; line-height: 1.4;
}
.tp-rail-time-chip:hover:not(:disabled) { border-color: var(--color-accent-bg); background: var(--color-accent-bg); }
.tp-rail-time-chip[aria-expanded="true"] { border-color: var(--color-accent); }
.tp-rail-time-chip.is-empty {
  background: transparent; color: var(--color-muted);
  border-color: var(--color-line-strong); border-style: dashed; font-weight: 600;
}
.tp-rail-time-chip:disabled { opacity: 0.55; cursor: default; }
.tp-rail-time-chip .svg-icon { width: 11px; height: 11px; opacity: 0.75; }
.tp-rail-time-chip:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }

/* 起訖時間 popup（portal 到 body，逃離 header .tp-rail-content overflow:hidden 裁切）。
   z 低於內層 TripTimePicker 的 .tp-time-popover(1100)，高於 sticky-nav(200)。 */
.tp-rail-time-pop {
  position: fixed; z-index: 1000;
  display: flex; flex-direction: column; gap: 10px;
  padding: 14px; min-width: 208px;
  background: var(--color-background);
  border: 1px solid var(--color-border); border-radius: var(--radius-lg);
  box-shadow: 0 12px 32px rgba(42, 31, 24, 0.18);
}
.tp-rail-time-pop-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
/* 抵達/離開 標籤在 flex row 內被壓成 min-content → 2 字 CJK 折成上下兩行（audit）。
 * nowrap + flex-shrink:0 保持單行。 */
.tp-rail-time-pop-label { font-size: var(--font-size-caption); font-weight: 700; color: var(--color-muted); white-space: nowrap; flex-shrink: 0; }
.tp-rail-time-pop-done {
  align-self: flex-end; min-height: 36px; padding: 0 18px;
  border: none; border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  font: inherit; font-size: var(--font-size-caption); font-weight: 700; cursor: pointer;
}
.tp-rail-time-pop-done:hover { background: var(--color-accent-deep); }
`;

export const RAIL_MENU_STYLES = `
.tp-rail-menu-trigger {
  border: 0; background: transparent; cursor: pointer;
  width: 32px; height: 32px; border-radius: var(--radius-full);
  display: inline-flex; align-items: center; justify-content: center;
  color: var(--color-muted);
  opacity: 0; transition: opacity 140ms, background 140ms, color 140ms;
}
.tp-rail-menu-trigger .svg-icon { width: 18px; height: 18px; }
.tp-rail-menu-trigger:hover { background: var(--color-hover, var(--color-secondary)); color: var(--color-foreground); }
@media (hover: hover) {
  .tp-rail-item:hover .tp-rail-menu-trigger,
  .tp-rail-menu-trigger:focus-visible,
  .tp-rail-menu-trigger[aria-expanded="true"] { opacity: 1; }
}
.tp-rail-menu-trigger:focus-visible { opacity: 1; outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
@media (hover: none) { .tp-rail-menu-trigger { opacity: 0.65; } }

/* ⋯ menu：原生 Popover API（top-layer 自動逃離 .tp-rail-content overflow:hidden、
 * light-dismiss 免自寫）。top-layer 不隨 anchor → 開啟時 JS 依 trigger rect 設 top/left。 */
.tp-rail-menu {
  position: fixed; margin: 0; inset: auto;
  min-width: 208px; max-width: 264px; padding: 6px;
  /* 短視窗（landscape phone、8 項 menu ~320px）夾在畫面內可捲，避免末項（刪除）落在畫面外不可及。 */
  max-height: calc(100dvh - 16px); overflow-y: auto;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg, 0 10px 28px rgba(0,0,0,0.12));
  z-index: var(--z-modal, 9000);
}
.tp-rail-menu-item {
  display: flex; align-items: center; gap: 10px; width: 100%;
  padding: 9px 10px; border: 0; background: transparent;
  border-radius: var(--radius-sm);
  font: inherit; font-size: var(--font-size-subheadline);
  color: var(--color-foreground); text-align: left; cursor: pointer;
}
.tp-rail-menu-item .svg-icon { width: 18px; height: 18px; color: var(--color-muted); flex-shrink: 0; }
.tp-rail-menu-item:hover,
.tp-rail-menu-item:focus-visible { background: var(--color-hover, var(--color-secondary)); outline: none; }
.tp-rail-menu-item.is-danger { color: var(--color-destructive); }
.tp-rail-menu-item.is-danger .svg-icon { color: var(--color-destructive); }
.tp-rail-menu-item.is-danger:hover,
.tp-rail-menu-item.is-danger:focus-visible { background: var(--color-priority-high-bg, var(--color-hover)); }
.tp-rail-menu-sep { height: 1px; margin: 5px 6px; background: var(--color-border); }

/* 拖拉排序 grip：rev2 只在排序模式（⋯「重新排序」進入）顯示 — resting 列不放 grip（Apple 慣例：
 * 排序在 ⋯ 內，不在列上排 icon）。桌機 + 觸控一致由排序模式驅動。 */
`;

export const TIMELINE_RAIL_STYLES = `
.tp-rail-grip {
  border: 0; background: transparent;
  display: none; align-items: center; justify-content: center;
  width: 24px; height: 24px;
  cursor: grab; color: var(--color-accent);
  border-radius: var(--radius-sm);
  /* drag-vs-scroll：pan-y 讓垂直快滑仍捲動 timeline，長按走 TouchSensor 認定 reorder。 */
  touch-action: pan-y; flex-shrink: 0;
}
.tp-rail-body[data-sort-mode] .tp-rail-grip { display: inline-flex; }
/* owner ⑧：排序模式時右邊 caret › 隱藏，grip 顯示在同位置（head-actions）。 */
.tp-rail-body[data-sort-mode] .tp-rail-caret { display: none; }
.tp-rail-grip:active { cursor: grabbing; }
.tp-rail-grip:focus-visible { opacity: 1; outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
.tp-rail-grip .svg-icon { width: 16px; height: 16px; }

/* 排序模式「完成」bar — sticky 在 rail 底，退出排序模式。 */
.tp-rail-sort-done {
  position: sticky; bottom: 8px; z-index: 2;
  display: flex; justify-content: center; margin: 10px 0 2px;
  pointer-events: none;
}
.tp-rail-sort-done button {
  pointer-events: auto;
  font: inherit; font-size: var(--font-size-subheadline); font-weight: 700;
  padding: 8px 22px; border-radius: var(--radius-full);
  background: var(--color-accent-fill); color: var(--color-accent-foreground);
  border: 0; cursor: pointer; box-shadow: var(--shadow-md, 0 6px 16px rgba(0,0,0,0.12));
}

/* 2026-07-07 跨天拖拉：拖曳懸停本日 rail 時淡高亮（drop-target 回饋）。
 * neutral 陰影 + 淡底，不用 tone 框（三色系統雷：tone 太淺別當框）。 */
.tp-rail-body.is-drop-target {
  background: var(--color-secondary);
  border-radius: var(--radius-md);
  box-shadow: inset 0 0 0 2px var(--color-border);
  transition: background 120ms ease-out;
}
/* 空日 drop 槽：dashed 空槽提示可拖入（僅 dndManaged 空日 render 時出現）。 */
.tp-rail-body.is-empty-day {
  min-height: 56px;
  border: 1.5px dashed var(--color-border);
  border-radius: var(--radius-md);
  display: grid;
  place-items: center;
}
.tp-rail-body.is-empty-day::after {
  content: '拖曳景點到這裡';
  font-size: var(--font-size-footnote);
  color: var(--color-muted);
}
`;

/** 全家族樣式，TimelineRail 注入一次。 */
export const TIMELINE_RAIL_SCOPED_STYLES = [
  RAIL_ROW_STYLES, STOP_POI_CARD_STYLES, ENTRY_TIME_CHIP_STYLES, RAIL_MENU_STYLES, TIMELINE_RAIL_STYLES,
].join('\n');
