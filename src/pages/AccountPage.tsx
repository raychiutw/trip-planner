/**
 * AccountPage — Section 2 (terracotta-account-hub-page) unified 帳號 hub
 *
 * Route: /account
 * 對應 mockup section 19 (line 7425-7583)。Profile hero + 3 group settings
 * rows，整合既有分散的 /settings/* page 為 entry hub。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { apiFetch, apiFetchRaw } from '../lib/apiClient';
import { ApiError } from '../lib/errors';
import { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import ConfirmModal from '../components/shared/ConfirmModal';
import { writeAuthHint } from '../lib/authHint';

/** GET /api/account 的刪除影響預覽。 */
interface DeleteAccountPreview {
  /** 有 local 密碼身分 → 用密碼確認；純 OAuth → 用確認字串 */
  hasPassword: boolean;
  tripsOwned: number;
  collaboratorsAffected: number;
}

interface AccountStats {
  tripCount: number;
  totalDays: number;
  collaboratorCount: number;
}

const SCOPED_STYLES = `
.tp-account-shell {
  min-height: 100%;
  background: var(--color-secondary);
  overflow-y: auto;
}
/* 版本頁尾 —— 低調、不搶眼，但要選得起來（客服會請使用者念這串）。
   font-variant-numeric: tabular-nums 讓版本號等寬，念的時候不會看錯位。
   user-select 保持可選（預設），不要設 none。 */
/* 刪除帳號確認欄位（ConfirmModal 的 children slot）。 */
.tp-account-delete-confirm { display: flex; flex-direction: column; gap: 8px; text-align: left; }
.tp-account-delete-label {
  font-size: var(--font-size-footnote);
  font-weight: 600;
  color: var(--color-foreground);
}
.tp-account-delete-error {
  margin: 0;
  font-size: var(--font-size-footnote);
  color: var(--color-destructive);
}

.tp-account-version {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 8px 0 4px;
  font-size: var(--font-size-caption);
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.tp-account-version-sep { opacity: .5; }
.tp-account-version-commit { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.tp-account-inner {
  max-width: 720px; margin: 0 auto;
  /* audit pass2：帳號頁自成 scroll 容器（.tp-account-shell overflow-y:auto），AppShell
   * main 的 nav padding 不套到此內層 → 手機/平板最後一列會被底部浮動膠囊蓋住。自留膠囊
   * 高度的底部 clearance（桌機無膠囊、@1024 收回 80px）。 */
  padding: 24px 16px calc(var(--nav-height-mobile, 88px) + 24px);
  display: flex; flex-direction: column; gap: 24px;
}
@media (min-width: 768px) {
  .tp-account-inner { padding-top: 40px; padding-left: 24px; padding-right: 24px; gap: 32px; }
}
/* §10.4（owner 2026-07-19）：桌機用滿橫向空間 — inner 加寬、設定分區走 2-col grid，
 * hero 收窄置中（profile 卡不隨寬度攤開變空）。手機仍單欄堆疊。 */
.tp-account-groups { display: flex; flex-direction: column; gap: 24px; }
@media (min-width: 1024px) {
  .tp-account-inner { max-width: 1040px; padding-bottom: 80px; }
  .tp-account-hero { max-width: 560px; width: 100%; margin-inline: auto; }
  .tp-account-groups {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    align-items: start;
  }
}

/* Profile hero (mockup line 7437-7448) */
.tp-account-hero {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 24px;
  display: flex; flex-direction: column; align-items: center; gap: 16px;
  text-align: center;
}
.tp-account-hero-avatar {
  width: 64px; height: 64px; border-radius: 50%;
  background: var(--color-accent-fill);
  color: var(--color-accent-foreground);
  display: grid; place-items: center;
  font-size: var(--font-size-title); font-weight: 800;
}
.tp-account-hero-name {
  font-size: var(--font-size-title2); font-weight: 800;
  color: var(--color-foreground);
  margin: 0;
  cursor: text;
}
.tp-account-hero-name:hover {
  color: var(--color-accent);
}
/* v2.33.122: name + edit pencil icon flex row (置中對齊 avatar 軸) */
.tp-account-hero-name-row {
  display: flex; align-items: center; gap: 8px;
  justify-content: center;
}
.tp-account-hero-name-edit {
  display: grid; place-items: center;
  width: 32px; height: 32px;
  background: transparent; border: none;
  border-radius: var(--radius-md);
  color: var(--color-muted);
  cursor: pointer;
  transition: background-color 150ms, color 150ms;
}
.tp-account-hero-name-edit:hover {
  background: var(--color-hover);
  color: var(--color-accent-text);
}
.tp-account-hero-name-edit:focus-visible {
  outline: none; box-shadow: var(--shadow-ring);
}
.tp-account-hero-name-edit .svg-icon { width: 16px; height: 16px; }
.tp-account-hero-email {
  font-size: var(--font-size-callout);
  color: var(--color-muted);
}

/* v2.33.142: inline edit input — 取代 v2.33.122 modal。Blur auto-save。
   字體 size/weight 對齊 .tp-account-hero-name 避免 width jump。 */
.tp-account-hero-name-input {
  font: inherit;
  font-size: var(--font-size-title2);
  font-weight: 800;
  color: var(--color-foreground);
  background: var(--color-secondary);
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  padding: 2px 10px;
  text-align: center;
  width: 240px;
  max-width: 100%;
  box-sizing: border-box;
}
.tp-account-hero-name-input:focus-visible {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: var(--shadow-ring);
}
.tp-account-hero-name-input:disabled {
  opacity: 0.6;
}
.tp-account-hero-stats {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 12px; width: 100%;
  padding-top: 16px;
  border-top: 1px solid var(--color-border);
}
.tp-account-hero-stat { text-align: center; }
.tp-account-hero-stat-value {
  font-size: var(--font-size-title3); font-weight: 800;
  color: var(--color-foreground);
  font-variant-numeric: tabular-nums;
  display: block;
}
.tp-account-hero-stat-label {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
  margin-top: 2px;
  display: block;
}

/* Settings group + rows (mockup line 7450-7515) */
.tp-account-group { display: flex; flex-direction: column; gap: 8px; }
.tp-account-group-label {
  font-size: var(--font-size-eyebrow); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--color-muted);
  padding: 0 4px;
}
.tp-account-rows {
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.tp-account-row {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 16px;
  border: none;
  background: transparent;
  width: 100%; text-align: left;
  font: inherit;
  cursor: pointer;
  color: var(--color-foreground);
  text-decoration: none;
  border-bottom: 1px solid var(--color-border);
  min-height: var(--spacing-tap-min);
  transition: background 120ms;
}
.tp-account-row:last-child { border-bottom: none; }
.tp-account-row:hover { background: var(--color-hover); }
.tp-account-row-icon {
  width: 36px; height: 36px; border-radius: var(--radius-md);
  background: var(--color-accent-subtle);
  color: var(--color-accent);
  display: grid; place-items: center;
  flex-shrink: 0;
}
/* v2.54.10 依設定分區三色（mockup V1）：row icon chip 底用該分區的 --tone-bg、glyph 用
   --color-foreground（~11–12:1，light/dark 皆安全；不用 vivid sage/粉 當 glyph/底色 —
   太淺對比不足）。:not(.is-danger) 讓登出 row 的紅 icon（下方 .is-danger 覆寫）不被蓋。 */
.tp-account-rows[data-tone="accent"] { --t-bg: var(--color-accent-bg); }
.tp-account-rows[data-tone="sage"]   { --t-bg: var(--color-accent-2-bg); }
.tp-account-rows[data-tone="pink"]   { --t-bg: var(--color-accent-3-bg); }
.tp-account-rows[data-tone] .tp-account-row:not(.is-danger) .tp-account-row-icon {
  background: var(--t-bg);
  color: var(--color-foreground);
}
.tp-account-row-icon .svg-icon { width: 18px; height: 18px; }
.tp-account-row-body {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}
.tp-account-row-title {
  font-size: var(--font-size-callout); font-weight: 600;
  color: var(--color-foreground);
}
.tp-account-row-helper {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}
.tp-account-row-chevron {
  color: var(--color-muted);
  flex-shrink: 0;
}
.tp-account-row-chevron .svg-icon { width: 14px; height: 14px; }

/* destructive variant — title + helper 都覆寫成紅字（不能只設 row color，
 * .tp-account-row-title/.tp-account-row-helper 有 explicit color 不繼承）。 */
.tp-account-row.is-danger { color: var(--color-priority-high-dot); }
.tp-account-row.is-danger .tp-account-row-title { color: var(--color-priority-high-dot); }
.tp-account-row.is-danger .tp-account-row-helper { color: var(--color-priority-high-dot); opacity: 0.78; }
.tp-account-row.is-danger .tp-account-row-icon {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-dot);
}
.tp-account-row.is-danger:hover { background: var(--color-priority-high-bg); }

.tp-logout-stats-error {
  font-size: var(--font-size-caption2);
  color: var(--color-muted);
}
`;

