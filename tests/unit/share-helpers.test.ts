/**
 * _share.ts — security-load-bearing helpers for the public share platform (v2.39.0).
 *
 * Locks the承重牆 contracts (design §安全設計):
 *  - token format pre-filter + CSPRNG + hash-only storage
 *  - visible_sections is an ALLOWLIST (default-deny unknown keys / garbage)
 *  - resolveActiveShare returns a uniform null for not-found / revoked / expired
 *  - loadVisibleShareData is DEFAULT-DENY: a closed note section's table is NEVER
 *    SELECTed — proven by recording every SQL the call issues.
 */
import { describe, it, expect } from 'vitest';
import {
  SHARE_SECTIONS,
  DEFAULT_SHARE_SECTIONS,
  isValidShareToken,
  generateShareToken,
  hashToken,
  parseVisibleSections,
  sanitizeVisibleSections,
  resolveActiveShare,
  loadVisibleShareData,
  type ShareRow,
} from '../../functions/api/_share';

/** Minimal D1 mock that records every prepared SQL + returns canned rows. */
function mockDb(opts: { first?: (sql: string) => unknown; all?: (sql: string) => unknown } = {}) {
  const queries: string[] = [];
  const db = {
    prepare(sql: string) {
      queries.push(sql);
      const stmt = {
        bind() {
          return stmt;
        },
        async first() {
          return opts.first ? opts.first(sql) : null;
        },
        async all() {
          return opts.all ? opts.all(sql) : { results: [] };
        },
      };
      return stmt;
    },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, queries };
}

const baseShare: ShareRow = {
  id: 1,
  trip_id: 'okinawa-2026',
  token_hash: 'hash',
  label: '',
  visible_sections: '[]',
  expires_at: null,
  view_count: 0,
  created_by: 'u1',
  created_at: '2026-05-30 00:00:00',
  revoked_at: null,
};

describe('share token', () => {
  it('isValidShareToken accepts URL-safe 20-64 char tokens, rejects junk', () => {
    expect(isValidShareToken(generateShareToken())).toBe(true);
    expect(isValidShareToken('abcDEF123_-xyz789QRST')).toBe(true);
    expect(isValidShareToken('short')).toBe(false);
    expect(isValidShareToken('has space inside here!!')).toBe(false);
    expect(isValidShareToken('has+slash/and=pad-aaaaa')).toBe(false); // non-url-safe chars
    expect(isValidShareToken('')).toBe(false);
  });

  it('generateShareToken is URL-safe, ≥20 chars, and unique per call', () => {
    const a = generateShareToken();
    const b = generateShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,64}$/);
    expect(a).not.toBe(b); // CSPRNG → effectively never collides
  });

  it('hashToken is deterministic 64-hex SHA-256, differs per input', async () => {
    const h1 = await hashToken('token-aaaa');
    const h2 = await hashToken('token-aaaa');
    const h3 = await hashToken('token-bbbb');
    expect(h1).toMatch(/^[0-9a-f]{64}$/);
    expect(h1).toBe(h2);
    expect(h1).not.toBe(h3);
  });
});

describe('visible_sections allowlist (default-deny)', () => {
  it('parseVisibleSections keeps only known keys, drops unknown/garbage', () => {
    expect(parseVisibleSections('["flights","emergency","__proto__","bogus"]')).toEqual(['flights', 'emergency']);
    expect(parseVisibleSections('[]')).toEqual([]);
    expect(parseVisibleSections('not json')).toEqual([]);
    expect(parseVisibleSections('{"flights":true}')).toEqual([]); // non-array
    expect(parseVisibleSections(null)).toEqual([]);
  });

  it('sanitizeVisibleSections normalises owner input to the allowlist', () => {
    expect(sanitizeVisibleSections(['lodgings', 'evil', 'pretrip'])).toEqual(['lodgings', 'pretrip']);
    expect(sanitizeVisibleSections('nope')).toEqual([]);
    expect(sanitizeVisibleSections(undefined)).toEqual([]);
  });

  it('safe default excludes 預訂 + 緊急聯絡', () => {
    expect(DEFAULT_SHARE_SECTIONS).not.toContain('reservations');
    expect(DEFAULT_SHARE_SECTIONS).not.toContain('emergency');
    expect(DEFAULT_SHARE_SECTIONS).toContain('flights');
    expect(SHARE_SECTIONS).toHaveLength(5);
  });
});

describe('resolveActiveShare — uniform null (no enumeration oracle)', () => {
  it('returns null for malformed token without touching the DB', async () => {
    const { db, queries } = mockDb();
    expect(await resolveActiveShare(db, 'bad token!')).toBeNull();
    expect(queries).toHaveLength(0); // pre-filter blocks DB hit
  });

  it('returns null for unknown / revoked / expired, row for active', async () => {
    const tok = generateShareToken();
    const active = mockDb({ first: () => ({ ...baseShare }) });
    expect(await resolveActiveShare(active.db, tok)).not.toBeNull();

    const unknown = mockDb({ first: () => null });
    expect(await resolveActiveShare(unknown.db, tok)).toBeNull();

    const revoked = mockDb({ first: () => ({ ...baseShare, revoked_at: '2026-05-30 01:00:00' }) });
    expect(await resolveActiveShare(revoked.db, tok)).toBeNull();

    const expired = mockDb({ first: () => ({ ...baseShare, expires_at: Date.now() - 1000 }) });
    expect(await resolveActiveShare(expired.db, tok)).toBeNull();
  });
});

describe('loadVisibleShareData — DEFAULT-DENY filtering', () => {
  it('only SELECTs note tables for ENABLED sections; closed sections are never queried', async () => {
    // share opens flights only → lodgings/reservations/pretrip/emergency must NOT be queried
    const share: ShareRow = { ...baseShare, visible_sections: '["flights"]' };
    const { db, queries } = mockDb({
      first: () => ({ name: 'Okinawa', title: '沖繩五日', countries: 'JP' }),
    });

    await loadVisibleShareData(db, share);

    const allSql = queries.join('\n');
    expect(allSql).toContain('trip_flights'); // enabled → queried
    expect(allSql).not.toContain('trip_lodgings'); // closed → never queried
    expect(allSql).not.toContain('trip_reservations');
    expect(allSql).not.toContain('trip_pretrip_notes');
    expect(allSql).not.toContain('trip_emergency_contacts');
  });

  it('payload carries empty arrays for closed sections + no owner PII fields', async () => {
    const share: ShareRow = { ...baseShare, visible_sections: '["lodgings"]' };
    const { db } = mockDb({
      first: () => ({ name: 'Okinawa', title: null, countries: null }),
      all: (sql: string) =>
        sql.includes('trip_lodgings')
          ? { results: [{ name: 'Hotel', booking_no: 'BK123', phone: '098-x' }] }
          : { results: [] },
    });

    const payload = await loadVisibleShareData(db, share);
    expect(payload.notes.lodgings).toHaveLength(1); // enabled
    expect(payload.notes.emergencyContacts).toEqual([]); // closed → empty
    expect(payload.notes.reservations).toEqual([]);
    // meta is an allowlist — owner display_name only, NO owner_user_id / email
    expect(payload.meta).not.toHaveProperty('owner_user_id');
    expect(payload.meta).not.toHaveProperty('email');
    expect(payload.meta).not.toHaveProperty('owner_email');
    expect(Object.keys(payload.meta).sort()).toEqual(['countries', 'destinations', 'name', 'sharedBy', 'title']);
  });
});
