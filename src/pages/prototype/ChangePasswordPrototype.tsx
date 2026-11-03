/**
 * PROTOTYPE（拋棄式，不進 master）— 變更密碼頁的三種版面。
 * 問題：「變更密碼」這個新頁面（/account/password）應該長什麼樣子？（AGENTS.md Mockup-first hard gate）
 * 做法：同一頁三個結構不同的變體，?variant=A|B|C 切換；?state= 強制顯示各種狀態。
 * 啟動：npm run prototype:change-password（只需 vite，不需 wrangler／登入）。
 * 全部是 stub：不呼叫任何 API、不改任何資料；只在 DEV 顯示切換列。
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppShell from '../../components/shell/AppShell';
import TitleBar from '../../components/shell/TitleBar';
import TitleBarPrimaryAction from '../../components/shell/TitleBarPrimaryAction';

const VARIANTS = [
  { key: 'A', name: '單卡片表單（現行實作）' },
  { key: 'B', name: '設定列＋標題列動作（對齊表單頁慣例）' },
  { key: 'C', name: '兩步驟＋即時規則清單' },
] as const;
const STATES = [
  { key: 'idle', label: '一般' },
  { key: 'short', label: '新密碼過短' },
  { key: 'same', label: '新舊相同' },
  { key: 'wrong', label: '目前密碼錯' },
  { key: 'limited', label: '被限流（30 分）' },
  { key: 'busy', label: '送出中' },
  { key: 'success', label: '成功' },
] as const;
type StateKey = (typeof STATES)[number]['key'];

/** 各狀態要顯示的錯誤文案（與正式頁同一份文案）。 */
const ERROR_TEXT: Partial<Record<StateKey, string>> = {
  short: '新密碼至少 8 字元',
  same: '新密碼不能和目前密碼相同',
  wrong: '目前密碼不正確',
  limited: '嘗試次數過多，請在 30 分鐘後再試',
};

interface VariantProps {
  sim: StateKey;
  current: string; setCurrent: (v: string) => void;
  next: string; setNext: (v: string) => void;
  show: boolean; toggleShow: () => void;
}

/* ───────────── Variant A：單卡片表單（現行實作） ───────────── */
function VariantA({ sim, current, setCurrent, next, setNext, show, toggleShow }: VariantProps) {
  const err = ERROR_TEXT[sim];
  return (
    <div className="proto-a">
      <style>{`
        .proto-a { background: var(--color-secondary); min-height: 100%; padding: 24px 16px 96px; }
        .proto-a-card { max-width: 480px; margin: 0 auto; background: var(--color-background); border: 1px solid var(--color-border);
          border-radius: var(--radius-lg); padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .proto-a-field { display: flex; flex-direction: column; gap: 6px; }
        .proto-a-field label { font-weight: 700; font-size: var(--font-size-callout); }
        .proto-a-help { margin: 0; font-size: var(--font-size-footnote); color: var(--color-muted); }
        .proto-a-err { margin: 0; font-size: var(--font-size-footnote); color: var(--color-destructive); }
        .proto-a-toggle { align-self: flex-start; background: none; border: 0; min-height: 44px; padding: 0 4px; font: inherit;
          font-size: var(--font-size-footnote); color: var(--color-accent-text); cursor: pointer; }
      `}</style>
      <div className="proto-a-card">
        <div className="proto-a-field">
          <label htmlFor="a-cur">目前密碼</label>
          <input id="a-cur" className="tp-input-long" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="proto-a-field">
          <label htmlFor="a-new">新密碼</label>
          <input id="a-new" className="tp-input-long" type={show ? 'text' : 'password'} value={next} onChange={(e) => setNext(e.target.value)} />
          <button type="button" className="proto-a-toggle" aria-pressed={show} onClick={toggleShow}>{show ? '隱藏密碼' : '顯示密碼'}</button>
          <p className="proto-a-help">至少 8 字元。變更後，其他裝置會被登出，這台維持登入。</p>
        </div>
        {err && <p className="proto-a-err" role="alert">{err}</p>}
        {sim === 'success' && <p className="proto-a-help" role="status">✓ 密碼已更新，其他裝置已登出</p>}
        <button type="button" className="tp-btn tp-btn-primary" disabled={sim === 'busy'}>{sim === 'busy' ? '處理中…' : '變更密碼'}</button>
      </div>
    </div>
  );
}

