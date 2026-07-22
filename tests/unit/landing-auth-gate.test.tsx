/**
 * owner 2026-07-22 #6：「首頁要先判斷有登入做轉址再渲染頁面，才不會看到首頁內容又轉走」。
 *
 * 舊行為的 bug：LandingPage 寫 `if (user) return <Navigate to="/trips" />`，而
 * useCurrentUser 的初始值是 `undefined`（loading）。**undefined 是 falsy**，所以
 * loading 期間直接落到 return 完整行銷頁 —— 等 userinfo fetch 回來才跳走，已登入者
 * 每次進站都閃一次行銷頁。（原本那行上面的註解寫著「undefined = 還在載入，先不動
 * （避免閃一下行銷頁再跳走）」，描述的意圖跟程式碼行為正好相反。）
 *
 * 修法（owner 2026-07-22 拍板「已登入就不渲染首頁，直接進行程」）：
 * userinfo 是非同步的，首次 paint 無法同步得知登入狀態 → 用 localStorage 記住上次
 * 的結果做樂觀判斷：
 *   - 上次已登入 → 首次 paint 就 Navigate，完全不 render 行銷頁
 *   - 上次未登入 / 沒紀錄 → 直接 render 行銷頁（訪客也不必先看一片空白）
 *   - fetch 回來後校正 flag，下次就正確
 * 只有「登出後第一次進」或「換裝置」會有一次不一致，這是這個取捨已知的代價。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import LandingPage from '../../src/pages/LandingPage';
import { useCurrentUser } from '../../src/hooks/useCurrentUser';
import { AUTH_HINT_KEY, readAuthHint, writeAuthHint } from '../../src/lib/authHint';

/**
 * /trips 的替身必須跟真的一樣呼叫 useCurrentUser —— 真實的 TripsListPage 走
 * useRequireAuth()，而那個 hook 內部就是 useCurrentUser。這件事對「樂觀判斷猜錯」
 * 的案例是關鍵：LandingPage 一旦轉址就 unmount，它自己的 userinfo 請求會被
 * AbortController 取消，永遠等不到回應 —— hint 的校正**必然**發生在目標頁那端。
 * 替身若只是一個靜態 div，測到的就不是產品真正的行為。
 */
function TripsStub() {
  useCurrentUser();
  return <div data-testid="trips-page">行程列表</div>;
}

function renderLanding() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/trips" element={<TripsStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('authHint — 登入狀態的同步快取', () => {
  beforeEach(() => localStorage.clear());

  it('沒有紀錄時回 false（訪客預設看得到首頁）', () => {
    expect(readAuthHint()).toBe(false);
  });

  it('寫入 true 後讀得回來', () => {
    writeAuthHint(true);
    expect(readAuthHint()).toBe(true);
  });

  it('寫入 false 會清掉紀錄，而不是留一個 "false" 字串', () => {
    writeAuthHint(true);
    writeAuthHint(false);
    expect(readAuthHint()).toBe(false);
    expect(localStorage.getItem(AUTH_HINT_KEY)).toBeNull();
  });

  it('localStorage 不可用時不丟例外（Safari 無痕 / 停用 cookie）', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied');
    });
    expect(() => readAuthHint()).not.toThrow();
    expect(readAuthHint()).toBe(false);
    spy.mockRestore();
  });
});

describe('登出必須清掉 hint（/cso --diff 抓到）', () => {
  /*
   * 不清的話：登出 → hint 仍是 '1' → 進 `/` 被轉去 /trips → useRequireAuth 收到
   * 401 再彈回 /login。使用者想看行銷頁，卻直接被丟到登入頁。
   * 旗標會在那次 401 被 useCurrentUser 自我校正（所以是一次性、不是永久壞掉），
   * 但沒必要讓使用者先撞一次。兩個登出點都要清，漏一個就等於沒修。
   */
  const ACCOUNT_PAGE = readFileSync(join(__dirname, '../../src/pages/AccountPage.tsx'), 'utf8');
  const SESSIONS_PAGE = readFileSync(join(__dirname, '../../src/pages/SessionsPage.tsx'), 'utf8');

  it('AccountPage 的登出有清 hint', () => {
    expect(ACCOUNT_PAGE).toMatch(/writeAuthHint\(false\)/);
  });

  it('SessionsPage 的登出有清 hint', () => {
    expect(SESSIONS_PAGE).toMatch(/writeAuthHint\(false\)/);
  });

  it('兩處都真的 import 了（註解提到不算）', () => {
    for (const src of [ACCOUNT_PAGE, SESSIONS_PAGE]) {
      expect(src).toMatch(/^import \{ writeAuthHint \} from '\.\.\/lib\/authHint';$/m);
    }
  });
});

describe('LandingPage — 已登入者不渲染行銷頁', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('上次已登入 → 首次 paint 直接轉址，行銷頁一次都不出現', () => {
    writeAuthHint(true);
    renderLanding();
    expect(screen.queryByTestId('landing-page')).toBeNull();
    expect(screen.getByTestId('trips-page')).toBeTruthy();
  });

  it('沒有紀錄（訪客）→ 直接 render 行銷頁，不先閃一片空白', () => {
    renderLanding();
    expect(screen.getByTestId('landing-page')).toBeTruthy();
  });

  it('樂觀判斷猜錯（hint 說已登入、實際 401）→ fetch 回來後回到行銷頁並清掉 hint', async () => {
    writeAuthHint(true);
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, status: 401 } as Response)));
    renderLanding();
    // 首次 paint 仍照 hint 轉址（這就是樂觀的意思）
    expect(screen.getByTestId('trips-page')).toBeTruthy();
    // 校正由目標頁的 auth guard 完成（LandingPage 此時已 unmount）。
    await waitFor(() => expect(readAuthHint()).toBe(false));
  });

  it('訪客登入成功後 hint 被寫入，下次進站就不會再看到行銷頁', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ id: 'u1', email: 'a@b.c', emailVerified: true, displayName: null, avatarUrl: null, createdAt: '2026-01-01' }),
    } as Response)));
    renderLanding();
    await waitFor(() => expect(readAuthHint()).toBe(true));
  });
});
