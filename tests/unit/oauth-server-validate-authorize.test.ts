/**
 * validateAuthorizeRequest unit test — V2-P4
 */
import { describe, it, expect } from 'vitest';
import {
  validateAuthorizeRequest,
  type ClientAppRow,
  type AuthorizeRequest,
  type ValidationError,
  type ValidatedRequest,
} from '../../src/server/oauth-server/validate-authorize-request';

const ACTIVE_CONFIDENTIAL: ClientAppRow = {
  client_id: 'partner-x',
  client_type: 'confidential',
  app_name: 'Partner X',
  redirect_uris: JSON.stringify(['https://partner-x.com/cb', 'https://partner-x.com/cb2']),
  allowed_scopes: JSON.stringify(['openid', 'profile', 'email', 'trips:read']),
  status: 'active',
};

const ACTIVE_PUBLIC: ClientAppRow = {
  ...ACTIVE_CONFIDENTIAL,
  client_id: 'mobile-app',
  client_type: 'public',
};

const SUSPENDED: ClientAppRow = { ...ACTIVE_CONFIDENTIAL, status: 'suspended' };
const PENDING: ClientAppRow = { ...ACTIVE_CONFIDENTIAL, status: 'pending_review' };

const VALID_REQUEST: AuthorizeRequest = {
  response_type: 'code',
  client_id: 'partner-x',
  redirect_uri: 'https://partner-x.com/cb',
  scope: 'openid profile email',
  state: 'csrf-token-123',
};

function isErr(v: ValidatedRequest | ValidationError): v is ValidationError {
  return 'code' in v && 'message' in v;
}

describe('validateAuthorizeRequest — client_id checks', () => {
  it('Missing client_id → invalid_request (not redirectable)', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, client_id: undefined }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.code).toBe('invalid_request');
      expect(r.redirectableToClient).toBe(false);
    }
  });

  it('Client not in DB (null) → unauthorized_client (not redirectable)', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, null);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.code).toBe('unauthorized_client');
      expect(r.redirectableToClient).toBe(false);
    }
  });

  it('Client suspended → unauthorized_client', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, SUSPENDED);
    expect(isErr(r) && r.code).toBe('unauthorized_client');
  });

  it('Client pending_review → unauthorized_client', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, PENDING);
    expect(isErr(r) && r.code).toBe('unauthorized_client');
  });
});

describe('validateAuthorizeRequest — redirect_uri checks', () => {
  it('Missing redirect_uri → invalid_request (not redirectable)', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, redirect_uri: undefined }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_request');
    expect(isErr(r) && r.redirectableToClient).toBe(false);
  });

  it('redirect_uri not in whitelist → invalid_request (not redirectable — security critical)', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, redirect_uri: 'https://evil.com/cb' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_request');
    expect(isErr(r) && r.redirectableToClient).toBe(false);
  });

  it('redirect_uri exact match (multiple whitelist entries supported)', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, redirect_uri: 'https://partner-x.com/cb2' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
  });

  it('redirect_uri trailing slash mismatch → reject (no tolerance)', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, redirect_uri: 'https://partner-x.com/cb/' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_request');
  });
});

describe('validateAuthorizeRequest — response_type', () => {
  it('response_type=code → ok (only supported)', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
  });

  it('response_type=token (implicit) → unsupported_response_type', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, response_type: 'token' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('unsupported_response_type');
    expect(isErr(r) && r.redirectableToClient).toBe(true);
  });

  it('Missing response_type → unsupported_response_type', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, response_type: undefined }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('unsupported_response_type');
  });
});

describe('validateAuthorizeRequest — scope', () => {
  it('Empty scope → invalid_scope', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, scope: '' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_scope');
  });

  it('Subset of allowed_scopes → ok', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, scope: 'openid' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
  });

  it('Exact match all allowed_scopes → ok', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, scope: 'openid profile email trips:read' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
  });

  it('Scope not in allowed → invalid_scope', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, scope: 'openid admin' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_scope');
  });
});

describe('validateAuthorizeRequest — PKCE', () => {
  it('Public client without code_challenge → invalid_request (PKCE required)', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, ACTIVE_PUBLIC);
    expect(isErr(r) && r.code).toBe('invalid_request');
    if (isErr(r)) expect(r.message).toContain('PKCE');
  });

  it('Public client with code_challenge + S256 → ok', () => {
    const r = validateAuthorizeRequest(
      { ...VALID_REQUEST, code_challenge: 'abc123', code_challenge_method: 'S256' },
      ACTIVE_PUBLIC,
    );
    expect(isErr(r)).toBe(false);
  });

  it('Public client with code_challenge_method=plain → invalid_request', () => {
    const r = validateAuthorizeRequest(
      { ...VALID_REQUEST, code_challenge: 'abc', code_challenge_method: 'plain' },
      ACTIVE_PUBLIC,
    );
    expect(isErr(r) && r.code).toBe('invalid_request');
  });

  it('Confidential client without PKCE → ok (V2-P4 optional)', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
  });

  it('Confidential client with PKCE plain → invalid_request (S256 only when provided)', () => {
    const r = validateAuthorizeRequest(
      { ...VALID_REQUEST, code_challenge: 'abc', code_challenge_method: 'plain' },
      ACTIVE_CONFIDENTIAL,
    );
    expect(isErr(r) && r.code).toBe('invalid_request');
  });
});

describe('validateAuthorizeRequest — prompt', () => {
  it('Valid prompts: none / login / consent / select_account', () => {
    for (const prompt of ['none', 'login', 'consent', 'select_account']) {
      const r = validateAuthorizeRequest({ ...VALID_REQUEST, prompt }, ACTIVE_CONFIDENTIAL);
      expect(isErr(r), `prompt=${prompt} should be ok`).toBe(false);
    }
  });

  it('Invalid prompt → invalid_request', () => {
    const r = validateAuthorizeRequest({ ...VALID_REQUEST, prompt: 'unknown' }, ACTIVE_CONFIDENTIAL);
    expect(isErr(r) && r.code).toBe('invalid_request');
  });
});

describe('validateAuthorizeRequest — successful return shape', () => {
  it('Returns parsed scopes + state + redirectUri', () => {
    const r = validateAuthorizeRequest(VALID_REQUEST, ACTIVE_CONFIDENTIAL);
    expect(isErr(r)).toBe(false);
    if (!isErr(r)) {
      expect(r.client).toBe(ACTIVE_CONFIDENTIAL);
      expect(r.redirectUri).toBe('https://partner-x.com/cb');
      expect(r.scopes).toEqual(['openid', 'profile', 'email']);
      expect(r.state).toBe('csrf-token-123');
      expect(r.codeChallenge).toBeNull();
      expect(r.codeChallengeMethod).toBeNull();
    }
  });

  it('codeChallenge populated when provided', () => {
    const r = validateAuthorizeRequest(
      { ...VALID_REQUEST, code_challenge: 'pkce-challenge', code_challenge_method: 'S256' },
      ACTIVE_PUBLIC,
    );
    if (!isErr(r)) {
      expect(r.codeChallenge).toBe('pkce-challenge');
      expect(r.codeChallengeMethod).toBe('S256');
    }
  });
});
