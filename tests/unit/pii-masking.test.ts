// @vitest-environment node
/**
 * PII 遮罩 — 對外告警與稽核 metadata 不得帶明文 email
 *
 * 背景（2026-07-20 隱私盤點）：
 *   - Telegram 管理者告警把使用者 email 送到境外 bot 聊天群，
 *     其中 `permissions.ts` 送的是**被邀請的第三方** email —— 那人甚至還不是使用者。
 *   - `forgot-password.ts` 把明文 email 塞進 `auth_audit_log.metadata`。
 *
 * 診斷用途仍需要「是哪個帳號」，所以不是整個拿掉，而是遮罩成可辨識但不可還原的形式。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { maskEmail } from '../../functions/api/_pii';

describe('maskEmail — 遮罩但保留可辨識度', () => {
  it('保留首字與網域，中間遮掉', () => {
    expect(maskEmail('raychiu@example.com')).toBe('r***@example.com');
  });

  it('單字元 local part 不得洩漏全貌', () => {
    // 'a@x.com' → 'a***@x.com' 會等於揭露完整 local part。
    expect(maskEmail('a@x.com')).toBe('***@x.com');
  });

  it('兩字元 local part 同樣只留首字', () => {
    expect(maskEmail('ab@x.com')).toBe('a***@x.com');
  });

  it('非 email 字串不炸，回固定佔位', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });

  it('大小寫與空白正規化（避免同一人出現多種遮罩形式）', () => {
    expect(maskEmail('  RayChiu@Example.COM ')).toBe('r***@example.com');
  });
});

describe('告警與稽核不得帶明文 email', () => {
  const FILES = [
    'functions/api/oauth/forgot-password.ts',
    'functions/api/oauth/reset-password.ts',
    'functions/api/oauth/send-verification.ts',
    'functions/api/permissions.ts',
  ];

  /** 剝掉註解 —— 說明「為何遮罩」的散文不該讓斷言變紅。 */
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  it.each(FILES)('%s：alertAdminTelegram 不得內插未遮罩的 email 變數', (f) => {
    const src = strip(readFileSync(resolve(__dirname, '../../', f), 'utf-8'));
    // 抓 alertAdminTelegram(...) 的參數區塊，檢查有沒有直接插 email 變數
    for (const m of src.matchAll(/alertAdminTelegram\(([\s\S]*?)\);/g)) {
      const call = m[1] ?? '';
      expect(call, `${f}: 告警訊息插了未遮罩的 email`)
        .not.toMatch(/\$\{\s*(email|params\.to|tokenRow\.email|to)\s*\}/);
    }
  });

  it('forgot-password 的稽核 metadata 不得存明文 email', () => {
    const src = strip(readFileSync(resolve(__dirname, '../../functions/api/oauth/forgot-password.ts'), 'utf-8'));
    // metadata: { email, ... } 這種 shorthand 會存整串明文
    expect(src).not.toMatch(/metadata:\s*\{\s*email\s*[,}]/);
  });
});
