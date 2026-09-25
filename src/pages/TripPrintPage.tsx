/**
 * TripPrintPage — `/trip/:tripId/print`
 *
 * Full-page, chrome-free print document. Renders <TripPrintDocument> from data
 * (not the live interactive TripPage), so print + PDF never inherit accordion /
 * collapse state. A small no-print toolbar (列印 / 關閉) sits on top.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md
 * Mockup: docs/design-sessions/2026-05-30-trip-print-document.html (Variant A)
 */
import AuthStatus from '../components/shared/AuthStatus';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/shared/Icon';
import TripPrintDocument from '../components/print/TripPrintDocument';
import ShareLinkModal from '../components/share/ShareLinkModal';
import { useBrowserPrint } from '../hooks/useBrowserPrint';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { loadTripPrintData, type TripPrintData } from '../lib/tripPrintData';
import { PRINT_CSS } from '../lib/tripPrintStyles';

export default function TripPrintPage() {
  const auth = useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  return auth.user ? <PrintPreview key={tripId} tripId={tripId} /> : <AuthStatus auth={auth} />;
}

function PrintPreview({tripId}: {tripId: string | undefined}) {
  const navigate = useNavigate();
  const browserPrint = useBrowserPrint();
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<TripPrintData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    let alive = true;
    setData(null);
    setError(null);
    loadTripPrintData(tripId)
      .then((d) => { if (alive) setData(d); })
      .catch(() => { if (alive) setError('行程載入失敗，請稍後重試'); });
    return () => { alive = false; };
  }, [tripId, attempt]);

  // PR14 convention: explicit back URL, never a silent history pop.
  const onClose = useCallback(() => {
    navigate(`/trips?selected=${encodeURIComponent(tripId ?? '')}`);
  }, [navigate, tripId]);

  return (
    <div className="tp-print-page">
      <style>{PRINT_CSS}</style>
      <div className="tp-print-toolbar">
        <span className="tp-print-route">列印預覽</span>
        <button
          type="button"
          className="tp-print-btn tp-print-btn-primary"
          onClick={browserPrint.print}
          disabled={!data || browserPrint.busy}
          data-testid="trip-print-do"
        >
          <Icon name="printer" /> 列印
        </button>
        <button
          type="button"
          className="tp-print-btn tp-print-btn-ghost"
          onClick={() => setShareOpen(true)}
          disabled={!data || browserPrint.busy}
          data-testid="trip-print-share"
        >
          <Icon name="copy" /> 分享連結
        </button>
        <button
          type="button"
          className="tp-print-btn tp-print-btn-ghost"
          onClick={onClose}
          data-testid="trip-print-close"
        >
          關閉
        </button>
      </div>

      {browserPrint.message && <div className="tp-print-feedback" role={browserPrint.error ? 'alert' : 'status'}>{browserPrint.message}</div>}
      {tripId && <ShareLinkModal tripId={tripId} open={shareOpen} onClose={() => setShareOpen(false)} />}

      {error ? (
        <div className="tp-print-state" role="alert" data-testid="trip-print-error">{error} <button type="button" className="tp-print-btn" onClick={() => setAttempt(value => value + 1)}>重新載入列印資料</button></div>
      ) : !data ? (
        <div className="tp-print-state" role="status" data-testid="trip-print-loading">載入中…</div>
      ) : (
        <TripPrintDocument data={data} />
      )}
    </div>
  );
}
