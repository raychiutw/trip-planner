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
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../components/shared/Icon';
import TripPrintDocument from '../components/print/TripPrintDocument';
import ShareLinkModal from '../components/share/ShareLinkModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { loadTripPrintData, type TripPrintData } from '../lib/tripPrintData';
import { PRINT_CSS } from '../lib/tripPrintStyles';

export default function TripPrintPage() {
  useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
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
  }, [tripId]);

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
          onClick={() => window.print()}
          disabled={!data}
          data-testid="trip-print-do"
        >
          <Icon name="printer" /> 列印
        </button>
        <button
          type="button"
          className="tp-print-btn tp-print-btn-ghost"
          onClick={() => setShareOpen(true)}
          disabled={!data}
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

      {tripId && <ShareLinkModal tripId={tripId} open={shareOpen} onClose={() => setShareOpen(false)} />}

      {error ? (
        <div className="tp-print-state" data-testid="trip-print-error">{error}</div>
      ) : !data ? (
        <div className="tp-print-state" data-testid="trip-print-loading">載入中…</div>
      ) : (
        <TripPrintDocument data={data} />
      )}
    </div>
  );
}
