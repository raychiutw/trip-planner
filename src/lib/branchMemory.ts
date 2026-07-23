/**
 * branchMemory — 記住每個 primary branch（聊天/行程/地圖/收藏）最後停留的完整 location。
 *
 * W1「每-branch Navigation Stack」（spec §1「切 tab 返回續原工作」）的 web 輕量實作：
 * **不做 keep-alive**（4 個根頁常駐、尤其地圖 Google Maps 常駐會有 perf/成本問題），改記
 * URL 位置 —— 切回某 tab 時 navigate 到它記住的完整位置（含 `?selected` 行程 / `?day` /
 * 篩選 / hash）。in-component 的短暫狀態不保（那才需 keep-alive）；scroll 由既有
 * scroll-restore 處理。
 *
 * 純 module 狀態（無 React）：app-root 的 tracker 在每次 location 變更時寫入，nav 元件
 * 點擊時讀取。單使用者 SPA，logout 不清也無妨（下次登入位置被覆寫）。
 */
const lastLocationByBranch = new Map<string, string>();

/** 記住某 branch 目前的完整 location（`pathname + search + hash`）。 */
export function rememberBranchLocation(branchKey: string, fullLocation: string): void {
  lastLocationByBranch.set(branchKey, fullLocation);
}

/** 取某 branch 記住的完整 location；無記錄回 `null`（呼叫端 fallback 到該 tab 的 href）。 */
export function getRememberedBranchLocation(branchKey: string): string | null {
  return lastLocationByBranch.get(branchKey) ?? null;
}
