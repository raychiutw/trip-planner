import { AppError } from './_errors';

export interface AiDisclosure {
  version: string;
  title: string;
  processor: string;
  dataCategories: string[];
  purpose: string;
  revocation: string;
}

type Decision = 'accept' | 'decline' | 'revoke';
type Event = { version: string; decision: Decision; created_at: string };

async function activeDisclosure(db: D1Database): Promise<AiDisclosure | null> {
  const row = await db.prepare('SELECT d.version, d.content_json FROM ai_data_disclosure_state s JOIN ai_data_disclosures d ON d.version = s.active_version WHERE s.id = 1')
    .first<{ version: string; content_json: string }>();
  if (!row) return null;
  const content = JSON.parse(row.content_json) as Omit<AiDisclosure, 'version'>;
  return { ...content, version: row.version };
}

async function latestEvent(db: D1Database, uid: string): Promise<Event | null> {
  return db.prepare("SELECT version, decision, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at FROM ai_data_consent_events WHERE user_id = ? ORDER BY id DESC LIMIT 1")
    .bind(uid).first<Event>();
}

export async function aiDataConsentStatus(db: D1Database, uid: string) {
  const [disclosure, latest, accepted] = await Promise.all([
    activeDisclosure(db), latestEvent(db, uid),
    db.prepare("SELECT version, strftime('%Y-%m-%dT%H:%M:%SZ', created_at) AS created_at FROM ai_data_consent_events WHERE user_id = ? AND decision = 'accept' ORDER BY id DESC LIMIT 1")
      .bind(uid).first<{ version: string; created_at: string }>(),
  ]);
  const status = !disclosure ? 'unconfigured'
    : !latest ? 'not_accepted'
    : latest.version !== disclosure.version ? 'outdated'
    : latest.decision === 'revoke' ? 'revoked'
    : latest.decision === 'decline' ? 'declined'
    : 'current';
  return { disclosure, status, acceptedVersion: accepted?.version ?? null,
    acceptedAt: accepted?.created_at ?? null, decidedAt: latest?.created_at ?? null };
}

/** A single server-owned gate shared by every AI work entry point and mint. */
export async function requireAiDataConsent(db: D1Database, uid: string, disclosure?: AiDisclosure | null): Promise<void> {
  const active = disclosure === undefined ? await activeDisclosure(db) : disclosure;
  if (!active) return; // Staged migration: enforcement starts only with approved active content.
  const latest = await latestEvent(db, uid);
  if (!latest || latest.decision !== 'accept' || latest.version !== active.version) {
    throw new AppError('AI_DATA_CONSENT_REQUIRED');
  }
}

export async function requireAiDataConsentForTrip(db: D1Database, actorUid: string | null, tripId: string): Promise<void> {
  const active = await activeDisclosure(db);
  if (!active) return;
  if (!actorUid) throw new AppError('AI_DATA_CONSENT_REQUIRED');
  const trip = await db.prepare('SELECT owner_user_id FROM trips WHERE id = ?').bind(tripId)
    .first<{ owner_user_id: string }>();
  if (!trip) throw new AppError('DATA_NOT_FOUND');
  await requireAiDataConsent(db, actorUid, active);
  if (trip.owner_user_id !== actorUid) await requireAiDataConsent(db, trip.owner_user_id, active);
}

export async function requireAiDataConsentForQueuedRequest(db: D1Database, ownerUid: string, submitterEmail: string | null): Promise<void> {
  const active = await activeDisclosure(db);
  if (!active) return;
  await requireAiDataConsent(db, ownerUid, active);
  const submitter = submitterEmail ? await db.prepare('SELECT id FROM users WHERE email = ?')
    .bind(submitterEmail).first<{ id: string }>() : null;
  if (!submitter) throw new AppError('AI_DATA_CONSENT_REQUIRED');
  if (submitter.id !== ownerUid) await requireAiDataConsent(db, submitter.id, active);
}

/** The INSERT SELECT rechecks the active version in the same SQL statement. */
export async function decideAiDataConsent(db: D1Database, uid: string, version: string, decision: Decision, requestId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) {
    throw new AppError('DATA_VALIDATION', 'requestId 必須是 UUID');
  }
  const existing = await db.prepare('SELECT version, decision FROM ai_data_consent_events WHERE user_id = ? AND request_id = ?')
    .bind(uid, requestId).first<{ version: string; decision: Decision }>();
  if (existing) {
    if (existing.version !== version || existing.decision !== decision) throw new AppError('DATA_CONFLICT', 'requestId 已用於不同決定');
    return;
  }
  const result = await db.prepare(`INSERT INTO ai_data_consent_events (user_id, version, decision, request_id)
    SELECT ?, d.version, ?, ? FROM ai_data_disclosure_state s JOIN ai_data_disclosures d ON d.version = s.active_version WHERE s.id = 1 AND d.version = ?
    ON CONFLICT(user_id, request_id) DO NOTHING`)
    .bind(uid, decision, requestId, version).run();
  if ((result.meta?.changes ?? 0) === 1) return;
  const raced = await db.prepare('SELECT version, decision FROM ai_data_consent_events WHERE user_id = ? AND request_id = ?')
    .bind(uid, requestId).first<{ version: string; decision: Decision }>();
  if (raced) {
    if (raced.version !== version || raced.decision !== decision) throw new AppError('DATA_CONFLICT', 'requestId 已用於不同決定');
    return;
  }
  throw new AppError('DATA_CONFLICT', '同意版本已失效，請重新閱讀目前版本');
}
