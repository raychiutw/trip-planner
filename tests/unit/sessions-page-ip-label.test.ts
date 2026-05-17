// @vitest-environment node
/**
 * v2.31.45 polish: SessionsPage 「IP TSdE1hEx…」label 改文案。
 *
 * Bug 取證（prod QA loop）：line 318 顯示「· IP {ip_hash_prefix}…」，
 * 但實際 `ip_hash_prefix` 是 hash 過的 IP 前綴（privacy by design），
 * 不是真實 IP 位址。User 看到 'TSdE1hEx…' 會誤以為這是奇怪格式 IP，
 * 沒看 SessionsPage line 12 comment（`ip_hash_prefix`）不知這是 hash。
 *
 * Fix：改文案為「裝置 ID xxx…」，並補 title attribute 解釋「IP 雜湊前綴」
 * 給好奇 user。
 *
 * Pure-text grep on source。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/SessionsPage.tsx'),
  'utf8',
);

describe('v2.31.45 SessionsPage IP label 改裝置 ID', () => {
  it('不再 raw render「IP {ip_hash_prefix}」', () => {
    expect(SRC).not.toMatch(/`\s*·\s*IP \$\{s\.ip_hash_prefix\}…`/);
  });

  it('改文案「裝置 ID」', () => {
    expect(SRC).toMatch(/裝置 ID/);
  });

  it('保留 hash prefix 顯示（device fingerprint discoverable）', () => {
    expect(SRC).toMatch(/s\.ip_hash_prefix/);
  });
});
