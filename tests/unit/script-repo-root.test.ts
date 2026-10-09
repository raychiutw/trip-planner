/**
 * 腳本的 repo 根目錄由腳本自己的位置推導，不寫死 /Users/ray/...（ops runtime module）。
 *
 * 做法：取出腳本裡 REPO_ROOT／PROJECT_DIR 的那一行賦值，在 zsh 裡以「腳本在別處」的 $0 執行，
 * 看結果是不是跟著搬家。寫死的路徑會回傳原本的 /Users/ray/...。
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPTS: Array<{ file: string; varName: string }> = [
  { file: 'scripts/log-rotate.sh', varName: 'REPO_ROOT' },
  { file: 'scripts/tripline-job.sh', varName: 'PROJECT_DIR' },
];

describe.each(SCRIPTS)('$file', ({ file, varName }) => {
  it(`${varName} 跟著腳本所在的 checkout 走`, () => {
    const src = readFileSync(join(__dirname, '../..', file), 'utf8');
    const line = src.split('\n').find((l) => new RegExp(`^${varName}=`).test(l));
    expect(line, `${file} 找不到 ${varName}= 那一行`).toBeTruthy();

    const root = realpathSync(mkdtempSync(join(tmpdir(), 'moved-checkout-')));
    try {
      mkdirSync(join(root, 'scripts'), { recursive: true });
      const r = spawnSync('zsh', ['-c', `${line}\nprintf %s "$${varName}"`, join(root, file)], { encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      expect(r.stdout).toBe(root);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
