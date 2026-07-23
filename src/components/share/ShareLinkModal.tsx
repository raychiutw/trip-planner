/**
 * ShareLinkModal — full share-link management panel (v2.40.x PR-A).
 *
 * Signed-off mockup: docs/design-sessions/2026-05-30-share-manage-panel-v2.html.
 * Create form (label / section pills / expiry incl. custom date / anonymous) → one-time
 * URL banner (copy + QR + native share) → active-link cards (label, view count, chips,
 * anon/expired badge; 編輯 inline / 重新產生 / 關閉 / 刪除) → collapsible 已關閉 section.
 *
 * QR + native share live on the NEW-LINK banner only — an existing link's raw URL can
 * never be re-shown (DB stores only the token hash), so there is nothing to encode on a
 * card; rotate a link to get a fresh URL+QR. Editing changes sections/expiry/label/anon
 * WITHOUT a new URL.
 */
import { useCallback, useEffect, useState } from 'react';
import Icon from '../shared/Icon';
import { TripDatePicker } from '../TripDatePicker';
import { shareQrDataUrl } from '../../lib/shareQr';
import { parseUtcDate } from '../../lib/parseUtcDate';
import {
  listShares,
  createShare,
  revokeShare,
  rotateShare,
  updateShare,
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
  { k: 'custom', label: '自訂', ms: 0 },
];

