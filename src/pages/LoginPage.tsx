/**
 * LoginPage — B-P2 §6.4 placeholder
 *
 * /login 路由 — 現 Phase：導向 Cloudflare Access 認證（既有 /manage 由 Access 保護）。
 * 未來 V2 OAuth Workstream A 才做完整的 Email + Google/Apple/LINE 登入。
 * 視覺對應：docs/design-sessions/mockup-login-v2.html（未來實作）
 */
import { Link } from 'react-router-dom';

export default function LoginPage() {
  return (
    <div className="tp-placeholder" data-testid="login-page">
      <style>{`
        .tp-placeholder {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 60vh; padding: 48px 24px; text-align: center;
          color: var(--color-foreground);
        }
        .tp-placeholder .ph-eyebrow {
          font-size: var(--font-size-eyebrow); font-weight: 700;
          letter-spacing: 0.22em; text-transform: uppercase;
          color: var(--color-muted); margin-bottom: 12px;
        }
        .tp-placeholder h1 {
          font-size: var(--font-size-title); font-weight: 800;
          letter-spacing: -0.02em; margin-bottom: 12px;
        }
        .tp-placeholder .ph-sub {
          font-size: var(--font-size-callout); color: var(--color-muted);
          max-width: 480px; margin-bottom: 28px;
        }
        .tp-placeholder .ph-cta {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 12px 20px; border-radius: var(--radius-full);
          background: var(--color-accent); color: var(--color-accent-foreground);
          text-decoration: none;
          font: inherit; font-size: 14px; font-weight: 600;
          min-height: var(--spacing-tap-min);
        }
        .tp-placeholder .ph-cta:hover { filter: brightness(0.92); }
      `}</style>
      <div className="ph-eyebrow">Welcome · Tripline</div>
      <h1>使用 Cloudflare Access 登入</h1>
      <p className="ph-sub">目前以 Cloudflare Access email 白名單保護 /manage。進入管理頁會觸發 Access 登入 flow。未來 V2 會換成 OAuth（Google / Apple / LINE）。</p>
      <Link to="/manage" className="ph-cta">前往 /manage 登入</Link>
    </div>
  );
}
