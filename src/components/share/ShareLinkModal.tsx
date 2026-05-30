/**
 * ShareLinkModal — full share-link management panel (v2.40.0 PR2).
 *
 * Signed-off mockup: docs/design-sessions/2026-05-30-share-manage-panel.html.
 * Create form (section pills + expiry segmented + anonymous) → one-time URL banner →
 * active-link cards (view count, section chips, anon/expired badge, 重新產生/關閉/刪除).
 * Per-link section/expiry/anon are set at CREATE; to change them, rotate or create a new
 * link. Existing-link URLs can never be re-shown (DB stores only the token hash).
 */
import { useCallback, useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import {
  listShares,
  createShare,
  revokeShare,
  rotateShare,
  deleteShare,
  type ShareLinkRow,
} from '../../lib/shareApi';

const SECTION_ORDER = ['flights', 'lodgings', 'reservations', 'pretrip', 'emergency'] as const;
const SECTION_LABELS: Record<string, string> = {
  flights: '航班',
  lodgings: '住宿',
  reservations: '預訂',
  pretrip: '行前須知',
  emergency: '緊急聯絡',
};
const DEFAULT_SECTIONS = ['flights', 'lodgings', 'pretrip'];
const EXPIRY_PRESETS = [
  { k: 'never', label: '永久', ms: null as number | null },
  { k: '24h', label: '24 小時', ms: 24 * 60 * 60 * 1000 },
  { k: '7d', label: '7 天', ms: 7 * 24 * 60 * 60 * 1000 },
  { k: '30d', label: '30 天', ms: 30 * 24 * 60 * 60 * 1000 },
];

function parseSections(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
function expiryInfo(expiresAt: number | null): { text: string; expired: boolean } {
  if (expiresAt == null) return { text: '永久有效', expired: false };
  const expired = expiresAt < Date.now();
  const d = new Date(expiresAt);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return { text: expired ? `已於 ${md} 到期` : `${md} 到期`, expired };
}

const STYLE = `
.tp-sharemodal-backdrop{position:fixed;inset:0;z-index:var(--z-modal,1000);background:rgba(42,31,24,.45);
  display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto;}
.tp-sharemodal{background:#fffbf5;color:#1d1813;width:100%;max-width:460px;border-radius:14px;
  box-shadow:0 16px 48px rgba(42,31,24,.3);padding:20px;font-family:inherit;margin:auto;}
.tp-sharemodal-head{display:flex;align-items:center;gap:8px;}
.tp-sharemodal-head h2{font-size:18px;font-weight:700;margin:0;margin-right:auto;}
.tp-sharemodal-x{border:none;background:transparent;font-size:18px;color:#6f5a47;cursor:pointer;line-height:1;padding:4px;}
.tp-sharemodal-sub{font-size:13px;color:#6f5a47;line-height:1.55;margin:8px 0 16px;}
.tp-sharemodal-seclabel{font-size:12px;font-weight:700;color:#6f5a47;letter-spacing:.04em;margin:14px 0 8px;}
.tp-sharemodal-createbox{background:#faf4ea;border:1px solid #eadfcf;border-radius:12px;padding:14px;}
.tp-sharemodal-createbox .tp-sharemodal-seclabel:first-child{margin-top:0;}
.tp-sharemodal-pills{display:flex;flex-wrap:wrap;gap:7px;}
.tp-sharemodal-pill{font-size:13px;font-weight:600;padding:6px 12px;border-radius:9999px;border:1px solid #eadfcf;
  background:#fff;color:#6f5a47;cursor:pointer;font-family:inherit;}
.tp-sharemodal-pill.on{background:#d97848;border-color:#d97848;color:#fff;}
.tp-sharemodal-hint{font-size:12px;color:#8a7a68;margin-top:7px;line-height:1.5;}
.tp-sharemodal-seg{display:flex;border:1px solid #eadfcf;border-radius:8px;overflow:hidden;width:fit-content;}
.tp-sharemodal-seg button{font-size:13px;font-family:inherit;padding:7px 13px;border:none;background:#fff;color:#6f5a47;
  cursor:pointer;border-right:1px solid #eadfcf;}
.tp-sharemodal-seg button:last-child{border-right:none;}
.tp-sharemodal-seg button.on{background:#fbeee4;color:#b85c2e;font-weight:700;}
.tp-sharemodal-anon{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:14px;cursor:pointer;}
.tp-sharemodal-anon input{width:17px;height:17px;accent-color:#d97848;}
.tp-sharemodal-create{width:100%;margin-top:14px;min-height:42px;border:none;border-radius:9px;background:#d97848;
  color:#fff;font-weight:700;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}
.tp-sharemodal-create:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-create svg{width:16px;height:16px;}
.tp-sharemodal-new{background:#fbeee4;border:1px solid #f7dfcb;border-radius:10px;padding:12px;margin-top:14px;}
.tp-sharemodal-new-lbl{font-size:12px;font-weight:600;color:#b85c2e;margin-bottom:8px;}
.tp-sharemodal-urlrow{display:flex;gap:8px;}
.tp-sharemodal-url{flex:1;min-width:0;font-size:13px;font-family:inherit;border:1px solid #eadfcf;border-radius:8px;
  padding:8px 10px;background:#fff;color:#1d1813;}
.tp-sharemodal-copy{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;
  background:#d97848;color:#fff;font-weight:600;font-size:13px;font-family:inherit;padding:0 12px;cursor:pointer;}
.tp-sharemodal-copy svg{width:15px;height:15px;}
.tp-sharemodal-error{font-size:13px;color:#b3261e;margin-top:10px;}
.tp-sharemodal-card{border:1px solid #eadfcf;border-radius:11px;padding:13px;margin-top:10px;background:#fff;}
.tp-sharemodal-cardtop{display:flex;align-items:center;gap:8px;font-size:13px;}
.tp-sharemodal-cardmeta{color:#6f5a47;}
.tp-sharemodal-views{margin-left:auto;font-weight:600;color:#1d1813;}
.tp-sharemodal-badge{font-size:12px;font-weight:600;padding:2px 8px;border-radius:9999px;background:#fbeee4;color:#b85c2e;}
.tp-sharemodal-badge.expired{background:#f0e9df;color:#8a7a68;}
.tp-sharemodal-badge.anon{background:#ece6f5;color:#6b5b95;}
.tp-sharemodal-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}
.tp-sharemodal-chip{font-size:12px;padding:3px 9px;border-radius:9999px;background:#faf4ea;color:#6f5a47;border:1px solid #eadfcf;}
.tp-sharemodal-exp{font-size:12px;color:#8a7a68;margin-top:8px;display:flex;align-items:center;gap:5px;}
.tp-sharemodal-exp svg{width:13px;height:13px;}
.tp-sharemodal-acts{display:flex;gap:8px;margin-top:11px;padding-top:11px;border-top:1px solid #efe9df;}
.tp-sharemodal-act{font-size:13px;font-family:inherit;padding:6px 11px;border-radius:7px;border:1px solid #eadfcf;
  background:#fff;color:#6f5a47;cursor:pointer;display:inline-flex;align-items:center;gap:4px;}
.tp-sharemodal-act:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-act svg{width:14px;height:14px;}
.tp-sharemodal-act.rotate{color:#b85c2e;border-color:#f7dfcb;}
.tp-sharemodal-act.del{margin-left:auto;color:#b3261e;border-color:#f3d0cc;}
.tp-sharemodal-note{font-size:12px;color:#8a7a68;line-height:1.5;margin-top:14px;}
`;

export default function ShareLinkModal({
  tripId,
  open,
  onClose,
}: {
  tripId: string;
  open: boolean;
  onClose: () => void;
}) {
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [created, setCreated] = useState<{ token: string; url: string } | null>(null);
  const [sections, setSections] = useState<Set<string>>(new Set(DEFAULT_SECTIONS));
  const [expiryKey, setExpiryKey] = useState('never');
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listShares(tripId)
      .then(setLinks)
      .catch(() => setError('載入分享連結失敗'));
  }, [tripId]);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setCopied(false);
    setError(null);
    setSections(new Set(DEFAULT_SECTIONS));
    setExpiryKey('never');
    setAnon(false);
    reload();
  }, [open, reload]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const toggleSection = useCallback((key: string) => {
    setSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const onCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const preset = EXPIRY_PRESETS.find((p) => p.k === expiryKey);
      const expiresAt = preset?.ms != null ? Date.now() + preset.ms : null;
      const c = await createShare(tripId, {
        visibleSections: SECTION_ORDER.filter((s) => sections.has(s)),
        expiresAt,
        anonymous: anon,
      });
      setCreated({ token: c.token, url: c.url });
      setCopied(false);
      reload();
    } catch {
      setError('建立失敗，請稍後重試');
    } finally {
      setBusy(false);
    }
  }, [tripId, sections, expiryKey, anon, reload]);

  const absUrl = created ? `${window.location.origin}${created.url}` : '';
  const onCopy = useCallback(async () => {
    if (!absUrl) return;
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can still select the input */
    }
  }, [absUrl]);

  const mutate = useCallback(
    async (fn: () => Promise<unknown>, after?: (r: unknown) => void) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fn();
        after?.(r);
        reload();
      } catch {
        setError('操作失敗，請稍後重試');
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  if (!open) return null;
  const visibleLinks = links.filter((l) => !l.revokedAt);

  return (
    <div className="tp-sharemodal-backdrop" role="presentation" onClick={onClose}>
      <style>{STYLE}</style>
      <div
        className="tp-sharemodal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tp-sharemodal-title"
        onClick={(e) => e.stopPropagation()}
        data-testid="share-modal"
      >
        <div className="tp-sharemodal-head">
          <h2 id="tp-sharemodal-title">分享這個行程</h2>
          <button type="button" className="tp-sharemodal-x" onClick={onClose} aria-label="關閉">
            ✕
          </button>
        </div>
        <p className="tp-sharemodal-sub">
          建立公開連結，對方不用登入就能看（唯讀）。可開多個連結，各自設定要公開哪些區塊與有效期限。
        </p>

        <div className="tp-sharemodal-createbox">
          <div className="tp-sharemodal-seclabel">要公開哪些區塊？</div>
          <div className="tp-sharemodal-pills">
            {SECTION_ORDER.map((s) => (
              <button
                key={s}
                type="button"
                className={`tp-sharemodal-pill${sections.has(s) ? ' on' : ''}`}
                aria-pressed={sections.has(s)}
                onClick={() => toggleSection(s)}
                data-testid={`share-section-${s}`}
              >
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="tp-sharemodal-hint">
            行程本體（每日景點/交通）一律公開。緊急聯絡與預訂預設關閉（含電話、訂房編號）。點一下切換。
          </div>

          <div className="tp-sharemodal-seclabel">有效期限</div>
          <div className="tp-sharemodal-seg">
            {EXPIRY_PRESETS.map((p) => (
              <button
                key={p.k}
                type="button"
                className={expiryKey === p.k ? 'on' : ''}
                aria-pressed={expiryKey === p.k}
                onClick={() => setExpiryKey(p.k)}
                data-testid={`share-expiry-${p.k}`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <label className="tp-sharemodal-anon">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} data-testid="share-anon" />
            匿名分享（不顯示我的名字）
          </label>

          <button type="button" className="tp-sharemodal-create" onClick={onCreate} disabled={busy} data-testid="share-create">
            <Icon name="plus" /> 建立分享連結
          </button>
        </div>

        {created && (
          <div className="tp-sharemodal-new" data-testid="share-new-link">
            <div className="tp-sharemodal-new-lbl">新連結（只會顯示這一次，請立即複製）</div>
            <div className="tp-sharemodal-urlrow">
              <input
                className="tp-sharemodal-url"
                readOnly
                value={absUrl}
                onFocus={(e) => e.currentTarget.select()}
                data-testid="share-url"
              />
              <button type="button" className="tp-sharemodal-copy" onClick={onCopy} data-testid="share-copy-url">
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? '已複製' : '複製'}
              </button>
            </div>
          </div>
        )}

        {error && <div className="tp-sharemodal-error">{error}</div>}

        {visibleLinks.length > 0 && (
          <>
            <div className="tp-sharemodal-seclabel">使用中的連結（{visibleLinks.length}）</div>
            {visibleLinks.map((l) => {
              const exp = expiryInfo(l.expiresAt);
              const active = !exp.expired;
              const secs = parseSections(l.visibleSections);
              return (
                <div className="tp-sharemodal-card" key={l.id} data-testid="share-link-row">
                  <div className="tp-sharemodal-cardtop">
                    <span className="tp-sharemodal-cardmeta">建立於 {(l.createdAt ?? '').slice(5, 10).replace('-', '/')}</span>
                    {l.anonymous === 1 && <span className="tp-sharemodal-badge anon">匿名</span>}
                    {exp.expired && <span className="tp-sharemodal-badge expired">已過期</span>}
                    <span className="tp-sharemodal-views">{l.viewCount} 次瀏覽</span>
                  </div>
                  <div className="tp-sharemodal-chips">
                    {secs.map((s) => (
                      <span className="tp-sharemodal-chip" key={s}>
                        {SECTION_LABELS[s] ?? s}
                      </span>
                    ))}
                  </div>
                  <div className="tp-sharemodal-exp">
                    <Icon name="clock" /> {exp.text}
                  </div>
                  <div className="tp-sharemodal-acts">
                    {/* rotate + 關閉 only on ACTIVE links — an expired link can't be rotated
                        (would mint a dead-on-arrival token); create a fresh link instead. */}
                    {active && (
                      <button
                        type="button"
                        className="tp-sharemodal-act rotate"
                        disabled={busy}
                        onClick={() => mutate(() => rotateShare(tripId, l.id), (r) => { const rr = r as { token: string; url: string }; setCreated({ token: rr.token, url: rr.url }); setCopied(false); })}
                        data-testid={`share-rotate-${l.id}`}
                      >
                        <Icon name="refresh-cw" /> 重新產生
                      </button>
                    )}
                    {active && (
                      <button
                        type="button"
                        className="tp-sharemodal-act"
                        disabled={busy}
                        onClick={() => mutate(() => revokeShare(tripId, l.id))}
                        data-testid={`share-revoke-${l.id}`}
                      >
                        關閉
                      </button>
                    )}
                    <button
                      type="button"
                      className="tp-sharemodal-act del"
                      disabled={busy}
                      onClick={() => mutate(() => deleteShare(tripId, l.id))}
                      data-testid={`share-delete-${l.id}`}
                    >
                      <Icon name="trash" /> 刪除
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div className="tp-sharemodal-note">
          基於安全，已建立連結的網址無法再次顯示（只存雜湊）。要新網址請按「重新產生」。「關閉」立即停用但保留瀏覽統計；「刪除」整筆移除。
        </div>
      </div>
    </div>
  );
}
