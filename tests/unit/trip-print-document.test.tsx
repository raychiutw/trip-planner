/**
 * PR1 (feat/trip-print-document) — TripPrintDocument render contract.
 * Design: ~/.gstack/projects/raychiutw-trip-planner/ray-master-design-20260530-101432.md
 * Mockup: docs/design-sessions/2026-05-30-trip-print-document.html (Variant A)
 *
 * Locks the core promise: a flat, fully-expanded, data-driven document (no
 * accordion / collapse), including the 5 trip-notes sections, with empty states.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import TripPrintDocument from '../../src/components/print/TripPrintDocument';
import type { TripPrintData } from '../../src/lib/tripPrintData';

const full: TripPrintData = {
  name: '沖繩',
  title: '沖繩 5 天 4 夜',
  destinations: '那霸 · 美麗海',
  dateRange: '2026-07-26 – 2026-07-30',
  days: [
    {
      dayNum: 1,
      date: '2026-07-26',
      dayOfWeek: '六',
      timeline: [
        { time: '09:00', title: '那霸機場', rating: 4.1, travel: { type: 'driving', min: 12, distanceM: 2100 } },
        { time: '10:30', title: '國際通', rating: 4.3, stopPois: [
          { sortOrder: 1, name: '國際通' },
          { sortOrder: 2, name: '牧志公設市場' },
        ] },
      ],
      hotel: { name: '那霸東急 REI', rating: 4.2, note: '含早餐' },
    },
  ],
  notes: {
    flights: [{ airline: 'BR', flightNo: '112', cabinClass: '', departAirport: '桃園', arriveAirport: '那霸', departAt: '08:55', arriveAt: '11:40', note: '' }],
    lodgings: [],
    reservations: [],
    pretripNotes: [{ section: 'docs', title: '證件', content: '國際駕照 + 台灣駕照正本' }],
    emergencyContacts: [],
  },
};

describe('TripPrintDocument', () => {
  it('renders display name via title || name', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByTestId('print-doc-name').textContent).toContain('沖繩 5 天 4 夜');
  });

  it('renders all timeline entries fully expanded (no accordion / collapse)', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByText('那霸機場')).toBeTruthy();
    expect(screen.getByText('國際通')).toBeTruthy();
  });

  it('lists alternate POIs as text (備選)', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByText(/牧志公設市場/)).toBeTruthy();
  });

  it('renders the travel line between entries', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByText(/開車 · 12 分 · 2\.1km/)).toBeTruthy();
  });

  it('renders the per-day hotel', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByText(/那霸東急 REI/)).toBeTruthy();
  });

  it('renders non-empty note sections and OMITS empty ones (no empty heading)', () => {
    render(<TripPrintDocument data={full} />);
    expect(screen.getByTestId('print-note-flights')).toBeTruthy();
    expect(screen.getByTestId('print-note-pretrip')).toBeTruthy();
    expect(screen.queryByTestId('print-note-lodgings')).toBeNull();
    expect(screen.queryByTestId('print-note-reservations')).toBeNull();
    expect(screen.queryByTestId('print-note-emergency')).toBeNull();
  });

  it('shows the 尚無行程 placeholder when 0 days', () => {
    render(<TripPrintDocument data={{ ...full, days: [] }} />);
    expect(screen.getByTestId('print-empty-days')).toBeTruthy();
  });

  it('renders entries as a responsive div-grid, NOT a <table> (RWD)', () => {
    const { container } = render(<TripPrintDocument data={full} />);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('.tp-print-entry')).toBeTruthy();
    // grid cells are divs, not td
    expect(container.querySelector('.tp-print-entry')!.tagName).toBe('DIV');
  });
});

describe('print styles — responsive via container query (doc width, not viewport)', () => {
  it('entry is a 3-col grid that stacks when the DOCUMENT is narrow', () => {
    const css = readFileSync(join(__dirname, '..', '..', 'src/lib/tripPrintStyles.ts'), 'utf8');
    expect(css).toMatch(/\.tp-print-entry\{display:grid;grid-template-columns:54px 1fr 132px/);
    // container query (NOT @media) so the 794px PDF render on a small device stays
    // 3-col while the on-screen ~390px doc stacks.
    expect(css).toMatch(/container-type:inline-size/);
    expect(css).toMatch(/@container \(max-width:640px\)/);
    expect(css).not.toMatch(/@media screen and \(max-width:640px\)/);
    expect(css).toMatch(/\.tp-print-ngrid\{grid-template-columns:1fr;\}/); // notes 1-col when narrow
  });
});
