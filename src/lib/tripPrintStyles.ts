/**
 * tripPrintStyles — CSS for the print document (Variant A), shared by:
 *  - TripPrintPage (`/trip/:id/print`) — injects via <style>
 *  - renderTripPrintPdf — injects into an off-screen container for html2pdf
 *
 * Pure string export (leaf lib, no imports) so both the page and the
 * component-layer PDF renderer can share one source of truth.
 */
export const PRINT_CSS = `
/* The print preview is always LIGHT (the document is white paper) — use fixed
   colors, not dark-mode tokens, so the chrome doesn't flip in dark mode (which
   made the ghost 關閉 button white-on-light = invisible). */
.tp-print-page{min-height:100vh;background:#e6e3dd;color:#1d1813;}
.tp-print-toolbar{position:sticky;top:0;z-index:10;display:flex;align-items:center;gap:8px;
  background:#faf4ea;border-bottom:1px solid #eadfcf;
  padding:10px 16px;}
.tp-print-toolbar .tp-print-route{font-size:13px;font-weight:600;color:#6f5a47;margin-right:auto;}
.tp-print-btn{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600;
  font-family:inherit;border-radius:8px;padding:8px 14px;border:1px solid transparent;cursor:pointer;min-height:40px;}
.tp-print-btn svg{width:16px;height:16px;}
.tp-print-btn-primary{background:#A97A4A;color:#fff;}
.tp-print-btn-ghost{background:#fff;color:#1d1813;border-color:#eadfcf;}
.tp-print-state{padding:64px 24px;text-align:center;color:#6f5a47;font-size:15px;}

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
.tp-print-entry{display:grid;grid-template-columns:80px 1fr 132px;gap:1px 10px;padding:7px 0;border-bottom:1px solid #efe9df;align-items:start;}
.tp-print-t{font-variant-numeric:tabular-nums;font-weight:600;color:#1d1813;white-space:nowrap;}
.tp-print-title{grid-column:2;font-weight:600;}
.tp-print-alt{grid-column:2;color:#5c5248;font-size:12px;}
.tp-print-note{grid-column:2;color:#5c5248;font-size:12px;}
.tp-print-mv{grid-column:3;grid-row:1;color:#5c5248;font-size:12px;white-space:nowrap;text-align:right;}
.tp-print-hotel{display:flex;gap:8px;align-items:baseline;padding:7px 6px;margin-top:2px;font-size:12px;background:#faf6ee;color:#1d1813;}
.tp-print-hk{font-weight:700;letter-spacing:.05em;white-space:nowrap;}
.tp-print-notes{margin-top:22px;border-top:2px solid #1d1813;padding-top:12px;}
.tp-print-notes-h{font-size:14px;font-weight:700;letter-spacing:.08em;margin:0 0 8px;}
/* single-column chapter flow — each section reads as a distinct 章節 */
.tp-print-ngrid{display:grid;grid-template-columns:1fr;}
.tp-print-nsec{margin-bottom:4px;}
/* section = chapter: prominent header + divider line + count badge */
.tp-print-nh{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;letter-spacing:.03em;color:#1d1813;border-bottom:1.5px solid #1d1813;padding-bottom:4px;margin:14px 0 6px;break-inside:avoid;}
.tp-print-nh svg{width:15px;height:15px;}
.tp-print-nh-cnt{margin-left:auto;font-size:11px;font-weight:600;color:#8a7a68;letter-spacing:0;}
/* block = note item separated by a hairline (last in a chapter has none) */
.tp-print-note-item{padding:6px 0;border-bottom:1px solid #efe9df;break-inside:avoid;}
.tp-print-nsec .tp-print-note-item:last-child{border-bottom:none;}
.tp-print-note-t{font-weight:700;color:#1d1813;font-size:12.5px;margin-bottom:2px;}
/* pre-line keeps the content's own line breaks (e.g. "- a\n- b" bullets) */
.tp-print-note-b{white-space:pre-line;color:#5c5248;font-size:12px;line-height:1.55;}

/* ===== Narrow DOCUMENT (container query, not viewport) =====
   Keys off .tp-print-doc's own width, so it stacks when the *document* is narrow
   (mobile screen ≈ 390px) but NOT when it's the fixed 794px off-screen PDF render
   on a small device, nor the A4 print page. Stack: time + title on the head row,
   alternates/note/travel hang below; notes collapse to one column. */
@container (max-width:640px){
  .tp-print-entry{grid-template-columns:80px 1fr;column-gap:8px;row-gap:1px;padding:9px 0;}
  .tp-print-t{grid-column:1;grid-row:1;}
  .tp-print-title{grid-column:2;grid-row:1;}
  /* body content (備選/note/travel) goes FULL-WIDTH LEFT — single column, not
     indented under the time gutter. */
  .tp-print-alt,.tp-print-note{grid-column:1 / -1;}
  .tp-print-mv{grid-column:1 / -1;grid-row:auto;text-align:left;white-space:normal;}
  .tp-print-mv::before{content:"↓ ";}
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

/**
 * SHARE_CHROME_CSS — public share page (Variant B「分享封面」, signed off 2026-05-30).
 * Reuses PRINT_CSS for the document sheet; adds the terracotta hero + sticky action
 * bar. Fixed-light (the document is white paper) so it never flips in dark mode.
 */
export const SHARE_CHROME_CSS = `
.tp-share-page{min-height:100vh;background:#e6e3dd;color:#1d1813;}
.tp-share-hero{background:linear-gradient(135deg,#A97A4A,#C49A6E);color:#fff;padding:26px 20px 20px;}
.tp-share-eyebrow{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:600;opacity:.93;margin-bottom:8px;}
.tp-share-eyebrow svg{width:15px;height:15px;}
.tp-share-title{font-size:26px;font-weight:700;line-height:1.18;}
.tp-share-meta{font-size:13px;opacity:.95;margin-top:8px;}
.tp-share-actionbar{position:sticky;top:0;z-index:10;display:flex;gap:8px;
  background:#faf4ea;border-bottom:1px solid #eadfcf;padding:9px 14px;}
.tp-share-ghost{flex:0 0 auto;min-height:38px;width:44px;border-radius:8px;border:1px solid #eadfcf;
  background:#fff;color:#1d1813;display:grid;place-items:center;cursor:pointer;font-family:inherit;}
.tp-share-ghost svg{width:18px;height:18px;}
.tp-share-copy{flex:1;min-height:38px;border-radius:8px;background:#A97A4A;color:#fff;border:none;
  font-weight:600;font-size:14px;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;}
.tp-share-copy:hover{background:#8A6038;}
.tp-share-copy svg{width:16px;height:16px;}
.tp-share-state{padding:72px 24px;text-align:center;color:#6f5a47;font-size:15px;line-height:1.6;}
.tp-share-state-title{font-size:18px;font-weight:700;color:#1d1813;margin-bottom:8px;}
.tp-share-error{padding:10px 16px;text-align:center;color:#b3261e;font-size:14px;}
/* Align hero + action bar to the document column (the sheet is 794px centered).
   On mobile (<794) these are full-width no-ops; on desktop they center to match
   the sheet instead of stretching full-bleed (hero「太寬」fix). doc margin-top:0
   so hero → action bar → sheet read as one connected card. */
.tp-share-hero,.tp-share-actionbar{max-width:794px;margin-left:auto;margin-right:auto;width:100%;}
.tp-share-page .tp-print-doc{margin-top:0;}
@media (min-width:834px){ .tp-share-hero{margin-top:18px;border-radius:12px 12px 0 0;} }
@media print { .tp-share-hero,.tp-share-actionbar{display:none !important;} .tp-share-page{background:#fff;} }
`;
