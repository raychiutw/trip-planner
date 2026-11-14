/**
 * 斷點單一來源（JS 端）。CSS 的 `@media` 不能用變數，字面值必須與這裡一致：
 * css/tokens.css 檔頭與 DESIGN.md 記錄了對應表；改值時三處一起改。
 */
export const BP_WIDE = 720; // 寬版：≥720 起有「清單＋內容欄」、頂部 bar
export const BP_DESKTOP = 1024; // 桌機：≥1024 起有側欄、右欄 stack、地圖欄
export const BP_SIDEBAR_AUTO_COLLAPSE = 1200; // <1200 側欄預設收合

export const MQ_WIDE = `(min-width: ${BP_WIDE}px)`;
export const MQ_DESKTOP = `(min-width: ${BP_DESKTOP}px)`;
export const MQ_BELOW_DESKTOP = `(max-width: ${BP_DESKTOP - 1}px)`;
export const MQ_BELOW_SIDEBAR_AUTO_COLLAPSE = `(max-width: ${BP_SIDEBAR_AUTO_COLLAPSE - 0.02}px)`;
