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
import { useRequireAuth } from '../hooks/useRequireAuth';
import { loadTripPrintData, type TripPrintData } from '../lib/tripPrintData';

const PRINT_CSS = `
.tp-print-page{min-height:100vh;background:#e6e3dd;color:var(--color-foreground);}
.tp-print-toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:8px;
  background:var(--color-secondary);border-bottom:1px solid var(--color-border);
  padding:10px 16px;}
.tp-print-toolbar .tp-print-route{font-size:13px;font-weight:600;color:var(--color-muted);margin-right:auto;}
.tp-print-btn{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;
  font-family:inherit;border-radius:8px;padding:8px 14px;border:1px solid transparent;cursor:pointer;min-height:40px;}
.tp-print-btn svg{width:16px;height:16px;}
.tp-print-btn-primary{background:var(--color-accent);color:var(--color-accent-foreground);}
.tp-print-btn-ghost{background:#fff;color:var(--color-foreground);border-color:var(--color-border);}
.tp-print-state{padding:64px 24px;text-align:center;color:var(--color-muted);font-size:15px;}

/* ===== the document sheet (Variant A) ===== */
.tp-print-doc{background:#fff;width:794px;max-width:100%;margin:18px auto;
  box-shadow:0 6px 24px rgba(42,31,24,.16),0 1px 3px rgba(42,31,24,.1);
  color:#1d1813;padding:46px 52px;font-size:14px;line-height:1.55;}
.tp-print-dh{border-bottom:2px solid #1d1813;padding-bottom:14px;margin-bottom:8px;}
.tp-print-name{font-size:25px;font-weight:700;line-height:1.2;}
.tp-print-meta{font-size:13px;color:#5c5248;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;}
.tp-print-star{color:#9a7b32;font-weight:600;white-space:nowrap;}
.tp-print-empty{color:#5c5248;border:1px dashed #cfc7ba;border-radius:8px;padding:18px 16px;text-align:center;font-size:13px;margin-top:16px;}
.tp-print-day{margin-top:18px;break-inside:avoid;page-break-inside:avoid;}
.tp-print-day-hd{display:flex;align-items:baseline;gap:10px;border-bottom:1.5px solid #1d1813;padding-bottom:4px;margin-bottom:2px;}
.tp-print-day-no{font-size:15px;font-weight:700;}
.tp-print-day-date{font-size:12px;color:#5c5248;}
.tp-print-table{width:100%;border-collapse:collapse;font-size:13px;}
.tp-print-table td{padding:7px 8px 7px 0;vertical-align:top;border-bottom:1px solid #efe9df;}
.tp-print-t{width:52px;font-variant-numeric:tabular-nums;font-weight:600;color:#1d1813;white-space:nowrap;}
.tp-print-act .tp-print-title{font-weight:600;}
.tp-print-alt{color:#5c5248;font-size:12px;margin-top:1px;}
.tp-print-note{color:#5c5248;font-size:12px;margin-top:2px;}
.tp-print-mv{width:120px;color:#5c5248;font-size:12px;white-space:nowrap;text-align:right;}
.tp-print-hotel-row td{border-bottom:none;padding-top:6px;color:#1d1813;font-size:12px;background:#faf6ee;}
.tp-print-hk{font-weight:700;letter-spacing:.05em;}
.tp-print-notes{margin-top:22px;border-top:2px solid #1d1813;padding-top:12px;break-inside:avoid;}
.tp-print-notes-h{font-size:14px;font-weight:700;letter-spacing:.08em;margin:0 0 8px;}
.tp-print-ngrid{display:grid;grid-template-columns:1fr 1fr;gap:4px 26px;}
.tp-print-nsec{break-inside:avoid;page-break-inside:avoid;}
.tp-print-nh{font-size:12px;font-weight:700;color:#1d1813;display:flex;align-items:center;gap:5px;margin:6px 0 2px;}
.tp-print-nh svg{width:13px;height:13px;}
.tp-print-nsec p{margin:0 0 2px;font-size:12px;color:#5c5248;line-height:1.5;}

@media print {
  .tp-print-page{background:#fff;}
  .tp-print-toolbar{display:none !important;}
  .tp-print-doc{box-shadow:none;margin:0 auto;width:auto;max-width:none;padding:0;}
  @page{size:A4;margin:14mm;}
}
`;

export default function TripPrintPage() {
  useRequireAuth();
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TripPrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          onClick={onClose}
          data-testid="trip-print-close"
        >
          關閉
        </button>
      </div>

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
