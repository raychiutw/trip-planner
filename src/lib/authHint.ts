/**
 * authHint — 上次已知登入狀態的同步快取。
 *
 * 為什麼需要：`/api/oauth/userinfo` 是非同步的，首次 paint 時無從得知使用者是否已登入。
 * LandingPage 因此曾經在 loading 期間直接 render 行銷頁，等 fetch 回來才轉址 ——
 * 已登入者每次進站都閃一次行銷頁（owner 2026-07-22 回報）。
 *
 * session cookie 是 httpOnly，JS 讀不到，所以只能自己記。這裡存的**不是憑證、
 * 也不是任何身分資料**，只有一個「上次看到的是登入狀態」的布林旗標，用來決定首次
 * paint 要畫什麼。真正的授權一律以 server 的 userinfo 回應為準；旗標猜錯的唯一後果
 * 是多一次 client 端轉址。
 *
 * 存 false 時直接移除 key，避免留下一個要小心解讀的 "false" 字串。
 * 所有存取都吞掉例外 —— Safari 無痕模式 / 使用者停用儲存空間時 localStorage 會 throw，
 * 那種情況退回「當作未登入」即可，不該讓整頁掛掉。
 */
export const AUTH_HINT_KEY = 'tripline:authed';

export function readAuthHint(): boolean {
  try {
    return localStorage.getItem(AUTH_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeAuthHint(authed: boolean): void {
  try {
    if (authed) localStorage.setItem(AUTH_HINT_KEY, '1');
    else localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // 儲存空間不可用 —— 退回每次都走非同步判斷，功能不變、只是會閃。
  }
}
