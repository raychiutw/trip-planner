/**
 * alertAdminTelegram unit tests
 * 驗證 env 缺則 skip、fetch 行為、不 throw 行為
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { alertAdminTelegram } from '../../functions/api/_alert';

describe('alertAdminTelegram', () => {
  let originalFetch: typeof globalThis.fetch;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('skips + warns when TELEGRAM_BOT_TOKEN missing', async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;
    await alertAdminTelegram({ TELEGRAM_CHAT_ID: '123' }, 'test msg');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringMatching(/not set/));
  });

  it('skips + warns when TELEGRAM_CHAT_ID missing', async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;
    await alertAdminTelegram({ TELEGRAM_BOT_TOKEN: 'abc' }, 'test msg');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('posts to Telegram API with correct URL + body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(''),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = fetchMock as any;
    await alertAdminTelegram(
      { TELEGRAM_BOT_TOKEN: 'BOT_TOKEN_X', TELEGRAM_CHAT_ID: 'CHAT_ID_Y' },
      'Email send failed: verification → user@example.com',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [url, init] = fetchMock.mock.calls[0] as [string, any];
    expect(url).toBe('https://api.telegram.org/botBOT_TOKEN_X/sendMessage');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe('CHAT_ID_Y');
    expect(body.text).toContain('Email send failed: verification → user@example.com');
    expect(body.text).toContain('Tripline');
  });

  it('does not throw when fetch rejects (network down)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network error')) as any;
    await expect(
      alertAdminTelegram(
        { TELEGRAM_BOT_TOKEN: 'X', TELEGRAM_CHAT_ID: 'Y' },
        'test',
      ),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Telegram alert failed/),
      expect.anything(),
    );
  });

  it('does not throw on Telegram API non-2xx (logs error)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('internal error'),
    }) as any;
    await expect(
      alertAdminTelegram(
        { TELEGRAM_BOT_TOKEN: 'X', TELEGRAM_CHAT_ID: 'Y' },
        'test',
      ),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/Telegram API non-2xx/),
      500,
      'internal error',
    );
  });
});
