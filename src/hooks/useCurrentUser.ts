/**
 * useCurrentUser — V2-P1 fetch logged-in user from /api/oauth/userinfo
 *
 * Component 用此 hook 拿 current user 給 DesktopSidebar / TopBar 顯示 user chip。
 * 沒 session 時 user = null（401 → null）。Caller 必須保留 undefined loading
 * state，不要先當成未登入，避免 auth-dependent chrome flicker。
 *
 * 結果由 lib/currentUserCache 共享（在途與成功的 30 秒內，登出／重新登入／reload() 會清）：
 * 同一次載入裡先後 mount 的元件（頁面、側邊欄、頭像）不各打一次 userinfo（#1691）。
 * token 回應帶 id_token 且通過驗證時根本不打 userinfo（見 lib/auth/idToken）。
 *
 * 副作用：每次結果落定會寫一個「上次是否已登入」的布林旗標到 localStorage
 * （見 lib/authHint）。那不是 user 資料快取，是給「首次 paint 就得決定畫什麼」
 * 的頁面（目前只有 LandingPage）用的同步提示。本 hook 的 user 只用於顯示與
 * 頁面導向；授權一律由 api 驗 access token，不看這裡（id_token 路徑尤其如此）。共享 fetch 不會因為單一 consumer 卸載而被取消（見下方
 * dedup 說明），旗標依實際回應寫入；但若請求發出後已有更新的寫入（例如登出），
 * 這次就丟棄（見 lib/authHint 的序號）。
 *
 * 不依賴 React Query / SWR — keep dependency surface small。Vanilla useState/useEffect。
 *
 * 同一次 pageload 常有多個元件（sidebar / account chip / page 本身）各自 mount 這個 hook ——
 * 各打一次會變成 N+1（Sentry 7755796462：一次 pageload 5 個平行 GET /api/oauth/userinfo），
 * 也會讓晚一個 commit 才 mount 的側邊欄多打一次、並把依賴 user.id 的 my-trips 排在它後面。
 */
import { useEffect, useState } from 'react';
import { nextAuthHintSeq, writeAuthHint } from '../lib/authHint';
import { getNewApiAuth } from '../lib/auth';
import { fetchCurrentUserViaNewApi } from '../lib/auth/transport';
import { getCachedCurrentUser, setCachedCurrentUser } from '../lib/currentUserCache';

export interface CurrentUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  createdAt: string;
}

export interface UseCurrentUserResult {
  /** undefined = loading, null = unauthenticated, CurrentUser = logged in */
  user: CurrentUser | null | undefined;
  /** Re-fetch（after login / logout 用） */
  reload: () => void;
}

// 已知過時的 id_token：reload()（例如改完顯示名稱）之後，這顆 token 裡的資料落後於 userinfo，不能再當來源。
let staleIdToken: string | null = null;

function fetchCurrentUser(forceFresh = false): Promise<CurrentUser | null> {
  // 共享的在途／成功結果（見 lib/currentUserCache）：先後 mount 的元件不各打一次。
  const shared = forceFresh ? null : getCachedCurrentUser<CurrentUser | null>();
  if (shared) return shared;
  // 共享 fetch 不能被單一 consumer abort，改用序號擋掉「比登出等較新寫入還舊」的落地結果。
  const hintSeq = nextAuthHintSeq();
  const auth = getNewApiAuth();
  if (forceFresh) staleIdToken = auth.getIdToken();
  // 以新 api 的 token 還原登入；id_token 驗過就直接用，否則取 userinfo（沒有任何本機憑證回 401，不送請求）
  const promise: Promise<CurrentUser | null> = fetchCurrentUserViaNewApi(auth, staleIdToken)
    .then(async (res) => {
      if (!res.ok) {
        // 401 / 503 / etc. → 視為未登入
        writeAuthHint(false, hintSeq);
        return null;
      }
      const data = (await res.json()) as CurrentUser;
      // 記住結果供下次「首次 paint 就要決定畫什麼」的頁面用（見 lib/authHint）。
      writeAuthHint(true, hintSeq);
      return data;
    })
    .catch(() => {
      writeAuthHint(false, hintSeq);
      return null;
    });
  setCachedCurrentUser(promise);
  return promise;
}

export function useCurrentUser(): UseCurrentUserResult {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    // v2.33.39 round 4 起沿用的「新請求蓋掉舊請求」保護：改用 closure 變數而非
    // AbortController，因為共享 fetch 不該被單一 consumer 取消。
    // reloadCount > 0 代表這輪是 reload() 觸發，強制忽略任何剛好還在同一輪
    // microtask 內、屬於別的元件 mount 的 dedup 快取 —— 否則 reload 有極小機率
    // 撞上別人的 in-flight fetch，被誤判成「已經有一份了」而拿到舊資料，
    // 違反 reload() 的「強制拿新資料」承諾。
    let stale = false;
    fetchCurrentUser(reloadCount > 0).then((result) => {
      if (!stale) setUser(result);
    });
    return () => {
      stale = true;
    };
  }, [reloadCount]);

  return {
    user,
    reload: () => setReloadCount((n) => n + 1),
  };
}