/* ───────────── Variant B：設定列＋標題列動作 ───────────── */
function VariantB({ sim, current, setCurrent, next, setNext, show, toggleShow }: VariantProps) {
  const err = ERROR_TEXT[sim];
  return (
    <div className="proto-b">
      <style>{`
        .proto-b { background: var(--color-secondary); min-height: 100%; padding: 16px 0 96px; }
        .proto-b-inner { max-width: 640px; margin: 0 auto; padding: 0 16px; }
        .proto-b-group { background: var(--color-background); border: 1px solid var(--color-border); border-radius: var(--radius-lg); overflow: hidden; }
        .proto-b-row { display: grid; grid-template-columns: 7rem 1fr auto; align-items: center; gap: 8px; padding: 4px 16px; min-height: 52px; }
        .proto-b-row + .proto-b-row { border-top: 1px solid var(--color-border); }
        .proto-b-row label { font-weight: 600; }
        .proto-b-row input { border: 0; background: transparent; font: inherit; color: inherit; padding: 12px 0; outline: none; min-width: 0; }
        .proto-b-eye { background: none; border: 0; min-height: 44px; min-width: 44px; cursor: pointer; font: inherit; color: var(--color-accent-text); }
        .proto-b-foot { margin: 8px 16px 0; font-size: var(--font-size-footnote); color: var(--color-muted); }
        .proto-b-err { margin: 8px 16px 0; font-size: var(--font-size-footnote); color: var(--color-destructive); }
        @media (max-width: 480px) { .proto-b-row { grid-template-columns: 5.5rem 1fr auto; } }
      `}</style>
      <div className="proto-b-inner">
        <div className="proto-b-group">
          <div className="proto-b-row">
            <label htmlFor="b-cur">目前密碼</label>
            <input id="b-cur" type="password" placeholder="必填" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <span />
          </div>
          <div className="proto-b-row">
            <label htmlFor="b-new">新密碼</label>
            <input id="b-new" type={show ? 'text' : 'password'} placeholder="至少 8 字元" value={next} onChange={(e) => setNext(e.target.value)} />
            <button type="button" className="proto-b-eye" aria-pressed={show} onClick={toggleShow}>{show ? '隱藏' : '顯示'}</button>
          </div>
        </div>
        {err
          ? <p className="proto-b-err" role="alert">{err}</p>
          : <p className="proto-b-foot">變更後，其他裝置會被登出，這台維持登入。{sim === 'success' ? ' ✓ 已更新' : ''}</p>}
      </div>
    </div>
  );
}

