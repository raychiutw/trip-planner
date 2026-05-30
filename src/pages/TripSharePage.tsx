/**
 * TripSharePage — `/s/:token` (PUBLIC, no auth).
 *
 * The no-login share view (Variant B「分享封面」, signed off 2026-05-30). Renders the
 * data-driven <TripPrintDocument> (reused, hideHeader) from the section-filtered
 * public payload, wrapped in a terracotta share hero + action bar. Zero edit affordances.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-191308.md
 */
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/shared/Icon';
import TripPrintDocument from '../components/print/TripPrintDocument';
import { renderTripPrintPdf } from '../components/print/renderTripPrintPdf';
import { loadSharePrintData, tripDisplayName, type TripPrintData } from '../lib/tripPrintData';
import { SHARE_CHROME_CSS, PRINT_CSS } from '../lib/tripPrintStyles';

export default function TripSharePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TripPrintData | null>(null);
  const [sharedBy, setSharedBy] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setStatus('loading');
    void (async () => {
      try {
        const res = await loadSharePrintData(token);
        if (!alive) return;
        setData(res.data);
        setSharedBy(res.sharedBy);
        setStatus('ready');
      } catch {
        if (alive) setStatus('notfound');
      }
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const onPdf = useCallback(() => {
    if (!data) return;
    const fileBase = tripDisplayName(data).replace(/[\\/:*?"<>|]/g, '').trim() || '分享行程';
    void renderTripPrintPdf({ data, fileBase });
  }, [data]);

  // PR1: the copy CTA drives the signup/login funnel; PR3 wires the actual one-click
  // clone-to-account after auth (server-side copy of the visible payload).
  const onCopy = useCallback(() => {
    navigate(`/login?redirect_after=${encodeURIComponent(`/s/${token ?? ''}`)}`);
  }, [navigate, token]);

  const name = data ? tripDisplayName(data) : '';
  const meta = data
    ? [data.dateRange, data.destinations, data.days.length ? `${data.days.length} 天` : ''].filter(Boolean).join(' · ')
    : '';

  return (
    <div className="tp-share-page">
      <style>{`${PRINT_CSS}\n${SHARE_CHROME_CSS}`}</style>

      {status === 'notfound' ? (
        <div className="tp-share-state" data-testid="share-notfound">
          <div className="tp-share-state-title">連結已失效</div>
          這個分享連結不存在、已被關閉或已過期。請向分享者索取新的連結。
        </div>
      ) : status === 'loading' || !data ? (
        <div className="tp-share-state" data-testid="share-loading">載入中…</div>
      ) : (
        <>
          <header className="tp-share-hero">
            <div className="tp-share-eyebrow">
              <Icon name="sparkle" />
              {sharedBy ? `由 ${sharedBy} 分享給你` : '有人分享了一份行程給你'}
            </div>
            <div className="tp-share-title" data-testid="share-title">{name}</div>
            {meta && <div className="tp-share-meta">{meta}</div>}
          </header>

          <div className="tp-share-actionbar">
            <button type="button" className="tp-share-ghost" onClick={() => window.print()} title="列印" data-testid="share-print">
              <Icon name="printer" />
            </button>
            <button type="button" className="tp-share-ghost" onClick={onPdf} title="存成 PDF" data-testid="share-pdf">
              <Icon name="download" />
            </button>
            <button type="button" className="tp-share-copy" onClick={onCopy} data-testid="share-copy">
              <Icon name="copy" /> 複製到我的行程
            </button>
          </div>

          <TripPrintDocument data={data} hideHeader />
        </>
      )}
    </div>
  );
}
