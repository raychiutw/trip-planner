/**
 * useCurrentUser 的共享結果：同一次載入裡先後 mount 的元件（頁面、側邊欄、頭像…）共用同一個請求與結果，
 * 不各打一次 userinfo（#1691：側邊欄晚一個 commit 才 mount，過去因此多打一次、且 my-trips 被排在它後面）。
 *
 * - 在途的與成功的結果共用 TTL_MS；未登入（null）不快取，登入後才不會讀到舊的 null。
 * - 登出、需要重新登入、reload() 都會清掉；測試用 reset 隔離案例。
 * - 只存在記憶體，不碰 localStorage（不快取使用者個資到持久儲存）。
 */
const TTL_MS = 30_000;

let entry: { promise: Promise<unknown>; at: number } | null = null;

export function getCachedCurrentUser<T>(): Promise<T> | null {
  return entry && Date.now() - entry.at < TTL_MS ? (entry.promise as Promise<T>) : null;
}

export function setCachedCurrentUser<T>(promise: Promise<T | null>): void {
  const mine = { promise, at: Date.now() };
  entry = mine;
  void promise.then((u) => { if (u === null && entry === mine) entry = null; }, () => { if (entry === mine) entry = null; });
}

export function resetCurrentUserCache(): void {
  entry = null;
}
