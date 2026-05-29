/**
 * Batch unit test — Lodgings / Reservations / Pretrip / Emergency section coverage
 * v2.34.x 行程筆記 PR16
 *
 * Each section's core flow: empty / add / kind enum / display / ConfirmModal title.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LodgingsSection, { type TripLodging } from '../../src/components/trip-notes/LodgingsSection';
import ReservationsSection, { type TripReservation } from '../../src/components/trip-notes/ReservationsSection';
import PretripSection, { type TripPretripNote } from '../../src/components/trip-notes/PretripSection';
import EmergencySection, { type TripEmergencyContact } from '../../src/components/trip-notes/EmergencySection';

const apiFetchMock = vi.fn();
vi.mock('../../src/lib/apiClient', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}));

function withRouter(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

beforeEach(() => {
  apiFetchMock.mockReset();
  cleanup();
});

// ============================================================
// LodgingsSection
// ============================================================
function mkLodging(over: Partial<TripLodging> = {}): TripLodging {
  return {
    id: 1, sortOrder: 0, name: 'Naha Hotel', address: '沖繩縣那霸市', checkInAt: '2026-07-26T15:00',
    checkOutAt: '2026-07-28T11:00', bookingNo: 'BK-7281', phone: '', note: '', dayIds: [], version: 0,
    ...over,
  };
}

describe('LodgingsSection', () => {
  it('0 items → only 加住宿 button', () => {
    render(withRouter(<LodgingsSection tripId="trip-1" items={[]} onChange={vi.fn()} />));
    expect(screen.getByTestId('lodging-add-btn')).toBeInTheDocument();
  });

  it('display row with booking chip + address', () => {
    render(withRouter(<LodgingsSection tripId="trip-1" items={[mkLodging()]} onChange={vi.fn()} />));
    const row = screen.getByTestId('lodging-row-1');
    expect(row.textContent).toContain('Naha Hotel');
    expect(row.textContent).toContain('BK-7281');
    expect(row.textContent).toContain('沖繩縣那霸市');
  });

  it('Add → POST /lodgings + onChange + edit mode', async () => {
    const onChange = vi.fn();
    const created = mkLodging({ id: 99, name: '' });
    apiFetchMock.mockResolvedValue(created);
    render(withRouter(<LodgingsSection tripId="trip-1" items={[]} onChange={onChange} />));
    fireEvent.click(screen.getByTestId('lodging-add-btn'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/lodgings');
    expect(onChange).toHaveBeenCalledWith([created]);
  });

  it('Trash → ConfirmModal「刪除住宿？」', () => {
    render(withRouter(<LodgingsSection tripId="trip-1" items={[mkLodging()]} onChange={vi.fn()} />));
    const btns = screen.getAllByTestId('lodging-delete-1');
    fireEvent.click(btns[0]);
    expect(screen.getByText(/刪除住宿/)).toBeInTheDocument();
  });
});

// ============================================================
// ReservationsSection
// ============================================================
function mkReservation(over: Partial<TripReservation> = {}): TripReservation {
  return {
    id: 1, sortOrder: 0, kind: 'restaurant', title: 'そば処 鶴亀庵',
    reservedAt: '2026-07-28T12:00', partySize: 4, reservationNo: 'R-9182', phone: '', note: '', version: 0,
    ...over,
  };
}

describe('ReservationsSection', () => {
  it('display row with kind chip + title + 人數', () => {
    render(<ReservationsSection tripId="trip-1" items={[mkReservation()]} onChange={vi.fn()} />);
    const row = screen.getByTestId('reservation-row-1');
    expect(row.textContent).toContain('餐廳');
    expect(row.textContent).toContain('そば処 鶴亀庵');
    expect(row.textContent).toContain('4 人');
  });

  it('kind enum 5 種正確 label', () => {
    const kinds: TripReservation['kind'][] = ['restaurant', 'experience', 'ticket', 'transport', 'other'];
    const labels = ['餐廳', '體驗', '門票', '交通', '其他'];
    for (let i = 0; i < kinds.length; i++) {
      cleanup();
      render(<ReservationsSection tripId="trip-1" items={[mkReservation({ kind: kinds[i] })]} onChange={vi.fn()} />);
      expect(screen.getByTestId('reservation-row-1').textContent).toContain(labels[i]);
    }
  });

  it('Edit → PATCH with field + expectedVersion', async () => {
    const onChange = vi.fn();
    apiFetchMock.mockResolvedValue(mkReservation({ title: 'updated', version: 1 }));
    render(<ReservationsSection tripId="trip-1" items={[mkReservation()]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('reservation-row-1').querySelector('.tp-notes-reservation-body')!);
    const input = screen.getByTestId('reservation-input-title-1');
    fireEvent.change(input, { target: { value: 'updated' } });
    fireEvent.blur(input);
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    const init = apiFetchMock.mock.calls[0][1] as any;
    const body = JSON.parse(init.body);
    expect(body.title).toBe('updated');
    expect(body.expectedVersion).toBe(0);
  });
});

// ============================================================
// PretripSection
// ============================================================
function mkPretrip(over: Partial<TripPretripNote> = {}): TripPretripNote {
  return {
    id: 1, sortOrder: 0, section: '貨幣', title: '貨幣 — 1 TWD ≈ 4.8 JPY',
    content: '- ATM 手續費', aiGenerated: 0, aiSource: null, version: 0,
    ...over,
  };
}

describe('PretripSection', () => {
  it('display row with section chip + title + content', () => {
    render(<PretripSection tripId="trip-1" items={[mkPretrip()]} onChange={vi.fn()} />);
    const row = screen.getByTestId('pretrip-row-1');
    expect(row.textContent).toContain('貨幣');
    expect(row.textContent).toContain('1 TWD ≈ 4.8 JPY');
    expect(row.textContent).toContain('ATM');
  });

  it('AI generated row shows AI 建議 chip', () => {
    render(<PretripSection tripId="trip-1" items={[mkPretrip({ aiGenerated: 1 })]} onChange={vi.fn()} />);
    expect(screen.getByTestId('pretrip-row-1').textContent).toContain('AI 建議');
  });

  it('manual row does NOT show AI chip', () => {
    render(<PretripSection tripId="trip-1" items={[mkPretrip({ aiGenerated: 0 })]} onChange={vi.fn()} />);
    expect(screen.getByTestId('pretrip-row-1').textContent).not.toContain('AI 建議');
  });

  it('Add → POST /pretrip + onChange', async () => {
    const onChange = vi.fn();
    const created = mkPretrip({ id: 99, title: '' });
    apiFetchMock.mockResolvedValue(created);
    render(<PretripSection tripId="trip-1" items={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('pretrip-add-btn'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/pretrip');
    expect(onChange).toHaveBeenCalledWith([created]);
  });
});

// ============================================================
// EmergencySection
// ============================================================
function mkEmergency(over: Partial<TripEmergencyContact> = {}): TripEmergencyContact {
  return {
    id: 1, sortOrder: 0, name: '日本警察', relationship: '報案',
    phone: '110', email: '', kind: 'police', aiGenerated: 0, version: 0,
    ...over,
  };
}

describe('EmergencySection', () => {
  it('display row with name + kind icon + phone button', () => {
    render(<EmergencySection tripId="trip-1" items={[mkEmergency()]} onChange={vi.fn()} />);
    const row = screen.getByTestId('emergency-row-1');
    expect(row.textContent).toContain('日本警察');
    expect(row.textContent).toContain('警察');
    expect(row.textContent).toContain('110');
  });

  it('phone tel: href is correct', () => {
    render(<EmergencySection tripId="trip-1" items={[mkEmergency()]} onChange={vi.fn()} />);
    const phoneLink = screen.getByText('110').closest('a');
    expect(phoneLink?.getAttribute('href')).toBe('tel:110');
  });

  it('AI generated → AI chip visible', () => {
    render(<EmergencySection tripId="trip-1" items={[mkEmergency({ aiGenerated: 1 })]} onChange={vi.fn()} />);
    expect(screen.getByTestId('emergency-row-1').textContent).toContain('AI');
  });

  it('Add → POST /emergency + onChange', async () => {
    const onChange = vi.fn();
    const created = mkEmergency({ id: 99, name: '' });
    apiFetchMock.mockResolvedValue(created);
    render(<EmergencySection tripId="trip-1" items={[]} onChange={onChange} />);
    fireEvent.click(screen.getByTestId('emergency-add-btn'));
    await waitFor(() => expect(apiFetchMock).toHaveBeenCalled());
    expect(apiFetchMock.mock.calls[0][0]).toBe('/trips/trip-1/notes/emergency');
  });

  it('Trash → ConfirmModal「刪除聯絡人？」', () => {
    render(<EmergencySection tripId="trip-1" items={[mkEmergency({ phone: '' })]} onChange={vi.fn()} />);
    // empty phone → 顯 delete button (not phone btn)
    const btns = screen.getAllByTestId('emergency-delete-1');
    fireEvent.click(btns[0]);
    expect(screen.getByText(/刪除聯絡人/)).toBeInTheDocument();
  });
});
