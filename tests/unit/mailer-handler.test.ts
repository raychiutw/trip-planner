/**
 * mailer-handler unit tests
 * 驗證 POST /internal/mail/send 處理邏輯（auth / body validation / SMTP / 錯誤）
 */
import { describe, it, expect, vi } from 'vitest';
import { makeMailHandler } from '../../scripts/lib/mailer-handler';

const FAKE_MESSAGE = { messageId: 'fake-id-12345' };

function makeReq(
  body: unknown,
  opts: { auth?: string | null; bodyOverride?: string } = {},
): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== null && opts.auth !== undefined) headers.Authorization = opts.auth;
  return new Request('http://localhost/internal/mail/send', {
    method: 'POST',
    headers,
    body: opts.bodyOverride ?? JSON.stringify(body),
  });
}

interface DepsOverrides {
  sendMail?: ReturnType<typeof vi.fn>;
  verifyAuth?: ReturnType<typeof vi.fn>;
  emailFrom?: string;
  log?: ReturnType<typeof vi.fn>;
  logError?: ReturnType<typeof vi.fn>;
}

function makeDeps(overrides: DepsOverrides = {}) {
  const sendMail = overrides.sendMail ?? vi.fn().mockResolvedValue(FAKE_MESSAGE);
  const verifyAuth = overrides.verifyAuth ?? vi.fn().mockReturnValue(true);
  const log = overrides.log ?? vi.fn();
  const logError = overrides.logError ?? vi.fn();
  // Cast through unknown to satisfy nodemailer Transporter shape (test mock only uses sendMail).
  const fakeTransporter = { sendMail } as unknown as import('nodemailer').Transporter;
  return {
    deps: {
      verifyAuth,
      transporter: () => fakeTransporter,
      emailFrom: overrides.emailFrom ?? 'Tripline <noreply@example.com>',
      log,
      logError,
    },
    sendMail,
    verifyAuth,
    log,
    logError,
  };
}

describe('makeMailHandler', () => {
  it('returns 401 when verifyAuth fails', async () => {
    const { deps, verifyAuth } = makeDeps({ verifyAuth: vi.fn().mockReturnValue(false) });
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({ to: 'a@b.c', subject: 's', html: '<p>h</p>' }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expect(verifyAuth).toHaveBeenCalledOnce();
  });

  it('returns 400 on bad json', async () => {
    const { deps } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({}, { bodyOverride: 'not-json{' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad json');
  });

  it('returns 400 when "to" missing', async () => {
    const { deps } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({ subject: 's', html: 'h' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/missing to\/subject\/html/);
  });

  it('returns 400 when "subject" missing', async () => {
    const { deps } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({ to: 'a@b.c', html: 'h' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when "html" missing', async () => {
    const { deps } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({ to: 'a@b.c', subject: 's' }));
    expect(res.status).toBe(400);
  });

  it('sends mail and returns ok with messageId + elapsed + template', async () => {
    const { deps, sendMail, log } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(
      makeReq({
        to: 'user@example.com',
        subject: '驗證信',
        html: '<p>請點擊連結驗證</p>',
        template: 'verification',
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.messageId).toBe('fake-id-12345');
    expect(typeof body.elapsed).toBe('number');
    expect(body.template).toBe('verification');
    expect(sendMail).toHaveBeenCalledWith({
      from: 'Tripline <noreply@example.com>',
      to: 'user@example.com',
      subject: '驗證信',
      html: '<p>請點擊連結驗證</p>',
    });
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/mail sent.*template=verification.*to=user@example.com/));
  });

  it('uses configured emailFrom override', async () => {
    const { deps, sendMail } = makeDeps({ emailFrom: 'Custom <custom@example.com>' });
    const handler = makeMailHandler(deps);
    await handler(makeReq({ to: 'a@b.c', subject: 's', html: 'h' }));
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: 'Custom <custom@example.com>' }),
    );
  });

  it('returns 500 + error msg + logError when transporter throws', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('SMTP server unreachable'));
    const { deps, logError } = makeDeps({ sendMail });
    const handler = makeMailHandler(deps);
    const res = await handler(
      makeReq({ to: 'a@b.c', subject: 's', html: 'h', template: 'forgot-password' }),
    );
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('SMTP server unreachable');
    expect(logError).toHaveBeenCalledWith(
      expect.stringMatching(/mail send failed.*template=forgot-password.*to=a@b.c.*SMTP server unreachable/),
    );
  });

  it('sets template to null when not provided', async () => {
    const { deps } = makeDeps();
    const handler = makeMailHandler(deps);
    const res = await handler(makeReq({ to: 'a@b.c', subject: 's', html: 'h' }));
    expect((await res.json()).template).toBeNull();
  });

  it('logs success without template hint when omitted', async () => {
    const { deps, log } = makeDeps();
    const handler = makeMailHandler(deps);
    await handler(makeReq({ to: 'a@b.c', subject: 's', html: 'h' }));
    expect(log).toHaveBeenCalledWith(expect.stringMatching(/template=-/));
  });

  it('forwards text fallback to nodemailer when provided', async () => {
    const { deps, sendMail } = makeDeps();
    const handler = makeMailHandler(deps);
    await handler(
      makeReq({ to: 'a@b.c', subject: 's', html: '<p>h</p>', text: 'plain h' }),
    );
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ html: '<p>h</p>', text: 'plain h' }),
    );
  });

  it('omits text key from sendMail when not provided', async () => {
    const { deps, sendMail } = makeDeps();
    const handler = makeMailHandler(deps);
    await handler(makeReq({ to: 'a@b.c', subject: 's', html: '<p>h</p>' }));
    const callArgs = sendMail.mock.calls[0][0] as Record<string, unknown>;
    expect(callArgs.text).toBeUndefined();
  });
});
