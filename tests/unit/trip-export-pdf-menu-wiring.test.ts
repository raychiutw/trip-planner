/**
 * PR2 — PDF re-source + export menu wiring (source grep).
 *
 * Locks: PDF now renders the data-driven TripPrintDocument off-screen (NOT the
 * live #tripContent), TripPage dispatches json→lib / pdf→renderTripPrintPdf, and
 * the export menu has only PDF + JSON (CSV + Markdown removed).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const PDF = read('src/components/print/renderTripPrintPdf.tsx');
const TRIP_PAGE = read('src/pages/TripPage.tsx');
const LIST = read('src/pages/TripsListPage.tsx');

describe('renderTripPrintPdf — data-driven, not #tripContent', () => {
  it('renders TripPrintDocument from loadTripPrintData (not the live DOM)', () => {
    expect(PDF).toMatch(/import TripPrintDocument/);
    expect(PDF).toMatch(/loadTripPrintData/);
    expect(PDF).not.toContain("getElementById('tripContent')");
  });
  it('uses an off-screen ATTACHED container (html2canvas needs layout)', () => {
    expect(PDF).toContain('left:-9999px');
    expect(PDF).toMatch(/document\.body\.appendChild\(container\)/);
  });
  it('commits synchronously via flushSync before html2pdf snapshots', () => {
    expect(PDF).toMatch(/flushSync/);
  });
  it('cleans up: unmount + remove container + remove style', () => {
    expect(PDF).toMatch(/root\.unmount\(\)/);
    expect(PDF).toMatch(/container\.remove\(\)/);
    expect(PDF).toMatch(/style\.remove\(\)/);
  });
  it('still lazy-imports html2pdf', () => {
    expect(PDF).toContain("await import('html2pdf.js')");
  });
  it('guards against concurrent runs (no node accumulation) + caps a hung render', () => {
    expect(PDF).toMatch(/pdfInFlight/);
    expect(PDF).toMatch(/Promise\.race/);
  });
});

describe('TripPage — download dispatch (json via lib, pdf via print doc)', () => {
  it('json → downloadTripJson, pdf → renderTripPrintPdf', () => {
    expect(TRIP_PAGE).toMatch(/downloadTripJson\(/);
    expect(TRIP_PAGE).toMatch(/renderTripPrintPdf\(/);
  });
  it('no longer imports the old downloadTripFormat', () => {
    expect(TRIP_PAGE).not.toMatch(/downloadTripFormat/);
  });
  it('triggerDownload narrowed to pdf | json', () => {
    expect(TRIP_PAGE).toMatch(/triggerDownload: \(format: 'pdf' \| 'json'\)/);
  });
});

describe('export menu — only PDF + JSON (CSV + Markdown removed)', () => {
  it('no Markdown or CSV triggers', () => {
    expect(LIST).not.toContain("triggerDownload('md')");
    expect(LIST).not.toContain("triggerDownload('csv')");
    expect(LIST).not.toMatch(/<span>Markdown<\/span>/);
    expect(LIST).not.toMatch(/<span>CSV<\/span>/);
  });
  it('keeps PDF + JSON triggers', () => {
    expect(LIST).toContain("triggerDownload('pdf')");
    expect(LIST).toContain("triggerDownload('json')");
  });
});
