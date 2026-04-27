/**
 * src/server/email.ts + email-templates.ts unit test — V2-P3
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendEmail, EmailError } from '../../src/server/email';
import {
  emailVerification,
  passwordReset,
  passwordChangedConfirm,
  tripInvitation,
} from '../../src/server/email-templates';

const ENV_OK = {
  RESEND_API_KEY: 're_test_key_123',
  EMAIL_FROM: 'Tripline <no-reply@example.com>',
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-04-25T00:00:00Z'));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sendEmail', () => {
  it('throws EmailError when RESEND_API_KEY missing', async () => {
    await expect(sendEmail({ EMAIL_FROM: 'a@b.com' }, {
      to: 'u@x.com', subject: 's', html: '<p>x</p>',
    })).rejects.toBeInstanceOf(EmailError);
  });

  it('throws EmailError when EMAIL_FROM missing', async () => {
    await expect(sendEmail({ RESEND_API_KEY: 'k' }, {
      to: 'u@x.com', subject: 's', html: '<p>x</p>',
    })).rejects.toBeInstanceOf(EmailError);
  });

  it('POSTs to Resend API with Bearer auth + JSON body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'msg-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendEmail(ENV_OK, {
      to: 'user@example.com',
      subject: 'Test',
      html: '<p>hello</p>',
      text: 'hello',
    });

    expect(result.id).toBe('msg-123');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.resend.com/emails');
    expect(opts.method).toBe('POST');
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      'Bearer re_test_key_123',
    );
    expect((opts.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    const body = JSON.parse(opts.body as string) as Record<string, unknown>;
    expect(body.from).toBe('Tripline <no-reply@example.com>');
    expect(body.to).toEqual(['user@example.com']);
    expect(body.subject).toBe('Test');
    expect(body.html).toBe('<p>hello</p>');
    expect(body.text).toBe('hello');
  });

  it('omits text field when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'm' }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await sendEmail(ENV_OK, { to: 'u@x.com', subject: 's', html: '<p>h</p>' });
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string,
    ) as Record<string, unknown>;
    expect(body.text).toBeUndefined();
  });

  it('throws EmailError on Resend API error (4xx/5xx)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: 'invalid_api_key' }), { status: 401 }),
    ));
    await expect(sendEmail(ENV_OK, {
      to: 'u@x.com', subject: 's', html: '<p>h</p>',
    })).rejects.toMatchObject({ status: 401 });
  });

  it('throws EmailError when response missing id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 }),
    ));
    await expect(sendEmail(ENV_OK, {
      to: 'u@x.com', subject: 's', html: '<p>h</p>',
    })).rejects.toBeInstanceOf(EmailError);
  });
});

describe('email-templates', () => {
  describe('emailVerification', () => {
    it('subject + URL embedded in html + text', () => {
      const tpl = emailVerification('https://x.com/verify?token=abc', 'Ray');
      expect(tpl.subject).toContain('驗證');
      expect(tpl.html).toContain('https://x.com/verify?token=abc');
      expect(tpl.html).toContain('Ray');
      expect(tpl.text).toContain('https://x.com/verify?token=abc');
    });

    it('no displayName works (anonymous greeting)', () => {
      const tpl = emailVerification('https://x.com/v?t=t');
      expect(tpl.html).toContain('歡迎加入 Tripline');
    });

    it('escapes HTML in displayName (XSS defence)', () => {
      const tpl = emailVerification('https://x.com/v?t=t', '<script>alert(1)</script>');
      expect(tpl.html).not.toContain('<script>alert(1)</script>');
      expect(tpl.html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in URL (anti-injection)', () => {
      const tpl = emailVerification('https://x.com/v?t=" onclick=alert(1)');
      expect(tpl.html).not.toContain('" onclick=alert(1)');
      expect(tpl.html).toContain('&quot;');
    });
  });

  describe('passwordReset', () => {
    it('embeds reset URL + mentions 1h validity', () => {
      const tpl = passwordReset('https://x.com/reset?token=xyz');
      expect(tpl.html).toContain('https://x.com/reset?token=xyz');
      expect(tpl.html).toContain('1 小時');
      expect(tpl.html).toContain('一次');
    });

    it('mentions all-device logout', () => {
      const tpl = passwordReset('https://x.com/r');
      expect(tpl.html).toContain('登出');
    });

    it('escapes HTML in displayName', () => {
      const tpl = passwordReset('https://x.com/r', '"><img src=x>');
      expect(tpl.html).not.toContain('"><img src=x>');
      expect(tpl.html).toContain('&quot;');
    });
  });

  describe('passwordChangedConfirm', () => {
    it('subject + recovery instructions if not user', () => {
      const tpl = passwordChangedConfirm('Ray');
      expect(tpl.subject).toContain('密碼');
      expect(tpl.html).toContain('Ray');
      expect(tpl.html).toContain('立即');
      expect(tpl.text).toContain('登入');
    });
  });

  describe('tripInvitation', () => {
    const BASE = {
      inviteUrl: 'https://x.com/invite?token=abc123',
      inviterDisplayName: 'Ray',
      inviterEmail: 'ray@example.com',
      tripTitle: '沖繩 5 日',
      isExistingUser: true,
    };

    it('subject 含 inviter display name + trip title', () => {
      const tpl = tripInvitation(BASE);
      expect(tpl.subject).toContain('Ray');
      expect(tpl.subject).toContain('沖繩 5 日');
      expect(tpl.subject).toContain('邀請');
    });

    it('inviterDisplayName=null fallback 用 inviterEmail', () => {
      const tpl = tripInvitation({ ...BASE, inviterDisplayName: null });
      expect(tpl.subject).toContain('ray@example.com');
      expect(tpl.subject).toContain('沖繩 5 日');
    });

    it('inviteUrl embedded in html + text', () => {
      const tpl = tripInvitation(BASE);
      expect(tpl.html).toContain('https://x.com/invite?token=abc123');
      expect(tpl.text).toContain('https://x.com/invite?token=abc123');
    });

    it('isExistingUser=true 文案：登入並加入', () => {
      const tpl = tripInvitation({ ...BASE, isExistingUser: true });
      expect(tpl.html).toContain('登入');
      expect(tpl.text).toContain('登入');
    });

    it('isExistingUser=false 文案：註冊並加入', () => {
      const tpl = tripInvitation({ ...BASE, isExistingUser: false });
      expect(tpl.html).toContain('註冊');
      expect(tpl.text).toContain('註冊');
    });

    it('提及 7 天有效期', () => {
      const tpl = tripInvitation(BASE);
      expect(tpl.html).toContain('7 天');
    });

    it('anti-phish footer 顯示 inviterEmail（讓收件者驗證熟識）', () => {
      const tpl = tripInvitation(BASE);
      expect(tpl.html).toContain('ray@example.com');
    });

    it('escapes HTML in tripTitle (XSS defence)', () => {
      const tpl = tripInvitation({ ...BASE, tripTitle: '<script>alert(1)</script>' });
      expect(tpl.html).not.toContain('<script>alert(1)</script>');
      expect(tpl.html).toContain('&lt;script&gt;');
    });

    it('escapes HTML in inviterDisplayName', () => {
      const tpl = tripInvitation({ ...BASE, inviterDisplayName: '"><img src=x>' });
      expect(tpl.html).not.toContain('"><img src=x>');
      expect(tpl.html).toContain('&quot;');
    });

    it('escapes HTML in inviterEmail', () => {
      const tpl = tripInvitation({ ...BASE, inviterEmail: 'a@b.com" onclick=alert(1)' });
      expect(tpl.html).not.toContain('" onclick=alert(1)');
      expect(tpl.html).toContain('&quot;');
    });

    it('escapes HTML in inviteUrl', () => {
      const tpl = tripInvitation({ ...BASE, inviteUrl: 'https://x.com/i?t=" onclick=alert(1)' });
      expect(tpl.html).not.toContain('" onclick=alert(1)');
    });
  });

  describe('all templates produce non-empty plain-text fallback', () => {
    it.each([
      emailVerification('https://x.com/v?t=a'),
      passwordReset('https://x.com/r?t=b'),
      passwordChangedConfirm('user'),
      tripInvitation({
        inviteUrl: 'https://x.com/i?t=c',
        inviterDisplayName: 'Ray',
        inviterEmail: 'ray@example.com',
        tripTitle: 'Trip',
        isExistingUser: true,
      }),
    ])('template has both html and text', (tpl) => {
      expect(tpl.html.length).toBeGreaterThan(50);
      expect(tpl.text.length).toBeGreaterThan(20);
    });
  });
});
