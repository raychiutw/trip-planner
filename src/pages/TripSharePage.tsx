/**
 * TripSharePage — `/s/:token` (PUBLIC, no auth).
 *
 * The no-login share view (Variant B「分享封面」, signed off 2026-05-30). Renders the
 * data-driven <TripPrintDocument> (reused, hideHeader) from the section-filtered
 * public payload, wrapped in a terracotta share hero + action bar. Zero edit affordances.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-191308.md
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/shared/Icon';
import TripPrintDocument from '../components/print/TripPrintDocument';
import { renderTripPrintPdf } from '../components/print/renderTripPrintPdf';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { ApiError } from '../lib/errors';
import { cloneShare } from '../lib/shareApi';
import { loadSharePrintData, tripDisplayName, type TripPrintData } from '../lib/tripPrintData';
import { SHARE_CHROME_CSS, PRINT_CSS } from '../lib/tripPrintStyles';

export default function TripSharePage() {
  const { token } = useParams<{ token: string }>();
  return <ShareReader key={token} token={token} />;
}

// A different share is a different reader lifetime, including its clone action.
function ShareReader({token}: {token: string | undefined}) {
  const navigate = useNavigate();
  const { user } = useCurrentUser();
  const [data, setData] = useState<TripPrintData | null>(null);
  const [sharedBy, setSharedBy] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const active = useRef(true);
  const cloneFlight = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const [cloning, setCloning] = useState(false);
  const [cloneErr, setCloneErr] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('notfound'); return; }
    let alive = true;
    setStatus('loading');
    void (async () => {
      try {
        const res = await loadSharePrintData(token);
        if (!alive) return;
        setData(res.data);
        setSharedBy(res.sharedBy);
        setStatus('ready');
      } catch (error) {
        if (alive) setStatus(error instanceof ApiError && [404, 410].includes(error.status) ? 'notfound' : 'error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, attempt]);

  const onPdf = useCallback(() => {
    if (!data) return;
    const fileBase = tripDisplayName(data).replace(/[\\/:*?"<>|]/g, '').trim() || '分享行程';
    void renderTripPrintPdf({ data, fileBase });
  }, [data]);

  // Logged in → clone the visible payload server-side into the caller's account, then
  // open the new trip. Logged out → send to login (redirect back to keep the funnel).
  const onCopy = useCallback(async () => {
    if (!token || user === undefined || cloneFlight.current) return;
    if (!user) {
      navigate(`/login?redirect_after=${encodeURIComponent(`/s/${token}`)}`);
      return;
    }
    cloneFlight.current = true;
    setCloning(true);
    setCloneErr(false);
    try {
      const { tripId } = await cloneShare(token);
      if (active.current) navigate(`/trips?selected=${encodeURIComponent(tripId)}`);
    } catch {
      if (active.current) setCloneErr(true);
    } finally {
      cloneFlight.current = false;
      if (active.current) setCloning(false);
    }
  }, [navigate, token, user]);

  const name = data ? tripDisplayName(data) : '';
  const meta = data
    ? [data.dateRange, data.destinations, data.days.length ? `${data.days.length} 天` : ''].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="tp-share-page">
      <style>{`${PRINT_CSS}\n${SHARE_CHROME_CSS}`}</style>

      {status === 'notfound' ? (
        <div className="tp-share-state" data-testid="share-notfound">
          <h1 className="tp-share-state-title">連結已失效</h1>
          這個分享連結不存在、已被關閉或已過期。請向分享者索取新的連結。
        </div>
      ) : status === 'error' ? (
        <div className="tp-share-state" role="alert">
          <h1 className="tp-share-state-title">暫時無法載入分享</h1>
          <p>請檢查連線後再試一次。</p>
          <button type="button" className="tp-share-copy" onClick={() => setAttempt(value => value + 1)}>重新載入分享</button>
        </div>
      ) : status === 'loading' || !data ? (
        <div className="tp-share-state" role="status" data-testid="share-loading">載入中…</div>
      ) : (
        <>
          <header className="tp-share-hero">
            <div className="tp-share-eyebrow">
              <Icon name="sparkle" />
              {sharedBy ? `由 ${sharedBy} 分享給你` : '有人分享了一份行程給你'}
            </div>
            <h1 className="tp-share-title" data-testid="share-title">{name}</h1>
            {meta && <div className="tp-share-meta">{meta}</div>}
          </header>

          <div className="tp-share-actionbar">
            <button type="button" className="tp-share-ghost" onClick={() => window.print()} title="列印" data-testid="share-print">
              <Icon name="printer" />
            </button>
            <button type="button" className="tp-share-ghost" onClick={onPdf} title="存成 PDF" data-testid="share-pdf">
              <Icon name="download" />
            </button>
            <button type="button" className="tp-share-copy" onClick={onCopy} disabled={cloning || user === undefined} data-testid="share-copy">
              <Icon name="copy" /> {cloning ? '複製中…' : '複製到我的行程'}
            </button>
          </div>
          {cloneErr && (
            <div className="tp-share-error" role="alert">
              複製失敗，請稍後再試。
            </div>
          )}

          <TripPrintDocument data={data} hideHeader />
        </>
      )}
    </div>
  );
}
