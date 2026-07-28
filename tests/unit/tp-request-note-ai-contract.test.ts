import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const skillPaths = [
  '.claude/skills/tp-request/SKILL.md',
  '.codex/skills/tp-request/SKILL.md',
];

describe('tp-request 行程筆記 AI contract', () => {
  it.each(skillPaths)('%s 將三種筆記請求回傳純 JSON，且不直接寫筆記', (path) => {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');

    expect(source).toContain('[行程筆記-lodging-tips]');
    expect(source).toContain('[行程筆記-tips]');
    expect(source).toContain('[行程筆記-emergency]');
    expect(source).toContain('reply 必須是純 JSON array');
    expect(source).toContain('不得直接寫入行程筆記');
  });
});
