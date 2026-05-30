/**
 * tripPrintStyles — CSS for the print document (Variant A), shared by:
 *  - TripPrintPage (`/trip/:id/print`) — injects via <style>
 *  - renderTripPrintPdf — injects into an off-screen container for html2pdf
 *
 * Pure string export (leaf lib, no imports) so both the page and the
 * component-layer PDF renderer can share one source of truth.
 */
export const PRINT_CSS = `
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
  color:#1d1813;padding:46px 52px;font-size:14px;line-height:1.55;
  container-type:inline-size;}
.tp-print-dh{border-bottom:2px solid #1d1813;padding-bottom:14px;margin-bottom:8px;}
.tp-print-name{font-size:25px;font-weight:700;line-height:1.2;}
.tp-print-meta{font-size:13px;color:#5c5248;margin-top:6px;display:flex;gap:14px;flex-wrap:wrap;}
.tp-print-star{color:#9a7b32;font-weight:600;white-space:nowrap;}
.tp-print-empty{color:#5c5248;border:1px dashed #cfc7ba;border-radius:8px;padding:18px 16px;text-align:center;font-size:13px;margin-top:16px;}
.tp-print-day{margin-top:18px;break-inside:avoid;page-break-inside:avoid;}
.tp-print-day-hd{display:flex;align-items:baseline;gap:10px;border-bottom:1.5px solid #1d1813;padding-bottom:4px;margin-bottom:2px;}
.tp-print-day-no{font-size:15px;font-weight:700;}
.tp-print-day-date{font-size:12px;color:#5c5248;}
.tp-print-day-entries{font-size:13px;}
/* responsive entry grid: ≥640px = 3 columns (time | activity | travel); the
   @media screen rule below stacks it on mobile. Print/PDF (A4 wide) stays 3-col. */
.tp-print-entry{display:grid;grid-template-columns:54px 1fr 132px;gap:1px 10px;padding:7px 0;border-bottom:1px solid #efe9df;align-items:start;}
.tp-print-t{font-variant-numeric:tabular-nums;font-weight:600;color:#1d1813;white-space:nowrap;}
.tp-print-title{grid-column:2;font-weight:600;}
.tp-print-alt{grid-column:2;color:#5c5248;font-size:12px;}
.tp-print-note{grid-column:2;color:#5c5248;font-size:12px;}
.tp-print-mv{grid-column:3;grid-row:1;color:#5c5248;font-size:12px;white-space:nowrap;text-align:right;}
.tp-print-hotel{display:flex;gap:8px;align-items:baseline;padding:7px 6px;margin-top:2px;font-size:12px;background:#faf6ee;color:#1d1813;}
.tp-print-hk{font-weight:700;letter-spacing:.05em;white-space:nowrap;}
.tp-print-notes{margin-top:22px;border-top:2px solid #1d1813;padding-top:12px;break-inside:avoid;}
.tp-print-notes-h{font-size:14px;font-weight:700;letter-spacing:.08em;margin:0 0 8px;}
.tp-print-ngrid{display:grid;grid-template-columns:1fr 1fr;gap:4px 26px;}
.tp-print-nsec{break-inside:avoid;page-break-inside:avoid;}
.tp-print-nh{font-size:12px;font-weight:700;color:#1d1813;display:flex;align-items:center;gap:5px;margin:6px 0 2px;}
.tp-print-nh svg{width:13px;height:13px;}
.tp-print-nsec p{margin:0 0 2px;font-size:12px;color:#5c5248;line-height:1.5;}

/* ===== Narrow DOCUMENT (container query, not viewport) =====
   Keys off .tp-print-doc's own width, so it stacks when the *document* is narrow
   (mobile screen ≈ 390px) but NOT when it's the fixed 794px off-screen PDF render
   on a small device, nor the A4 print page. Stack: time + title on the head row,
   alternates/note/travel hang below; notes collapse to one column. */
@container (max-width:640px){
  .tp-print-entry{grid-template-columns:50px 1fr;column-gap:8px;row-gap:1px;padding:9px 0;}
  .tp-print-t{grid-column:1;grid-row:1;}
  .tp-print-title{grid-column:2;grid-row:1;}
  .tp-print-alt,.tp-print-note{grid-column:2;}
  .tp-print-mv{grid-column:2;grid-row:auto;text-align:left;white-space:normal;}
  .tp-print-mv::before{content:"↓ ";}
  .tp-print-ngrid{grid-template-columns:1fr;}
}

@media print {
  .tp-print-page{background:#fff;}
  .tp-print-toolbar{display:none !important;}
  .tp-print-doc{box-shadow:none;margin:0 auto;width:auto;max-width:none;padding:0;}
  @page{size:A4;margin:14mm;}
}
`;

/**
 * PDF override — html2canvas does NOT emulate @media print, so it would capture
 * the on-screen shadow/margins. Strip them for the off-screen PDF render.
 */
export const PRINT_PDF_DOC_CSS = `.tp-print-doc{box-shadow:none;margin:0;width:794px;max-width:none;}`;
