/**
 * useCurrentUser — V2-P1 fetch logged-in user from /api/oauth/userinfo
 *
 * Component 用此 hook 拿 current user 給 DesktopSidebar / TopBar 顯示 user chip。
 * 沒 session 時 user = null（401 → null）。Caller 必須保留 undefined loading
 * state，不要先當成未登入，避免 auth-dependent chrome flicker。
 *
 * 不快取 across navigation — useEffect fetch on mount。Future V2-P5 加 SWR-style
 * cache + revalidate（避免每頁 mount 都打 API）。
 *
 * 副作用：每次結果落定會寫一個「上次是否已登入」的布林旗標到 localStorage
 * （見 lib/authHint）。那不是 user 資料快取，是給「首次 paint 就得決定畫什麼」
 * 的頁面（目前只有 LandingPage）用的同步提示；授權判斷一律仍以本 hook 的
 * userinfo 回應為準。共享 fetch 不會因為單一 consumer 卸載而被取消（見下方
 * dedup 說明），旗標依實際回應寫入；但若請求發出後已有更新的寫入（例如登出），
 * 這次就丟棄（見 lib/authHint 的序號）。
 *
 * 不依賴 React Query / SWR — keep dependency surface small。Vanilla useState/useEffect。
 *
 * 同一次 pageload 常有多個元件（sidebar / account chip / page 本身）在同一個
 * commit 裡各自 mount 這個 hook —— 若各自各打一次 fetch 會變成 N+1（Sentry
 * 7755796462, 2026-09-26, /trip/*\/stop/* 一次 pageload 5 個平行 GET
 * /api/oauth/userinfo，request_start 完全同時）。用一個只存活一個 microtask 的
 * 共享 in-flight promise，把同一輪 effect flush 裡的請求合併成一次；下一輪
 * microtask 就自動清空，不會變成長效跨頁面快取（維持「不快取 across
 * navigation」的既有語意），也不會被「fetch 永不 resolve」的 loading-state 測試
 * 卡死。
 *
 * ponytail: 只合併「同一個 commit」的 mount。之後才載入的 lazy route chunk（例如
 * /stop/:id/copy 的 EntryActionPage）落在下一個 commit，會各自再打一次（dev 冷載入
 * 實測 copy 19→2、map 25→3）。要改成「請求 settle 前都共用」，得先處理 logout 後
 * 新 mount 拿到登出前 in-flight 請求舊身分的問題。
 */
import { useEffect, useState } from 'react';
import { nextAuthHintSeq, writeAuthHint } from '../lib/authHint';

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

const USERINFO_ENDPOINT = '/api/oauth/userinfo';

// Module-level：同一個 effect flush 裡的多個 hook instance 共享同一個 in-flight
// fetch，下一輪 microtask 就清空（見檔頭註解）。
let sharedFetchPromise: Promise<CurrentUser | null> | null = null;

function fetchCurrentUser(forceFresh = false): Promise<CurrentUser | null> {
  if (!sharedFetchPromise || forceFresh) {
    // 共享 fetch 不能被單一 consumer abort，改用序號擋掉「比登出等較新寫入還舊」的落地結果。
    const hintSeq = nextAuthHintSeq();
    const promise: Promise<CurrentUser | null> = fetch(USERINFO_ENDPOINT, { credentials: 'include' })
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
    sharedFetchPromise = promise;
    queueMicrotask(() => {
      if (sharedFetchPromise === promise) sharedFetchPromise = null;
    });
  }
  return sharedFetchPromise;
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
