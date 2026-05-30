/**
 * renderTripPrintPdf — PDF export via the data-driven print document.
 *
 * Renders <TripPrintDocument> into an OFF-SCREEN but ATTACHED container
 * (html2canvas needs real layout) and feeds it to html2pdf — instead of the old
 * `#tripContent` capture, which inherited the live timeline's accordion/collapse
 * state. Lives in the component layer (imports a component); lib stays a leaf.
 *
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md (PR2)
 */
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import TripPrintDocument from './TripPrintDocument';
import { loadTripPrintData } from '../../lib/tripPrintData';
import { PRINT_CSS, PRINT_PDF_DOC_CSS } from '../../lib/tripPrintStyles';
import { tripFileBase } from '../../lib/tripExport';
import type { Trip } from '../../types/trip';

/** html2canvas can hang (canvas/render deadlock) without ever rejecting — cap it. */
const PDF_TIMEOUT_MS = 30000;

/** In-flight guard: a second click is a no-op until the first run finishes, so
 *  concurrent runs can't accumulate <style data-trip-pdf> / container nodes. */
let pdfInFlight = false;

export async function renderTripPrintPdf(opts: { tripId: string; trip: Trip | null }): Promise<void> {
  if (pdfInFlight) return;
  pdfInFlight = true;
  const { tripId, trip } = opts;
  try {
    const data = await loadTripPrintData(tripId);
    const html2pdf = (await import('html2pdf.js')).default;

    // Off-screen attached container — html2canvas cannot measure a detached node.
    const style = document.createElement('style');
    style.setAttribute('data-trip-pdf', '');
    style.textContent = `${PRINT_CSS}\n${PRINT_PDF_DOC_CSS}`;
    const container = document.createElement('div');
    container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff';
    document.head.appendChild(style);
    document.body.appendChild(container);

    const root = createRoot(container);
    try {
      // flushSync forces a synchronous commit so the DOM is laid out before snapshot.
      flushSync(() => {
        root.render(createElement(TripPrintDocument, { data }));
      });
      // Small settle for font/layout finalization before html2canvas rasterizes.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const target = (container.querySelector('.tp-print-doc') as HTMLElement) ?? container;
      // The print document is text + inline SVG only (no <img>), so useCORS is a
      // harmless default — there are no cross-origin images that could taint the canvas.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfRun = (html2pdf as any)()
        .set({
          margin: [10, 10, 10, 10],
          filename: `${tripFileBase(trip)}.pdf`,
          image: { type: 'jpeg', quality: 0.92 },
          html2canvas: { scale: 2, useCORS: true, windowWidth: 794, windowHeight: container.scrollHeight || undefined },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(target)
        .save();
      await Promise.race([
        pdfRun,
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF 產生逾時')), PDF_TIMEOUT_MS)),
      ]);
    } finally {
      root.unmount();
      container.remove();
      style.remove();
    }
  } finally {
    pdfInFlight = false;
  }
}
