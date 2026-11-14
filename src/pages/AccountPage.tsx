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
import { useAccountPreview } from '../hooks/useAccountPreview';
import { useCurrentUser, type CurrentUser } from '../hooks/useCurrentUser';
import { typedApi, unwrap } from '../lib/api/typed';
import { logoutSession } from '../lib/logout';
import { ApiError } from '../lib/errors';
import { REQUEST_TIMEOUT_MS } from '../lib/requestTimeout';
import ToastContainer, { showToast } from '../components/shared/Toast';
import AppShell from '../components/shell/AppShell';
import DesktopSidebarConnected from '../components/shell/DesktopSidebarConnected';
import GlobalBottomNav from '../components/shell/GlobalBottomNav';
import TitleBar from '../components/shell/TitleBar';
import Icon from '../components/shared/Icon';
import ConfirmModal from '../components/shared/ConfirmModal';
import AiDataConsentSettings from '../components/AiDataConsentSettings';
import { writeAuthHint } from '../lib/authHint';

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
.tp-account-groups { display: flex; flex-direction: column; gap: 24px; }

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
  position: relative;
  display: grid; place-items: center;
  width: var(--spacing-tap-min); height: var(--spacing-tap-min);
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
.tp-account-hero-name-edit:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
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
  border-color: var(--color-accent);
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--color-background);
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
.tp-account-row-static:hover { background: transparent; }
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
/* W15 a11y：原 opacity:0.78 把 #C13515 混成 #cf6146 → 在 #FFFBF5 上僅 3.73:1（<4.5，
 * axe serious）。移除 opacity → 全 #C13515 ≈ 5.3:1 達標；視覺層級靠字級（caption2 較小）
 * 與 title 較粗維持，不再靠調淡。 */
.tp-account-row.is-danger .tp-account-row-helper { color: var(--color-priority-high-dot); }
.tp-account-row.is-danger .tp-account-row-icon {
  background: var(--color-priority-high-bg);
  color: var(--color-priority-high-dot);
}
.tp-account-row.is-danger:hover { background: var(--color-priority-high-bg); }

.tp-account-skeleton {
  display: inline-block; width: 2.2ch; height: 18px; vertical-align: middle;
  border-radius: var(--radius-full);
  background: linear-gradient(90deg, var(--color-tertiary), var(--color-hover), var(--color-tertiary));
  background-size: 200% 100%;
  animation: tp-account-shimmer 1.2s linear infinite;
}
@keyframes tp-account-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .tp-account-skeleton { animation: none; } }
.tp-account-stats-error {
  grid-column: 1 / -1;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  font-size: var(--font-size-caption);
  background: var(--color-warning-bg);
  border-radius: var(--radius-md);
  padding: 4px 8px;
  color: var(--color-foreground);
}
.tp-account-stats-error .svg-icon { width: 16px; height: 16px; color: var(--color-warning-deep); flex-shrink: 0; }
.tp-account-stats-error button {
  border: 0; background: transparent; cursor: pointer;
  text-decoration: underline; font-weight: 600;
  color: var(--color-accent-text); font-size: var(--font-size-caption);
  min-height: 24px; padding: 0 4px;
}
.tp-account-stats-error button:focus-visible { outline: 2px solid var(--color-focus-ring); outline-offset: 2px; box-shadow: 0 0 0 2px var(--color-background); }
/* 桌機版面 A（owner 2026-11-13，取代 2026-07-19 的「hero 收窄置中、設定兩欄」）：單欄，
 * 個人卡橫式與設定格同一個容器寬度；容器固定 1040（DESIGN.md Content Width），≥1440 不再攤開，
 * <1440 隨視窗縮。手機仍單欄堆疊、個人卡直式置中。
 * 必須放在所有基礎規則（.tp-account-hero 等）之後：同特異度下後寫的贏，放前面會被基礎規則蓋掉（個人卡就變不成橫式）。 */
