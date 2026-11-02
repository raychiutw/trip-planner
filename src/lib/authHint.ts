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
 * 寫入帶序號：比已套用的寫入還舊的會被靜默丟棄（見下方 issuedSeq / appliedSeq）。
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

// 序號越大代表資訊越新。useCurrentUser 在發 request 時先取號、落地時帶號寫入；
// 直接呼叫（例如登出）自動拿最新號。這樣登出前發出、登出後才落地的 userinfo
// 回應不會把登出寫的 false 蓋回 true。每個序號只用於一次寫入。
// ponytail: 序號只在同一個分頁內有序；別的分頁的寫入這裡不知道，跨分頁仍可能互蓋
// （後果同樣只是多一次轉址，與改版前相同）。要跨分頁一致得改用 storage event。
let issuedSeq = 0;
let appliedSeq = 0;

export function nextAuthHintSeq(): number {
  return ++issuedSeq;
}

export function writeAuthHint(authed: boolean, seq = nextAuthHintSeq()): void {
  if (seq < appliedSeq) return;
  appliedSeq = seq;
  try {
    if (authed) localStorage.setItem(AUTH_HINT_KEY, '1');
    else localStorage.removeItem(AUTH_HINT_KEY);
  } catch {
    // 儲存空間不可用 —— 退回每次都走非同步判斷，功能不變、只是會閃。
  }
}