function parseSections(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}
function expiresAtFor(key: string, customDate: string): number | null {
  if (key === 'never') return null;
  if (key === 'custom') return customDate ? Date.parse(`${customDate}T23:59:59`) || null : null;
  const ms = EXPIRY_PRESETS.find((p) => p.k === key)?.ms;
  return ms ? Date.now() + ms : null;
}
function expiryInfo(expiresAt: number | null): { text: string; expired: boolean } {
  if (expiresAt == null) return { text: '永久有效', expired: false };
  const expired = expiresAt < Date.now();
  const d = new Date(expiresAt);
  const md = `${d.getMonth() + 1}/${d.getDate()}`;
  return { text: expired ? `已於 ${md} 到期` : `${md} 到期`, expired };
}
const todayStr = () => new Date().toISOString().slice(0, 10);
// D1 createdAt is a naive UTC datetime — parse as UTC (parseUtcDate) then show local M/D
// so the date isn't off-by-TZ near midnight (v2.31.7 pitfall).
function fmtCreated(iso: string | null | undefined): string {
  const d = parseUtcDate(iso);
  return d ? `${d.getMonth() + 1}/${d.getDate()}` : '';
}
const STYLE = `
.tp-sharemodal-backdrop{position:fixed;inset:0;z-index:var(--z-modal,1000);background:rgba(42,31,24,.45);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow-y:auto;}
/* G9（W4r）：寫死 hex → 語意 token，讓 body.dark 既有覆寫自動生效（不改 JSX/字級/容器/圓角
 * —— 那是 W11 範圍）。fill 態（建立/pill.on/copy）用 --color-accent-fill + --color-accent-foreground
 * （純 --color-accent 白字對比 3.77 未過 AA，owner 2026-07-20 已裁決）；tonal 態（seg.on/badge/new）
 * 用 --color-accent-subtle + --color-accent-text；backdrop/shadow 的 rgba 屬 overlay/陰影、雙態通用保留。 */
.tp-sharemodal{background:var(--color-background);color:var(--color-foreground);width:100%;max-width:460px;border-radius:14px;box-shadow:0 16px 48px rgba(42,31,24,.3);padding:20px;font-family:inherit;margin:auto;}
.tp-sharemodal-head{display:flex;align-items:center;gap:8px;}
.tp-sharemodal-head h2{font-size:18px;font-weight:700;margin:0;margin-right:auto;}
.tp-sharemodal-x{border:none;background:transparent;font-size:18px;color:var(--color-muted);cursor:pointer;line-height:1;padding:4px;}
.tp-sharemodal-sub{font-size:13px;color:var(--color-muted);line-height:1.5;margin:8px 0 14px;}
.tp-sharemodal-seclabel{font-size:12px;font-weight:700;color:var(--color-muted);letter-spacing:.04em;margin:13px 0 8px;}
.tp-sharemodal-createbox{background:var(--color-secondary);border:1px solid var(--color-border);border-radius:12px;padding:14px;}
.tp-sharemodal-createbox .tp-sharemodal-seclabel:first-child{margin-top:0;}
.tp-sharemodal-input{width:100%;font-size:13px;font-family:inherit;border:1px solid var(--color-border);border-radius:8px;padding:8px 10px;background:var(--color-background);color:var(--color-foreground);}
.tp-sharemodal-pills{display:flex;flex-wrap:wrap;gap:7px;}
.tp-sharemodal-pill{font-size:13px;font-weight:600;padding:6px 12px;border-radius:9999px;border:1px solid var(--color-border);background:var(--color-background);color:var(--color-muted);cursor:pointer;font-family:inherit;}
.tp-sharemodal-pill.on{background:var(--color-accent-fill);border-color:var(--color-accent-fill);color:var(--color-accent-foreground);}
.tp-sharemodal-hint{font-size:12px;color:var(--color-muted);margin-top:7px;line-height:1.5;}
.tp-sharemodal-seg{display:flex;flex-wrap:wrap;border:1px solid var(--color-border);border-radius:8px;overflow:hidden;width:fit-content;}
.tp-sharemodal-seg button{font-size:13px;font-family:inherit;padding:7px 12px;border:none;background:var(--color-background);color:var(--color-muted);cursor:pointer;border-right:1px solid var(--color-border);}
.tp-sharemodal-seg button:last-child{border-right:none;}
.tp-sharemodal-seg button.on{background:var(--color-accent-subtle);color:var(--color-accent-text);font-weight:700;}
.tp-sharemodal-datefield{margin-top:8px;}
.tp-sharemodal-anon{display:flex;align-items:center;gap:8px;font-size:13px;margin-top:13px;cursor:pointer;}
.tp-sharemodal-anon input{width:17px;height:17px;accent-color:var(--color-accent-fill);}
.tp-sharemodal-create{width:100%;margin-top:13px;min-height:42px;border:none;border-radius:9px;background:var(--color-accent-fill);color:var(--color-accent-foreground);font-weight:700;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}
.tp-sharemodal-create:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-create svg{width:16px;height:16px;}
.tp-sharemodal-new{background:var(--color-accent-subtle);border:1px solid var(--color-accent-bg);border-radius:10px;padding:12px;margin-top:14px;}
.tp-sharemodal-new-lbl{font-size:12px;font-weight:600;color:var(--color-accent-text);margin-bottom:8px;}
.tp-sharemodal-urlrow{display:flex;gap:8px;}
.tp-sharemodal-url{flex:1;min-width:0;font-size:13px;font-family:inherit;border:1px solid var(--color-border);border-radius:8px;padding:8px 10px;background:var(--color-background);color:var(--color-foreground);}
.tp-sharemodal-copy{flex:0 0 auto;display:inline-flex;align-items:center;gap:5px;border:none;border-radius:8px;background:var(--color-accent-fill);color:var(--color-accent-foreground);font-weight:600;font-size:13px;font-family:inherit;padding:0 12px;cursor:pointer;}
.tp-sharemodal-copy svg{width:15px;height:15px;}
.tp-sharemodal-newrow2{display:flex;gap:8px;margin-top:8px;}
.tp-sharemodal-newrow2 button{flex:1;border:1px solid var(--color-accent-bg);border-radius:8px;background:var(--color-background);color:var(--color-accent-text);font-weight:600;font-size:13px;font-family:inherit;padding:8px;display:inline-flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}
.tp-sharemodal-newrow2 svg{width:15px;height:15px;}
.tp-sharemodal-qr{margin-top:10px;text-align:center;}
.tp-sharemodal-qr img{width:180px;height:180px;border:1px solid var(--color-border);border-radius:8px;background:var(--color-background);}
.tp-sharemodal-error{font-size:13px;color:var(--color-destructive);margin-top:10px;}
.tp-sharemodal-card{border:1px solid var(--color-border);border-radius:11px;padding:13px;margin-top:10px;background:var(--color-background);}
.tp-sharemodal-card.editing{border-color:var(--color-accent);box-shadow:0 0 0 2px var(--color-accent-subtle);}
.tp-sharemodal-card.revoked{opacity:.65;background:var(--color-secondary);}
.tp-sharemodal-cardtop{display:flex;align-items:center;gap:8px;font-size:13px;}
.tp-sharemodal-cardname{font-weight:700;}
.tp-sharemodal-cardmeta{color:var(--color-muted);}
.tp-sharemodal-views{margin-left:auto;font-weight:600;color:var(--color-foreground);}
.tp-sharemodal-badge{font-size:12px;font-weight:600;padding:2px 8px;border-radius:9999px;background:var(--color-accent-subtle);color:var(--color-accent-text);}
.tp-sharemodal-badge.expired{background:var(--color-tertiary);color:var(--color-muted);}
.tp-sharemodal-badge.anon{background:var(--color-accent-subtle);color:var(--color-accent-text);}
.tp-sharemodal-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px;}
.tp-sharemodal-chip{font-size:12px;padding:3px 9px;border-radius:9999px;background:var(--color-secondary);color:var(--color-muted);border:1px solid var(--color-border);}
.tp-sharemodal-exp{font-size:12px;color:var(--color-muted);margin-top:8px;display:flex;align-items:center;gap:5px;}
.tp-sharemodal-exp svg{width:13px;height:13px;}
.tp-sharemodal-acts{display:flex;gap:8px;margin-top:11px;padding-top:11px;border-top:1px solid var(--color-border);flex-wrap:wrap;}
.tp-sharemodal-act{font-size:13px;font-family:inherit;padding:6px 10px;border-radius:7px;border:1px solid var(--color-border);background:var(--color-background);color:var(--color-muted);cursor:pointer;display:inline-flex;align-items:center;gap:4px;}
.tp-sharemodal-act:disabled{opacity:.55;cursor:default;}
.tp-sharemodal-act svg{width:14px;height:14px;}
.tp-sharemodal-act.rotate{color:var(--color-accent-text);border-color:var(--color-accent-bg);}
.tp-sharemodal-act.del{margin-left:auto;color:var(--color-destructive);border-color:var(--color-destructive);}
.tp-sharemodal-editbox{margin-top:10px;padding-top:10px;border-top:1px dashed var(--color-border);}
.tp-sharemodal-editbox .tp-sharemodal-seclabel:first-child{margin-top:0;}
.tp-sharemodal-revhead{display:flex;align-items:center;gap:6px;width:100%;font-size:12px;font-weight:700;color:var(--color-muted);letter-spacing:.04em;margin:18px 0 8px;cursor:pointer;background:none;border:none;font-family:inherit;padding:0;text-align:left;}
.tp-sharemodal-revhead .chev{margin-left:auto;}
.tp-sharemodal-note{font-size:12px;color:var(--color-muted);line-height:1.5;margin-top:14px;}
`;

