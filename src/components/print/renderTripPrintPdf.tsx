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
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import TripPrintDocument from './TripPrintDocument';
import { loadTripPrintData, type TripPrintData } from '../../lib/tripPrintData';
import { PRINT_CSS, PRINT_PDF_DOC_CSS } from '../../lib/tripPrintStyles';
import { tripFileBase } from '../../lib/tripExport';
import type { Trip } from '../../types/trip';

/** html2canvas can hang (canvas/render deadlock) without ever rejecting — cap it. */
const PDF_TIMEOUT_MS = 30000;

/** ponytail: one export per browser; use per-job rendering isolation if parallel exports become necessary. */
let pdfInFlight = false;

export async function renderTripPrintPdf(opts: {
  tripId?: string;
  trip?: Trip | null;
  data?: TripPrintData;
  fileBase?: string;
  onProgress?: (stage: 'preparing' | 'rendering') => void;
}): Promise<void> {
  if (pdfInFlight) throw new Error('另一份 PDF 正在產生，請稍後再試');
  pdfInFlight = true;
  const controller = new AbortController();
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;
  let style: HTMLStyleElement | undefined;
  let overlay: HTMLElement | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    try { root?.unmount(); } finally {
      root = undefined;
      container?.remove(); style?.remove(); overlay?.remove();
    }
  };
  let renewDeadline: () => void;
  const deadline = new Promise<never>((_, reject) => {
    renewDeadline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const error = new Error('PDF 產生逾時，請重試');
        controller.abort(error); reject(error);
      }, PDF_TIMEOUT_MS);
    };
    renewDeadline();
  });
  const work = async () => {
    try {
      opts.onProgress?.('preparing');
      if (!opts.data && !opts.tripId) throw new Error('需要行程資料才能輸出 PDF');
      const data = opts.data ?? await loadTripPrintData(opts.tripId!, controller.signal);
      controller.signal.throwIfAborted();
      const html2pdf = (await import('html2pdf.js')).default;
      controller.signal.throwIfAborted();
      style = document.createElement('style');
      style.setAttribute('data-trip-pdf', '');
      style.textContent = `${PRINT_CSS}\n${PRINT_PDF_DOC_CSS}`;
      container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:794px;background:#fff';
      document.head.appendChild(style);
      document.body.appendChild(container);
      root = createRoot(container);
      flushSync(() => root!.render(createElement(TripPrintDocument, {data})));
      await new Promise(resolve => setTimeout(resolve, 50));
      controller.signal.throwIfAborted();
      const target = (container.querySelector('.tp-print-doc') as HTMLElement) ?? container;
      target.setAttribute('data-trip-pdf-document', '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const worker = (html2pdf as any)().set({
        margin: [10, 10, 10, 10],
        filename: `${opts.fileBase ?? tripFileBase(opts.trip ?? null)}.pdf`,
        image: {type: 'jpeg', quality: 0.92},
        html2canvas: {scale: 2, useCORS: true, windowWidth: 794, windowHeight: container.scrollHeight || undefined},
        jsPDF: {unit: 'mm', format: 'a4', orientation: 'portrait'},
        pagebreak: {mode: ['css', 'legacy']},
      }).from(target);
      // Rendering is separate from download: an obsolete renderer must never save.
      await worker.toContainer();
      overlay = await worker.get('overlay');
      controller.signal.throwIfAborted();
      const rendered = await worker.get('container') as HTMLElement;
      const pageSize = await worker.get('pageSize') as {inner: {px: {height: number}}};
      const pageHeight = pageSize.inner.px.height;
      const totalHeight = Math.max(pageHeight, rendered.scrollHeight);
      opts.onProgress?.('rendering');
      // Bound canvas memory to one A4 page, regardless of total trip length.
      for (let y = 0; y < totalHeight; y += pageHeight) {
        controller.signal.throwIfAborted();
        renewDeadline!();
        if (y > 0) {
          const pdf = await worker.get('pdf');
          pdf.addPage();
          await worker.toContainer();
          overlay = await worker.get('overlay');
          controller.signal.throwIfAborted();
        }
        await worker.set({canvas: null, html2canvas: {
          scale: 2, useCORS: true, windowWidth: 794,
          height: Math.min(pageHeight, totalHeight - y), y,
        }}).toPdf();
      }
      controller.signal.throwIfAborted();
      await worker.save();
    } finally { cleanup(); }
  };
  try {
    await Promise.race([work(), deadline]);
  } finally {
    clearTimeout(timer);
    pdfInFlight = false;
    cleanup();
  }
}