interface SettingsRow {
  key: string;
  icon: string;
  title: string;
  helper: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

export default function AccountPage() {
  const auth = useRequireAuth();
  const { user, reload: reloadUser } = useCurrentUser();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── 刪除帳號（Google Play 強制要求的帳號刪除路徑）──────────────────
   * owner 決策（2026-07-20）：擁有的行程**一併刪除，含共編者的**。
   * 所以確認畫面一定要先讓使用者看到「會刪掉幾個行程、影響幾位共編者」——
   * 那兩個數字前端算不出來，由 GET /api/account 提供。 */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePreview, setDeletePreview] = useState<DeleteAccountPreview | null>(null);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // v2.33.142: inline edit display_name — 取代 v2.33.122 modal。
  // pencil 或 name click → 變 input → blur 自動 save → 成功 silent / 失敗 toast。
  // ESC 取消還原。Enter blur (trigger save)。
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // 進入編輯前的快照 — ESC 還原 / 比對是否真的有改 (無改省 API call)
  const draftBaselineRef = useRef('');

  const startEditName = useCallback(() => {
    const current = user?.displayName ?? '';
    setDraftName(current);
    draftBaselineRef.current = current;
    setEditingName(true);
    // next tick focus + select
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, [user?.displayName]);

  const cancelEditName = useCallback(() => {
    setDraftName(draftBaselineRef.current);
    setEditingName(false);
  }, []);

  const commitEditName = useCallback(async (): Promise<void> => {
    const trimmed = draftName.trim();
    // 無改 → 不打 API，直接退出 editing
    if (trimmed === draftBaselineRef.current.trim()) {
      setEditingName(false);
      return;
    }
    setSavingName(true);
    try {
      await apiFetch('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName: trimmed.length === 0 ? null : trimmed }),
        headers: { 'content-type': 'application/json' },
      });
      reloadUser();
      setEditingName(false);
      // v2.33.142: 成功 silent (user feedback 「右上角不用顯示狀態」一脈相承)。
      // 失敗才走 toast。
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '更新失敗';
      showToast(msg, 'error');
      // 失敗保留 editing=true 讓 user retry
    } finally {
      setSavingName(false);
    }
  }, [draftName, reloadUser]);

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    apiFetch<AccountStats>('/account/stats')
      .then((data) => { if (!cancelled) setStats(data); })
      // v2.33.47 round 7b: 不直接 surface raw error.message (可能 leak backend
      // detail / SQL fragment)。改 ApiError 與 network error 分開 generic 文案。
      .catch((e) => {
        if (cancelled) return;
        setStatsError(e instanceof ApiError ? '統計資料載入失敗' : '網路錯誤，請稍後再試');
      });
    return () => { cancelled = true; };
  }, [auth.user]);

  /** 開啟刪除確認前先抓預覽 —— 沒有數字就不該讓使用者按下不可逆的按鈕。 */
  const openDeleteModal = useCallback(async () => {
    setDeleteError(null);
    setDeleteInput('');
    setDeletePreview(null);
    setShowDeleteModal(true);
    try {
      setDeletePreview(await apiFetch<DeleteAccountPreview>('/account'));
    } catch {
      setDeleteError('無法取得刪除影響範圍，請稍後再試');
    }
  }, []);

  /** 二次確認是否已滿足：有密碼要打密碼，純 OAuth 要打 DELETE。 */
  const canConfirmDelete = deletePreview
    ? (deletePreview.hasPassword ? deleteInput.length > 0 : deleteInput === 'DELETE')
    : false;

  const deleteAccount = useCallback(async () => {
    if (!deletePreview || !canConfirmDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetchRaw('/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          deletePreview.hasPassword ? { password: deleteInput } : { confirm: deleteInput },
        ),
      });
      // 帳號已不存在，不能留在帳號頁。用整頁導向而非 SPA navigate —— 要把
      // 記憶體中的 auth context / 快取一併清掉。
      window.location.href = '/';
    } catch (err) {
      setDeleting(false);
      setDeleteError(
        err instanceof ApiError && err.code === 'ACCOUNT_DELETE_PASSWORD_INVALID'
          ? '密碼不正確，帳號未刪除'
          : '刪除失敗，請稍後再試',
      );
    }
  }, [deletePreview, canConfirmDelete, deleteInput]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await apiFetchRaw('/oauth/logout', { method: 'POST' });
      // 清掉「上次已登入」旗標（見 lib/authHint）。不清的話，登出後第一次進 `/`
      // 會被 LandingPage 依舊旗標轉去 /trips，再被 useRequireAuth 踢回 /login ——
      // 使用者想看行銷頁卻直接彈到登入頁。旗標會在那次 401 時自我校正，但沒必要
      // 讓使用者先撞一次。
      writeAuthHint(false);
      // v2.33.47 round 7b: navigate 前先關 modal — success 路徑也要關 (避免在
      // /login 看到 stale modal 殘影 if route transition 慢)。
      setShowLogoutModal(false);
      navigate('/login', { replace: true });
    } catch {
      // v2.33.47 round 7b: 失敗路徑也關 modal + 顯 toast (之前 modal 卡死)。
      setLoggingOut(false);
      setShowLogoutModal(false);
      showToast('登出失敗，請稍後再試', 'error');
    }
  }, [navigate]);

  if (!auth.user || !user) return null;

  // v2.17.17:initial 用 displayName 對齊 sidebar(原本用 email.charAt 造成
  // displayName "Ray" + email "lean.lean@..." 時 hero 顯示「L」 但 sidebar 顯示「R」)。
  const displayName = user.displayName || user.email.split('@')[0] || user.email;
  const initial = displayName.charAt(0).toUpperCase();

  // v2.54.10「依設定分區三色」(mockup V1)：每組設定一色，由 group.tone 驅動 row icon chip。
  // 語意延伸：應用程式=accent 柔褐（你的偏好）、共編&整合=sage、帳號=pink（user 拍板，
  // 與初版 mockup 的 sage↔pink 對調）。登出維持紅（.is-danger 覆寫，不混三色）。
  const groups: { key: string; label: string; tone: 'accent' | 'sage' | 'pink'; rows: SettingsRow[] }[] = [
    {
      key: 'application',
      label: '應用程式',
      tone: 'accent',
      rows: [
        { key: 'appearance', icon: 'palette', title: '外觀設定', helper: '主題色、深淺模式', to: '/account/appearance' },
        { key: 'notifications', icon: 'lightbulb', title: '通知設定', helper: '行程更新、旅伴邀請', to: '/account/notifications' },
      ],
    },
    {
      key: 'collab',
      label: '共編 & 整合',
      tone: 'sage',
      rows: [
        { key: 'connected-apps', icon: 'device', title: '已連結的應用程式', helper: '管理透過 Tripline 登入的應用程式', to: '/settings/connected-apps' },
        { key: 'developer', icon: 'code', title: '開發者選項', helper: 'OAuth 應用程式註冊', to: '/developer/apps' },
      ],
    },
    {
      key: 'account',
      label: '帳號',
      tone: 'pink',
      rows: [
        { key: 'sessions', icon: 'group', title: '已登入裝置', helper: '管理所有登入中的裝置', to: '/settings/sessions' },
        // Google Play 要求 app 內可直接取得隱私權政策，不能只放在網站頁尾。
        { key: 'privacy', icon: 'document', title: '隱私權政策', helper: '我們收集什麼資料、如何使用', to: '/privacy' },
        { key: 'logout', icon: 'x-mark', title: '登出', helper: '清除目前裝置的登入狀態', onClick: () => setShowLogoutModal(true), danger: true },
        { key: 'delete-account', icon: 'trash', title: '刪除帳號', helper: '永久刪除帳號與所有行程，無法復原', onClick: openDeleteModal, danger: true },
      ],
    },
  ];

  const sidebar = <DesktopSidebarConnected />;
  const main = (
    <div className="tp-account-shell" data-testid="account-page">
      <TitleBar title="帳號" />
      <div className="tp-account-inner">
        <section className="tp-account-hero" data-testid="account-hero">
          <div className="tp-account-hero-avatar" aria-hidden="true">{initial}</div>
          <div>
            <div className="tp-account-hero-name-row">
              {editingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  className="tp-account-hero-name-input"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => void commitEditName()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      (e.target as HTMLInputElement).blur();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      cancelEditName();
                    }
                  }}
                  maxLength={50}
                  placeholder={user.email.split('@')[0]}
                  disabled={savingName}
                  aria-label="編輯名稱"
                  data-testid="account-edit-name-input"
                />
              ) : (
                <>
                  <h2
                    className="tp-account-hero-name"
                    onClick={startEditName}
                    title="點擊編輯"
                  >
                    {displayName}
                  </h2>
                  <button
                    type="button"
                    className="tp-account-hero-name-edit"
                    onClick={startEditName}
                    aria-label="編輯名稱"
                    title="編輯名稱"
                    data-testid="account-edit-name-btn"
                  >
                    <Icon name="pencil" />
                  </button>
                </>
              )}
            </div>
            <div className="tp-account-hero-email">{user.email}</div>
          </div>
          <div className="tp-account-hero-stats">
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.tripCount ?? '—'}</span>
              <span className="tp-account-hero-stat-label">個行程</span>
            </div>
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.totalDays ?? '—'}</span>
              <span className="tp-account-hero-stat-label">天旅程</span>
            </div>
            <div className="tp-account-hero-stat">
              <span className="tp-account-hero-stat-value">{stats?.collaboratorCount ?? '—'}</span>
              <span className="tp-account-hero-stat-label">位旅伴</span>
            </div>
          </div>
          {statsError && (
            <div className="tp-logout-stats-error" role="status">數據載入失敗：{statsError}</div>
          )}
        </section>

        <div className="tp-account-groups">
        {groups.map((group) => (
          <section key={group.key} className="tp-account-group">
            <div className="tp-account-group-label" data-testid={`account-group-label-${group.key}`}>{group.label}</div>
            <div className="tp-account-rows" data-tone={group.tone} data-testid={`account-rows-${group.key}`}>
              {group.rows.map((row) => {
                const className = `tp-account-row${row.danger ? ' is-danger' : ''}`;
                const inner = (
                  <>
                    <div className="tp-account-row-icon" aria-hidden="true"><Icon name={row.icon} /></div>
                    <div className="tp-account-row-body">
                      <div className="tp-account-row-title">{row.title}</div>
                      <div className="tp-account-row-helper">{row.helper}</div>
                    </div>
                    <span className="tp-account-row-chevron" aria-hidden="true"><Icon name="chevron-right" /></span>
                  </>
                );
                if (row.to) {
                  return (
                    <Link key={row.key} to={row.to} className={className} data-testid={`account-row-${row.key}`}>
                      {inner}
                    </Link>
                  );
                }
                return (
                  <button key={row.key} type="button" className={className} onClick={row.onClick} data-testid={`account-row-${row.key}`}>
                    {inner}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        </div>

        {/* 版本頁尾 —— 使用者回報問題時第一個要問的就是「你用哪一版」。
            值由 vite define 注入，與 Sentry release tag 同源（vite.config.ts），
            兩套各自算的話 Sentry 上會對不到使用者報的版本。
            放在 .tp-account-inner 內 → 跟著頁面捲動，不是 fixed 浮層。 */}
        <div className="tp-account-version" data-testid="app-version">
          <span>Tripline v{__APP_VERSION__}</span>
          <span className="tp-account-version-sep" aria-hidden="true">·</span>
          <span className="tp-account-version-commit">{__APP_COMMIT__}</span>
        </div>
      </div>

      <ConfirmModal
        open={showLogoutModal}
        title="確認登出？"
        message="此裝置會被登出，需要重新輸入 email 跟密碼才能再進來。"
        confirmLabel="確認登出"
        cancelLabel="取消"
        busy={loggingOut}
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* 刪除帳號 —— Google Play 強制要求的路徑。
          確認畫面必須誠實顯示影響範圍：owner 決策是「行程一併刪除，含共編者的」，
          使用者按下去之前一定要看到會波及幾位共編者。 */}
      <ConfirmModal
        open={showDeleteModal}
        title="永久刪除帳號？"
        message={
          deletePreview
            ? `這個動作無法復原。你的 ${deletePreview.tripsOwned} 個行程會一併刪除。`
            : '正在確認刪除影響範圍⋯'
        }
        warning={
          deletePreview && deletePreview.collaboratorsAffected > 0
            ? `其中有共編者的行程也會刪除，${deletePreview.collaboratorsAffected} 位共編者將失去存取權，且不會另行通知。`
            : undefined
        }
        confirmLabel="永久刪除"
        cancelLabel="取消"
        busy={deleting || !canConfirmDelete}
        onConfirm={deleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      >
        {deletePreview && (
          <div className="tp-account-delete-confirm">
            <label className="tp-account-delete-label" htmlFor="tp-delete-confirm-input">
              {deletePreview.hasPassword
                ? '請輸入密碼以確認'
                : '請輸入 DELETE 以確認'}
            </label>
            <input
              id="tp-delete-confirm-input"
              className="tp-input"
              data-testid="delete-account-confirm-input"
              type={deletePreview.hasPassword ? 'password' : 'text'}
              autoComplete={deletePreview.hasPassword ? 'current-password' : 'off'}
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              disabled={deleting}
            />
            {deleteError && (
              <p className="tp-account-delete-error" role="alert">{deleteError}</p>
            )}
          </div>
        )}
        {!deletePreview && deleteError && (
          <p className="tp-account-delete-error" role="alert">{deleteError}</p>
        )}
      </ConfirmModal>

      {/* v2.33.142: 編輯名稱 modal 拔除 — 改 inline edit (hero name input)。 */}
    </div>
  );

  return (
    <>
      <style>{SCOPED_STYLES}</style>
      <AppShell sidebar={sidebar} main={main} bottomNav={<GlobalBottomNav authed={auth.user !== null} />} />
    </>
  );
}