@media (min-width: 1024px) {
  .tp-account-inner { max-width: 1040px; padding-bottom: 80px; }
  .tp-account-hero { flex-direction: row; text-align: left; flex-wrap: wrap; padding: 20px 24px; }
  .tp-account-hero-text { flex: 1; min-width: 180px; }
  .tp-account-hero-name-row { justify-content: flex-start; }
  .tp-account-hero-stats { width: 300px; padding-top: 0; border-top: none; }
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

const DELETE_PASSWORD_INVALID = '密碼不正確，帳號未刪除';
const NO_PASSWORD_DELETE_BLOCKED = '此帳號沒有設定密碼，無法在此刪除帳號。請聯絡客服協助。';

export default function AccountPage() {
  const auth = useRequireAuth();
  const { user, reload: reloadUser } = useCurrentUser();
  const navigate = useNavigate();

  const [stats, setStats] = useState<AccountStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [statsAttempt, setStatsAttempt] = useState(0);
  const statsLoading = !stats && !statsError;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── 刪除帳號（Google Play 強制要求的帳號刪除路徑）──────────────────
   * owner 決策（2026-07-20）：擁有的行程**一併刪除，含共編者的**。
   * 所以確認畫面一定要先讓使用者看到「會刪掉幾個行程、影響幾位共編者」——
   * 那兩個數字前端算不出來，由 GET /api/account 提供。 */
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  /** 與「變更密碼」入口共用同一份 GET /api/account。 */
  const accountPreview = useAccountPreview(!!auth.user);
  // 只有「剛取到」的預覽才可用於刪除確認；重取中或重取失敗時為 null（確認鈕不可按）
  const deletePreview = accountPreview.status === 'ready' ? accountPreview.preview : null;
  const reloadPreview = accountPreview.reload;
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  // field 標記錯誤歸屬哪個輸入欄位（不靠比對訊息文字）
  const [deleteErr, setDeleteErr] = useState<{ message: string; field?: 'password' } | null>(null);
  const deleteError = deleteErr?.message ?? null;
  const deletePasswordInvalid = deleteErr?.field === 'password';
  const setDeleteError = (message: string | null, field?: 'password') => setDeleteErr(message === null ? null : { message, field });
  const [loggingOut, setLoggingOut] = useState(false);

  // v2.33.142: inline edit display_name — 取代 v2.33.122 modal。
  // pencil 或 name click → 變 input → blur 自動 save → 成功 silent / 失敗 toast。
  // ESC 取消還原。Enter blur (trigger save)。
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [confirmedName, setConfirmedName] = useState<{ value: string | null; userAtSave: CurrentUser | null | undefined } | null>(null);
  const currentName = confirmedName && confirmedName.userAtSave === user
    ? confirmedName.value : user?.displayName;
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  // 進入編輯前的快照 — ESC 還原 / 比對是否真的有改 (無改省 API call)
  const draftBaselineRef = useRef('');

  const startEditName = useCallback(() => {
    const current = currentName ?? '';
    setDraftName(current);
    draftBaselineRef.current = current;
    setEditingName(true);
    // next tick focus + select
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }, 0);
  }, [currentName]);

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
      const saved = unwrap(await typedApi.patch('/api/account/profile', { body: { displayName: trimmed.length === 0 ? null : trimmed } }));
      setConfirmedName({ value: saved.displayName, userAtSave: user });
      reloadUser();
      setEditingName(false);
      // v2.33.142: 成功 silent (user feedback 「右上角不用顯示狀態」一脈相承)。
      // 失敗才走 toast。
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : '更新失敗';
      showToast(msg, 'error');
      // 失敗保留 editing=true 讓 user retry
      setTimeout(() => nameInputRef.current?.focus(), 0);
    } finally {
      setSavingName(false);
    }
  }, [draftName, reloadUser, user]);

  /**
   * 只有有 local 密碼的帳號才顯示「變更密碼」。
   * 預覽取失敗時入口位置改顯示一列錯誤與「重試」（見 previewFailed）。
   */
  const hasPassword = accountPreview.preview?.hasPassword === true;
  // 重試列只在「完全沒有預覽」時出現；已知 hasPassword 後的暫時性失敗不影響入口
  const previewFailed = accountPreview.status === 'error' && !accountPreview.preview;

  useEffect(() => {
    if (!auth.user) return;
    let cancelled = false;
    setStatsError(null);
    // 逾時（#1688）：冷載入慢或請求卡住時轉成失敗態＋重試，不永遠 pending
    typedApi.get('/api/account/stats', { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).then(unwrap)
      .then((data) => { if (!cancelled) setStats(data as AccountStats); })
      // v2.33.47 round 7b: 不直接 surface raw error.message (可能 leak backend
      // detail / SQL fragment)。改 ApiError 與 network error 分開 generic 文案。
      .catch((e) => {
        if (cancelled) return;
        setStatsError(e instanceof ApiError ? '無法載入統計' : '網路錯誤，請稍後再試');
      });
    return () => { cancelled = true; };
  }, [auth.user, statsAttempt]);

  /** 開啟刪除確認前先抓預覽 —— 沒有數字就不該讓使用者按下不可逆的按鈕。 */
  const openDeleteModal = useCallback(async () => {
    setDeleteError(null);
    setDeleteInput('');
    setShowDeleteModal(true);
    // 每次開啟都重取最新影響範圍（不可逆動作不能用過期數字）；取的期間 status=loading，deletePreview 為 null。
    // 載入中開啟會與進行中的請求去重（同一個 promise）。
    const preview = await reloadPreview();
    if (!preview) setDeleteError('無法取得刪除影響範圍，請稍後再試');
  }, [reloadPreview]);

  const closeDeleteModal = useCallback(() => setShowDeleteModal(false), []);

  /** 刪除只走密碼確認；沒有密碼身分的帳號 fail-closed，永遠不能確認（api 端同樣回 403）。 */
  const canConfirmDelete = !!deletePreview && deletePreview.hasPassword && deleteInput.length > 0;

  const deleteAccount = useCallback(async () => {
    if (!deletePreview || !deletePreview.hasPassword || !canConfirmDelete || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await typedApi.delete('/api/account', { body: { password: deleteInput } });
      // 帳號已不存在，不能留在帳號頁。用整頁導向而非 SPA navigate —— 要把
      // 記憶體中的 auth context / 快取一併清掉。
      window.location.href = '/';
    } catch (err) {
      setDeleting(false);
      if (err instanceof ApiError && err.code === 'ACCOUNT_DELETE_PASSWORD_INVALID') {
        setDeleteError(DELETE_PASSWORD_INVALID, 'password');
      } else if (err instanceof ApiError && err.code === 'ACCOUNT_DELETE_REAUTH_REQUIRED') {
        setDeleteError(NO_PASSWORD_DELETE_BLOCKED);
      } else {
        setDeleteError('刪除失敗，請稍後再試');
      }
    }
  }, [deletePreview, canConfirmDelete, deleteInput, deleting]);

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await logoutSession();
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

  // auth 還原中（或正要導去登入）：照常渲染殼層與骨架，不 return null（#1691）。骨架不含任何使用者資料。
  const loaded = !!auth.user && !!user;

  // v2.17.17:initial 用 displayName 對齊 sidebar(原本用 email.charAt 造成
  // displayName "Ray" + email "lean.lean@..." 時 hero 顯示「L」 但 sidebar 顯示「R」)。
  const displayName = user ? currentName || user.email.split('@')[0] || user.email : '';
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
        { key: 'appearance', icon: 'palette', title: '外觀設定', helper: '跟隨系統、淺色、深色', to: '/account/appearance' },
        { key: 'notifications', icon: 'lightbulb', title: '通知設定', helper: '尚未開放', to: '/account/notifications' },
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
        ...(hasPassword ? [{ key: 'change-password', icon: 'gear', title: '變更密碼', helper: '變更後其他裝置會登出', to: '/account/password' }] : []),
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
          <div className="tp-account-hero-avatar" aria-hidden="true">{loaded ? initial : ''}</div>
          <div className="tp-account-hero-text">
            <div className="tp-account-hero-name-row">
              {!loaded ? (
                <span className="tp-account-skeleton" style={{ width: '8ch', height: 28 }} aria-hidden="true" />
              ) : editingName ? (
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
                  placeholder={user?.email.split('@')[0]}
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
            <div className="tp-account-hero-email">
              {loaded ? user?.email : <span className="tp-account-skeleton" style={{ width: '16ch', height: 14 }} aria-hidden="true" />}
            </div>
          </div>
          <div className="tp-account-hero-stats" role="group" aria-label="帳號統計" aria-busy={statsLoading}>
            {([
              ['tripCount', '個行程'],
              ['totalDays', '天旅程'],
              ['collaboratorCount', '位旅伴'],
            ] as const).map(([key, label]) => (
              <div className="tp-account-hero-stat" key={key}>
                <span className="tp-account-hero-stat-value">
                  {statsLoading
                    ? <span className="tp-account-skeleton" aria-hidden="true" />
                    : stats?.[key] ?? <span aria-hidden="true">—</span>}
                </span>
                <span className="tp-account-hero-stat-label">{label}</span>
              </div>
            ))}
            {statsLoading && <span className="sr-only" role="status">統計載入中</span>}
            {statsError && (
              <div className="tp-account-stats-error" role="alert">
                <Icon name="warning" />
                <span>{statsError}</span>
                <button type="button" onClick={() => setStatsAttempt((n) => n + 1)}>重試</button>
              </div>
            )}
          </div>
        </section>

        {/* 還原前整塊 inert：骨架期間不可操作（登出、刪除帳號等） */}
        <div className="tp-account-groups" inert={!loaded}>
        {groups.map((group) => (
          <section key={group.key} className="tp-account-group">
            <div className="tp-account-group-label" data-testid={`account-group-label-${group.key}`}>{group.label}</div>
            <div className="tp-account-rows" data-tone={group.tone} data-testid={`account-rows-${group.key}`}>
              {group.key === 'account' && previewFailed && (
                <div className="tp-account-row tp-account-row-static" role="alert">
                  <div className="tp-account-row-body">
                    <div className="tp-account-row-helper">無法確認是否可變更密碼</div>
                  </div>
                  <button type="button" className="tp-btn tp-btn-ghost" onClick={() => void accountPreview.reload()}
                    data-testid="account-preview-retry">重試</button>
                </div>
              )}
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
        {/* AI 資料同意（ADR-0012）：enforced=false 時整區不渲染 */}
        {loaded && <AiDataConsentSettings />}

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
            : deleteError ? '無法確認刪除影響範圍。請取消後重試。' : '正在確認刪除影響範圍⋯'
        }
        warning={
          deletePreview && deletePreview.collaboratorsAffected > 0
            ? `其中有共編者的行程也會刪除，${deletePreview.collaboratorsAffected} 位共編者將失去存取權，且不會另行通知。`
            : undefined
        }
        confirmLabel="永久刪除"
        cancelLabel="取消"
        busy={deleting}
        confirmDisabled={!canConfirmDelete}
        onConfirm={deleteAccount}
        onCancel={closeDeleteModal}
      >
        {deletePreview && !deletePreview.hasPassword && (
          <p className="tp-account-delete-error" role="alert">{NO_PASSWORD_DELETE_BLOCKED}</p>
        )}
        {deletePreview && deletePreview.hasPassword && (
          <div className="tp-account-delete-confirm">
            <label className="tp-account-delete-label" htmlFor="tp-delete-confirm-input">請輸入密碼以確認</label>
            <input
              id="tp-delete-confirm-input"
              className="tp-input"
              data-testid="delete-account-confirm-input"
              type="password"
              autoComplete="current-password"
              value={deleteInput}
              onChange={(e) => { setDeleteInput(e.target.value); if (deletePasswordInvalid) setDeleteError(null); }}
              aria-invalid={deletePasswordInvalid || undefined}
              aria-describedby={deletePasswordInvalid ? 'tp-delete-confirm-error' : undefined}
              disabled={deleting}
            />
            {deleteError && (
              <p className="tp-account-delete-error" id="tp-delete-confirm-error" role="alert">{deleteError}</p>
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
      <ToastContainer />
      <AppShell sidebar={sidebar} main={main} bottomNav={<GlobalBottomNav authed={auth.user !== null} />} />
    </>
  );
}