/* ───────────── Variant C：兩步驟＋即時規則清單 ───────────── */
function VariantC({ sim, current, setCurrent, next, setNext, show, toggleShow }: VariantProps) {
  const [step, setStep] = useState<1 | 2>(1);
  // ?state= 是為了看畫面：這幾個狀態只會出現在第 2 步（過短／相同）或第 1 步（目前密碼錯），自動帶到對應步驟
  const effective = sim === 'wrong' ? 1 : ['short', 'same', 'busy', 'success', 'limited'].includes(sim) ? 2 : step;
  const rules = [
    { ok: next.length >= 8 && sim !== 'short', text: '至少 8 字元' },
    { ok: next.length > 0 && next !== current && sim !== 'same', text: '和目前密碼不同' },
  ];
  const err = ERROR_TEXT[sim];
  return (
    <div className="proto-c">
      <style>{`
        .proto-c { min-height: 100%; padding: 32px 16px 96px; display: grid; justify-items: center; align-content: start; gap: 24px; }
        .proto-c-step { font-size: var(--font-size-footnote); color: var(--color-muted); letter-spacing: 0; }
        .proto-c-title { margin: 0; font-size: var(--font-size-title2); font-weight: 800; text-align: center; }
        .proto-c-body { width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 12px; }
        .proto-c-rules { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: var(--font-size-callout); }
        .proto-c-rules li { color: var(--color-muted); } .proto-c-rules li.ok { color: var(--color-foreground); }
        .proto-c-err { margin: 0; color: var(--color-destructive); font-size: var(--font-size-footnote); }
        .proto-c-links { display: flex; justify-content: space-between; }
        .proto-c-link { background: none; border: 0; min-height: 44px; padding: 0 4px; font: inherit; color: var(--color-accent-text); cursor: pointer; }
      `}</style>
      <span className="proto-c-step">步驟 {effective}／2</span>
      {effective === 1 ? (
        <div className="proto-c-body">
          <h2 className="proto-c-title">先確認是你本人</h2>
          <input className="tp-input-long" type="password" aria-label="目前密碼" placeholder="目前密碼" value={current} onChange={(e) => setCurrent(e.target.value)} />
          {err && <p className="proto-c-err" role="alert">{err}</p>}
          <button type="button" className="tp-btn tp-btn-primary" onClick={() => setStep(2)}>下一步</button>
        </div>
      ) : (
        <div className="proto-c-body">
          <h2 className="proto-c-title">設定新密碼</h2>
          <input className="tp-input-long" type={show ? 'text' : 'password'} aria-label="新密碼" placeholder="新密碼" value={next} onChange={(e) => setNext(e.target.value)} />
          <ul className="proto-c-rules" aria-label="密碼規則">
            {rules.map((r) => <li key={r.text} className={r.ok ? 'ok' : ''}>{r.ok ? '✓' : '○'} {r.text}</li>)}
          </ul>
          {err && sim !== 'short' && sim !== 'same' && <p className="proto-c-err" role="alert">{err}</p>}
          {sim === 'success' && <p role="status">✓ 密碼已更新，其他裝置已登出</p>}
          <button type="button" className="tp-btn tp-btn-primary" disabled={sim === 'busy'}>{sim === 'busy' ? '處理中…' : '變更密碼'}</button>
          <div className="proto-c-links">
            <button type="button" className="proto-c-link" onClick={() => setStep(1)}>← 上一步</button>
            <button type="button" className="proto-c-link" aria-pressed={show} onClick={toggleShow}>{show ? '隱藏密碼' : '顯示密碼'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────── 切換列（原型專用，只在 DEV 顯示） ───────────── */
function PrototypeBar({ variant, sim, setParam }: { variant: string; sim: StateKey; setParam: (k: 'variant' | 'state', v: string) => void }) {
  const idx = VARIANTS.findIndex((v) => v.key === variant);
  const go = (d: number) => setParam('variant', VARIANTS[(idx + d + VARIANTS.length) % VARIANTS.length]!.key);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  if (!import.meta.env.DEV) return null;
  const btn = { border: 0, background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer', padding: '6px 10px' } as const;
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 12, transform: 'translateX(-50%)', zIndex: 9999, background: '#111', color: '#fff',
      borderRadius: 16, padding: '8px 12px', boxShadow: '0 6px 24px rgba(0,0,0,.35)', display: 'grid', gap: 6, maxWidth: 'calc(100vw - 16px)', fontSize: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        <button style={btn} onClick={() => go(-1)} aria-label="上一個變體">◀</button>
        <strong>{variant}</strong><span style={{ opacity: .8 }}>（{VARIANTS[idx]?.name}）</span>
        <button style={btn} onClick={() => go(1)} aria-label="下一個變體">▶</button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, justifyContent: 'center' }}>
        {STATES.map((s) => (
          <button key={s.key} onClick={() => setParam('state', s.key)}
            style={{ ...btn, padding: '3px 8px', borderRadius: 10, background: s.key === sim ? '#fff' : 'rgba(255,255,255,.14)', color: s.key === sim ? '#111' : '#fff' }}>{s.label}</button>
        ))}
      </div>
    </div>
  );
}

export default function ChangePasswordPrototype() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const variant = VARIANTS.some((v) => v.key === params.get('variant')) ? (params.get('variant') as string) : 'A';
  const sim = (STATES.some((s) => s.key === params.get('state')) ? params.get('state') : 'idle') as StateKey;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [show, setShow] = useState(false);
  const setParam = (k: 'variant' | 'state', v: string) => { const p = new URLSearchParams(params); p.set(k, v); setParams(p, { replace: true }); };
  const props: VariantProps = { sim, current, setCurrent, next, setNext, show, toggleShow: () => setShow((s) => !s) };

  const actions: ReactNode = variant === 'B'
    ? <TitleBarPrimaryAction label="變更" busy={sim === 'busy'} busyLabel="處理中…" disabled={false} onClick={() => undefined} testId="proto-b-action" />
    : undefined;
  const main = (
    <div data-testid="change-password-prototype">
      <TitleBar title="變更密碼" back={() => navigate(-1)} actions={actions} />
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantB {...props} />}
      {variant === 'C' && <VariantC {...props} />}
      <PrototypeBar variant={variant} sim={sim} setParam={setParam} />
    </div>
  );
  return <AppShell sidebar={null} main={main} bottomNav={null} />;
}
