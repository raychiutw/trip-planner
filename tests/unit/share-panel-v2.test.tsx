/**
 * Share panel v2 (PR-A) — structural contracts for the nice-to-haves.
 * A1 連結命名, A2 編輯(同網址改區塊/期限), A3 自訂到期日, A4 已關閉區, B2 QR + 原生分享.
 * Source-grep: the panel mixes a lazy qrcode import + TripDatePicker, so lock the wiring.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');
const MODAL = readFileSync(join(ROOT, 'src/components/share/ShareLinkModal.tsx'), 'utf8');
const API = readFileSync(join(ROOT, 'src/lib/shareApi.ts'), 'utf8');
const QR = readFileSync(join(ROOT, 'src/lib/shareQr.ts'), 'utf8');
const SHAREID = readFileSync(join(ROOT, 'functions/api/trips/[id]/shares/[shareId].ts'), 'utf8');

describe('A1 連結命名', () => {
  it('create form has a label input; cards show the label', () => {
    expect(MODAL).toMatch(/data-testid="share-label"/);
    expect(MODAL).toMatch(/l\.label \?/); // card renders label when present
  });
});

describe('A2 編輯（同網址改區塊/期限）', () => {
  it('card has an edit affordance + save wired to updateShare', () => {
    expect(MODAL).toMatch(/share-edit-btn-/);
    expect(MODAL).toMatch(/share-save-/);
    expect(MODAL).toMatch(/updateShare\(/);
    expect(API).toMatch(/export async function updateShare/);
  });
  it("backend PATCH 'update' edits only ACTIVE links (revoked/expired → 404)", () => {
    expect(SHAREID).toMatch(/body\.action === 'update'/);
    expect(SHAREID).toMatch(/revoked_at IS NULL AND \(expires_at IS NULL OR expires_at > \?\)/);
  });
});

describe('A3 自訂到期日', () => {
  it('expiry has a custom option backed by TripDatePicker', () => {
    expect(MODAL).toMatch(/k: 'custom'/); // custom is an expiry preset
    expect(MODAL).toMatch(/data-testid="share-custom-date"/);
    expect(MODAL).toMatch(/TripDatePicker/);
  });
});

describe('A4 已關閉的連結區', () => {
  it('revoked links get their own collapsible section (kept for analytics)', () => {
    expect(MODAL).toMatch(/share-revoked-toggle/);
    expect(MODAL).toMatch(/已關閉的連結/);
    expect(MODAL).toMatch(/links\.filter\(\(l\) => l\.revokedAt\)/); // revoked partition
  });
});

describe('B2 QR + 原生分享 (banner-only — existing links have no URL to encode)', () => {
  it('QR + native share live in the new-link banner, NOT on cards', () => {
    expect(MODAL).toMatch(/data-testid="share-qr-toggle"/);
    expect(MODAL).toMatch(/data-testid="share-native"/);
    expect(QR).toMatch(/import\('qrcode'\)/); // client-side gen — token never leaves the browser
    // QR markup sits inside the `created &&` banner block, before the active-link map
    const qrIdx = MODAL.indexOf('share-qr-toggle');
    const cardIdx = MODAL.indexOf('share-link-row');
    expect(qrIdx).toBeGreaterThan(0);
    expect(qrIdx).toBeLessThan(cardIdx); // banner (QR) rendered before the card list
  });
  it('does NOT call a 3rd-party QR API (no external QR URL)', () => {
    expect(QR).not.toMatch(/qrserver|googleapis.*chart|api\.qrcode/i);
  });
});
