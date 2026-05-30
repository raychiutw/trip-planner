/**
 * ShareLinkModal — owner/co-editor share-link management (v2.39.0, PR1 minimal).
 *
 * Create a public link (returns the URL ONCE — only the hash is stored, so an existing
 * link's URL can never be re-shown), copy it, and 關閉分享 (revoke). PR2 adds the full
 * panel: per-link section toggles, expiry, rotate, view-count detail.
 */
import { useCallback, useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import { listShares, createShare, revokeShare, type ShareLinkRow, type CreatedShare } from '../../lib/shareApi';

const STYLE = `
.tp-sharemodal-backdrop{position:fixed;inset:0;z-index:var(--z-modal,1000);background:rgba(42,31,24,.45);
  display:flex;align-items:center;justify-content:center;padding:18px;}
.tp-sharemodal{background:#fffbf5;color:#1d1813;width:100%;max-width:440px;border-radius:14px;
  box-shadow:0 16px 48px rgba(42,31,24,.3);padding:20px;font-family:inherit;max-height:88vh;overflow-y:auto;}
.tp-sharemodal-head{display:flex;align-items:center;gap:8px;}
.tp-sharemodal-head h2{font-size:18px;font-weight:700;margin:0;margin-right:auto;}
.tp-sharemodal-x{border:none;background:transparent;font-size:18px;color:#6f5a47;cursor:pointer;line-height:1;padding:4px;}
.tp-sharemodal-sub{font-size:13px;color:#6f5a47;line-height:1.55;margin:8px 0 14px;}
.tp-sharemodal-new{background:#fbeee4;border:1px solid #f7dfcb;border-radius:10px;padding:12px;margin-bottom:14px;}
.tp-sharemodal-new-label{font-size:12px;font-weight:600;color:#b85c2e;margin-bottom:8px;}
.tp-sharemodal-urlrow{display:flex;gap:8px;}
.tp-sharemodal-url{flex:1;min-width:0;font-size:13px;font-family:inherit;border:1px solid #eadfcf;border-radius:8px;
  padding:8px 10px;background:#fff;color:#1d1813;}
.tp-sharemodal-copy{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;
  background:#d97848;color:#fff;font-weight:600;font-size:13px;font-family:inherit;padding:0 12px;cursor:pointer;}
.tp-sharemodal-copy svg{width:15px;height:15px;}
.tp-sharemodal-error{font-size:13px;color:#b3261e;margin-bottom:10px;}
.tp-sharemodal-create{display:inline-flex;align-items:center;gap:6px;border:1px solid #d97848;border-radius:8px;
  background:#fff;color:#b85c2e;font-weight:600;font-size:14px;font-family:inherit;padding:9px 14px;cursor:pointer;min-height:40px;}
.tp-sharemodal-create:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-create svg{width:16px;height:16px;}
.tp-sharemodal-list{margin-top:18px;border-top:1px solid #eadfcf;padding-top:14px;}
.tp-sharemodal-list-h{font-size:12px;font-weight:700;letter-spacing:.05em;color:#6f5a47;margin-bottom:8px;}
.tp-sharemodal-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f0e9df;}
.tp-sharemodal-row-meta{flex:1;font-size:13px;color:#1d1813;}
.tp-sharemodal-revoke{border:1px solid #eadfcf;border-radius:7px;background:#fff;color:#6f5a47;font-size:13px;
  font-family:inherit;padding:6px 10px;cursor:pointer;}
.tp-sharemodal-revoke:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-note{font-size:12px;color:#8a7a68;line-height:1.5;margin-top:10px;}
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
  const [created, setCreated] = useState<CreatedShare | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setCopied(false);
    setError(null);
    listShares(tripId)
      .then(setLinks)
      .catch(() => setError('載入分享連結失敗'));
  }, [open, tripId]);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  const onCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await createShare(tripId);
      setCreated(c);
      setLinks(await listShares(tripId));
    } catch {
      setError('建立失敗，請稍後重試');
    } finally {
      setBusy(false);
    }
  }, [tripId]);

  const absUrl = created ? `${window.location.origin}${created.url}` : '';
  const onCopy = useCallback(async () => {
    if (!absUrl) return;
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — user can still select + copy the input manually */
    }
  }, [absUrl]);

  const onRevoke = useCallback(
    async (id: number) => {
      setBusy(true);
      setError(null);
      try {
        await revokeShare(tripId, id);
        setLinks(await listShares(tripId));
      } catch {
        setError('關閉分享失敗');
      } finally {
        setBusy(false);
      }
    },
    [tripId],
  );

  if (!open) return null;
  const active = links.filter((l) => !l.revokedAt);

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
          建立一個公開連結，對方不用登入就能看（唯讀）。預設公開：行程、航班、住宿、行前須知；緊急聯絡與預訂預設不公開。
        </p>

        {created && (
          <div className="tp-sharemodal-new" data-testid="share-new-link">
            <div className="tp-sharemodal-new-label">新連結（只會顯示這一次，請立即複製）</div>
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

        <button type="button" className="tp-sharemodal-create" onClick={onCreate} disabled={busy} data-testid="share-create">
          <Icon name="plus" /> 建立分享連結
        </button>

        {active.length > 0 && (
          <div className="tp-sharemodal-list">
            <div className="tp-sharemodal-list-h">使用中的連結</div>
            {active.map((l) => (
              <div className="tp-sharemodal-row" key={l.id} data-testid="share-link-row">
                <div className="tp-sharemodal-row-meta">
                  {l.viewCount} 次瀏覽 · 建立於 {(l.createdAt ?? '').slice(0, 10)}
                </div>
                <button
                  type="button"
                  className="tp-sharemodal-revoke"
                  onClick={() => onRevoke(l.id)}
                  disabled={busy}
                  data-testid="share-revoke"
                >
                  關閉分享
                </button>
              </div>
            ))}
            <div className="tp-sharemodal-note">
              關閉後連結立即失效。基於安全，已建立連結的網址無法再次顯示；要新網址請建立新連結。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