interface EditState {
  sections: Set<string>;
  expiryKey: string;
  customDate: string;
  anon: boolean;
  label: string;
}

export default function ShareLinkModal({ tripId, open, onClose }: { tripId: string; open: boolean; onClose: () => void }) {
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [created, setCreated] = useState<{ token: string; url: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [sections, setSections] = useState<Set<string>>(new Set(DEFAULT_SECTIONS));
  const [expiryKey, setExpiryKey] = useState('never');
  const [customDate, setCustomDate] = useState('');
  const [anon, setAnon] = useState(false);
  const [label, setLabel] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    listShares(tripId).then(setLinks).catch(() => setError('載入分享連結失敗'));
  }, [tripId]);

  useEffect(() => {
    if (!open) return;
    setCreated(null);
    setQrOpen(false);
    setCopied(false);
    setError(null);
    setSections(new Set(DEFAULT_SECTIONS));
    setExpiryKey('never');
    setCustomDate('');
    setAnon(false);
    setLabel('');
    setEditingId(null);
    setShowRevoked(false);
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

  // QR for the just-created/rotated link (lazy; token stays in the browser).
  useEffect(() => {
    if (!created) {
      setQr(null);
      return;
    }
    let alive = true;
    shareQrDataUrl(`${window.location.origin}${created.url}`)
      .then((d) => alive && setQr(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [created]);

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  const onCreate = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const c = await createShare(tripId, {
        visibleSections: SECTION_ORDER.filter((s) => sections.has(s)),
        expiresAt: expiresAtFor(expiryKey, customDate),
        anonymous: anon,
        label: label.trim(),
      });
      setCreated({ token: c.token, url: c.url });
      setQrOpen(false);
      setCopied(false);
      reload();
    } catch {
      setError('建立失敗，請稍後重試');
    } finally {
      setBusy(false);
    }
  }, [tripId, sections, expiryKey, customDate, anon, label, reload]);

  const absUrl = created ? `${window.location.origin}${created.url}` : '';
  const onCopy = useCallback(async () => {
    if (!absUrl) return;
    try {
      await navigator.clipboard.writeText(absUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }, [absUrl]);
  const onShareNative = useCallback(() => {
    if (!absUrl || !navigator.share) return;
    navigator.share({ title: '行程分享', url: absUrl }).catch(() => undefined);
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

  const startEdit = (l: ShareLinkRow) => {
    setEditingId(l.id);
    setEdit({
      sections: new Set(parseSections(l.visibleSections)),
      expiryKey: l.expiresAt == null ? 'never' : 'custom',
      customDate: l.expiresAt == null ? '' : (() => { const d = new Date(l.expiresAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(), // local date, not UTC (off-by-one in non-UTC tz)
      anon: l.anonymous === 1,
      label: l.label ?? '',
    });
  };
  const saveEdit = useCallback(async () => {
    if (editingId == null || !edit) return;
    await mutate(
      () =>
        updateShare(tripId, editingId, {
          visibleSections: SECTION_ORDER.filter((s) => edit.sections.has(s)),
          expiresAt: expiresAtFor(edit.expiryKey, edit.customDate),
          anonymous: edit.anon,
          label: edit.label.trim(),
        }),
      () => {
        setEditingId(null);
        setEdit(null);
      },
    );
  }, [editingId, edit, tripId, mutate]);

  if (!open) return null;
  const active = links.filter((l) => !l.revokedAt);
  const revoked = links.filter((l) => l.revokedAt);

  return (
    <div className="tp-sharemodal-backdrop" role="presentation" onClick={onClose}>
      <style>{STYLE}</style>
      <div className="tp-sharemodal" role="dialog" aria-modal="true" aria-labelledby="tp-sharemodal-title" onClick={(e) => e.stopPropagation()} data-testid="share-modal">
        <div className="tp-sharemodal-head">
          <h2 id="tp-sharemodal-title">分享這個行程</h2>
          <button type="button" className="tp-sharemodal-x" onClick={onClose} aria-label="關閉">✕</button>
        </div>
        <p className="tp-sharemodal-sub">建立公開連結，對方不用登入就能看（唯讀）。可開多個連結，各自設定。</p>

        <div className="tp-sharemodal-createbox">
          <div className="tp-sharemodal-seclabel">連結名稱（選填）</div>
          <input className="tp-sharemodal-input" placeholder="例：給爸媽 / 給共遊旅伴" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} data-testid="share-label" />
          <div className="tp-sharemodal-seclabel">要公開哪些區塊？</div>
          <div className="tp-sharemodal-pills">
            {SECTION_ORDER.map((s) => (
              <button key={s} type="button" className={`tp-sharemodal-pill${sections.has(s) ? ' on' : ''}`} aria-pressed={sections.has(s)} onClick={() => setSections((p) => toggle(p, s))} data-testid={`share-section-${s}`}>
                {SECTION_LABELS[s]}
              </button>
            ))}
          </div>
          <div className="tp-sharemodal-hint">行程本體（每日景點/交通）一律公開。緊急聯絡與預訂預設關閉（含電話、訂房編號）。</div>
          <div className="tp-sharemodal-seclabel">有效期限</div>
          <div className="tp-sharemodal-seg">
            {EXPIRY_PRESETS.map((p) => (
              <button key={p.k} type="button" className={expiryKey === p.k ? 'on' : ''} aria-pressed={expiryKey === p.k} onClick={() => setExpiryKey(p.k)} data-testid={`share-expiry-${p.k}`}>
                {p.label}
              </button>
            ))}
          </div>
          {expiryKey === 'custom' && (
            <div className="tp-sharemodal-datefield" data-testid="share-custom-date">
              <TripDatePicker value={customDate} onChange={setCustomDate} min={todayStr()} />
            </div>
          )}
          <label className="tp-sharemodal-anon">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} data-testid="share-anon" /> 匿名分享（不顯示我的名字）
          </label>
          <button type="button" className="tp-sharemodal-create" onClick={onCreate} disabled={busy} data-testid="share-create">
            <Icon name="plus" /> 建立分享連結
          </button>
        </div>

        {created && (
          <div className="tp-sharemodal-new" data-testid="share-new-link">
            <div className="tp-sharemodal-new-lbl">新連結（只會顯示這一次，請立即複製或存 QR）</div>
            <div className="tp-sharemodal-urlrow">
              <input className="tp-sharemodal-url" readOnly value={absUrl} onFocus={(e) => e.currentTarget.select()} data-testid="share-url" />
              <button type="button" className="tp-sharemodal-copy" onClick={onCopy} data-testid="share-copy-url">
                <Icon name={copied ? 'check' : 'copy'} /> {copied ? '已複製' : '複製'}
              </button>
            </div>
            <div className="tp-sharemodal-newrow2">
              <button type="button" onClick={() => setQrOpen((v) => !v)} data-testid="share-qr-toggle">
                <Icon name="maximize" /> {qrOpen ? '隱藏 QR' : '顯示 QR'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button type="button" onClick={onShareNative} data-testid="share-native">
                  <Icon name="send" /> 分享…
                </button>
              )}
            </div>
            {qrOpen && qr && (
              <div className="tp-sharemodal-qr">
                <img src={qr} alt="分享連結 QR code" data-testid="share-qr-img" />
              </div>
            )}
          </div>
        )}

        {error && <div className="tp-sharemodal-error">{error}</div>}

        {active.length > 0 && <div className="tp-sharemodal-seclabel">使用中的連結（{active.length}）</div>}
        {active.map((l) => {
          const exp = expiryInfo(l.expiresAt);
          const isActive = !exp.expired;
          const isEditing = editingId === l.id;
          const secs = parseSections(l.visibleSections);
          return (
            <div className={`tp-sharemodal-card${isEditing ? ' editing' : ''}`} key={l.id} data-testid="share-link-row">
              <div className="tp-sharemodal-cardtop">
                {l.label ? <span className="tp-sharemodal-cardname">{l.label}</span> : <span className="tp-sharemodal-cardmeta">建立於 {fmtCreated(l.createdAt)}</span>}
                {l.anonymous === 1 && <span className="tp-sharemodal-badge anon">匿名</span>}
                {exp.expired && <span className="tp-sharemodal-badge expired">已過期</span>}
                <span className="tp-sharemodal-views">{l.viewCount} 次瀏覽</span>
              </div>

              {isEditing && edit ? (
                <div className="tp-sharemodal-editbox" data-testid={`share-edit-${l.id}`}>
                  <div className="tp-sharemodal-seclabel">連結名稱</div>
                  <input className="tp-sharemodal-input" value={edit.label} maxLength={80} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
                  <div className="tp-sharemodal-seclabel">公開區塊（同一網址，不必重新產生）</div>
                  <div className="tp-sharemodal-pills">
                    {SECTION_ORDER.map((s) => (
                      <button key={s} type="button" className={`tp-sharemodal-pill${edit.sections.has(s) ? ' on' : ''}`} aria-pressed={edit.sections.has(s)} onClick={() => setEdit({ ...edit, sections: toggle(edit.sections, s) })}>
                        {SECTION_LABELS[s]}
                      </button>
                    ))}
                  </div>
                  <div className="tp-sharemodal-seclabel">有效期限</div>
                  <div className="tp-sharemodal-seg">
                    {EXPIRY_PRESETS.map((p) => (
                      <button key={p.k} type="button" className={edit.expiryKey === p.k ? 'on' : ''} aria-pressed={edit.expiryKey === p.k} onClick={() => setEdit({ ...edit, expiryKey: p.k })}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {edit.expiryKey === 'custom' && (
                    <div className="tp-sharemodal-datefield">
                      <TripDatePicker value={edit.customDate} onChange={(v) => setEdit({ ...edit, customDate: v })} min={todayStr()} />
                    </div>
                  )}
                  <label className="tp-sharemodal-anon">
                    <input type="checkbox" checked={edit.anon} onChange={(e) => setEdit({ ...edit, anon: e.target.checked })} /> 匿名分享
                  </label>
                  <div className="tp-sharemodal-acts" style={{ borderTop: 'none', paddingTop: 6 }}>
                    <button type="button" className="tp-sharemodal-act rotate" disabled={busy} onClick={saveEdit} data-testid={`share-save-${l.id}`}>儲存</button>
                    <button type="button" className="tp-sharemodal-act" onClick={() => { setEditingId(null); setEdit(null); }}>取消</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="tp-sharemodal-chips">
                    {secs.map((s) => (
                      <span className="tp-sharemodal-chip" key={s}>{SECTION_LABELS[s] ?? s}</span>
                    ))}
                  </div>
                  <div className="tp-sharemodal-exp"><Icon name="clock" /> {exp.text}</div>
                  <div className="tp-sharemodal-acts">
                    {isActive && (
                      <button type="button" className="tp-sharemodal-act" disabled={busy} onClick={() => startEdit(l)} data-testid={`share-edit-btn-${l.id}`}>
                        <Icon name="pencil" /> 編輯
                      </button>
                    )}
                    {isActive && (
                      <button type="button" className="tp-sharemodal-act rotate" disabled={busy} onClick={() => mutate(() => rotateShare(tripId, l.id), (r) => { const rr = r as { token: string; url: string }; setCreated({ token: rr.token, url: rr.url }); setQrOpen(false); setCopied(false); })} data-testid={`share-rotate-${l.id}`}>
                        <Icon name="refresh-cw" /> 重新產生
                      </button>
                    )}
                    {isActive && (
                      <button type="button" className="tp-sharemodal-act" disabled={busy} onClick={() => mutate(() => revokeShare(tripId, l.id))} data-testid={`share-revoke-${l.id}`}>關閉</button>
                    )}
                    <button type="button" className="tp-sharemodal-act del" disabled={busy} onClick={() => mutate(() => deleteShare(tripId, l.id))} data-testid={`share-delete-${l.id}`}>
                      <Icon name="trash" /> 刪除
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}

        {revoked.length > 0 && (
          <>
            <button type="button" className="tp-sharemodal-revhead" onClick={() => setShowRevoked((v) => !v)} aria-expanded={showRevoked} data-testid="share-revoked-toggle">
              已關閉的連結（{revoked.length}）<span className="chev">{showRevoked ? '▴' : '▾'}</span>
            </button>
            {showRevoked &&
              revoked.map((l) => (
                <div className="tp-sharemodal-card revoked" key={l.id} data-testid="share-revoked-row">
                  <div className="tp-sharemodal-cardtop">
                    <span className="tp-sharemodal-cardmeta">{l.label || `建立於 ${fmtCreated(l.createdAt)}`} · 已關閉</span>
                    <span className="tp-sharemodal-views">{l.viewCount} 次瀏覽</span>
                  </div>
                  <div className="tp-sharemodal-acts">
                    <span className="tp-sharemodal-exp" style={{ margin: 0 }}>保留瀏覽統計</span>
                    <button type="button" className="tp-sharemodal-act del" disabled={busy} onClick={() => mutate(() => deleteShare(tripId, l.id))} data-testid={`share-delete-${l.id}`}>
                      <Icon name="trash" /> 刪除
                    </button>
                  </div>
                </div>
              ))}
          </>
        )}

        <div className="tp-sharemodal-note">
          已建立連結的網址無法再次顯示（只存雜湊）；要新網址按「重新產生」（會附 QR）。「編輯」可改公開區塊/期限/名稱而不換網址。「關閉」停用但保留統計，可在「已關閉」區查看或刪除。
        </div>
      </div>
    </div>
  );
}
