import { beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from './setup';
import { mockContext, mockEnv, seedTrip, seedUser, userIdFor } from './helpers';
import { onRequestGet } from '../../functions/api/invitations';
import { onRequestPost } from '../../functions/api/invitations/accept';
import { issueSession } from '../../functions/api/_session';
import { hashInvitationToken } from '../../src/server/invitation-token';

const secret = 'invitation-role-integration-secret';
const owner = 'invite-role-owner@test.com';
const invitee = 'invite-role-viewer@test.com';
const tripId = 'invitation-role-trip';
const token = 'invitation-role-viewer-token';
let db: D1Database;

async function acceptAs(email: string, invitationToken = token): Promise<Response> {
  const env = mockEnv(db, { SESSION_SECRET: secret });
  const sessionResponse = new Response();
  await issueSession(new Request('https://test/'), sessionResponse, userIdFor(email), env);
  const cookie = sessionResponse.headers.get('Set-Cookie')?.split(';')[0];
  return onRequestPost(mockContext({
    request: new Request('https://test/api/invitations/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', Cookie: cookie ?? '' },
      body: JSON.stringify({ token: invitationToken }),
    }),
    env,
  }));
}

beforeAll(async () => {
  db = await createTestDb();
  await seedTrip(db, { id: tripId, owner });
  await seedUser(db, invitee);
  await db.prepare(`INSERT INTO trip_invitations
    (token_hash, trip_id, invited_email, role, invited_by, expires_at)
    VALUES (?, ?, ?, 'viewer', ?, ?)`)
    .bind(await hashInvitationToken(token, secret), tripId, invitee, userIdFor(owner), '2099-01-01T00:00:00Z')
    .run();
});

describe('invitation role in real D1', () => {
  it('previews viewer role and grants viewer access once to the invited account', async () => {
    const preview = await onRequestGet(mockContext({
      request: new Request(`https://test/api/invitations?token=${token}`),
      env: mockEnv(db, { SESSION_SECRET: secret }),
    }));
    expect(preview.status).toBe(200);
    expect((await preview.json() as { role: string }).role).toBe('viewer');

    const wrong = await acceptAs(owner);
    expect(wrong.status).toBe(403);
    expect((await wrong.json() as { error: { code: string } }).error.code).toBe('INVITATION_EMAIL_MISMATCH');

    const accepted = await acceptAs(invitee);
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({ ok: true, tripId });
    const permission = await db.prepare('SELECT role FROM trip_permissions WHERE trip_id = ? AND user_id = ?')
      .bind(tripId, userIdFor(invitee)).first<{ role: string }>();
    expect(permission?.role).toBe('viewer');

    const replay = await acceptAs(invitee);
    expect(replay.status).toBe(410);
    expect((await replay.json() as { error: { code: string } }).error.code).toBe('INVITATION_ACCEPTED');
  });

  it('keeps legacy admin invitations acceptable as member', async () => {
    const legacyEmail = 'invite-role-legacy@test.com';
    const legacyToken = 'invitation-role-legacy-token';
    await seedUser(db, legacyEmail);
    await db.prepare(`INSERT INTO trip_invitations
      (token_hash, trip_id, invited_email, role, invited_by, expires_at)
      VALUES (?, ?, ?, 'admin', ?, ?)`)
      .bind(await hashInvitationToken(legacyToken, secret), tripId, legacyEmail, userIdFor(owner), '2099-01-01T00:00:00Z')
      .run();
    const preview = await onRequestGet(mockContext({
      request: new Request(`https://test/api/invitations?token=${legacyToken}`),
      env: mockEnv(db, { SESSION_SECRET: secret }),
    }));
    expect((await preview.json() as { role: string }).role).toBe('member');
    const accepted = await acceptAs(legacyEmail, legacyToken);
    expect(accepted.status).toBe(200);
    const permission = await db.prepare('SELECT role FROM trip_permissions WHERE trip_id = ? AND user_id = ?')
      .bind(tripId, userIdFor(legacyEmail)).first<{ role: string }>();
    expect(permission?.role).toBe('member');
  });
});
