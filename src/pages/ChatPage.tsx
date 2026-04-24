/**
 * ChatPage — B-P2 §6.1 placeholder
 *
 * /chat 路由 — 未來全站 AI discovery entry（V2 後實作對話 UI）。
 * 視覺對應：docs/design-sessions/mockup-chat-v2.html
 */
import { Link } from 'react-router-dom';

export default function ChatPage() {
  return (
    <div className="tp-placeholder" data-testid="chat-page">
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
      <div className="ph-eyebrow">Coming soon · Phase 3</div>
      <h1>全站聊天規劃</h1>
      <p className="ph-sub">AI 對話 entry — 輸入「我想去沖繩」就自動幫你排行程。實作在 Workstream B Phase 3。</p>
      <Link to="/manage" className="ph-cta">前往行程管理</Link>
    </div>
  );
}
