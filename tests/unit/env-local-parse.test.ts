/**
 * ops runtime：.env.local 的唯一 parser（scripts/lib/load-env.js 的 parseEnv／loadEnvLocal）。
 *
 * 之前有 5 份實作（lib/load-env.js、api-server 內嵌、_lib/cron-shared、provision-admin、tripline-job.sh），
 * 逐行 parser 對跨多行的單引號值（GOOGLE_CLOUD_SA_KEY 的 private_key）解析是錯的；統一成 dotenv.parse。
 * 這裡只驗行為（餵內容、看結果），不 grep 原始碼。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';

const require_ = createRequire(import.meta.url);
const mod = require_(join(__dirname, '../../scripts/lib/load-env.js'));

describe('parseEnv', () => {
  it('雙引號、單引號都去掉外層引號', () => {
    expect(mod.parseEnv(`A="x y"\nB='z'`)).toEqual({ A: 'x y', B: 'z' });
  });

  it('值裡有 = 不被截斷（base64／JWT）', () => {
    expect(mod.parseEnv('TOKEN=abc==def=')).toEqual({ TOKEN: 'abc==def=' });
  });

  it('跨多行的單引號值整段保留，後面的 key 不受影響', () => {
    const out = mod.parseEnv(`KEY='line1\nline2\nline3'\nNEXT=ok`);
    expect(out.KEY).toBe('line1\nline2\nline3');
    expect(out.NEXT).toBe('ok');
  });

  it('不合法的 key（含 shell 特殊字元）丟掉', () => {
    expect(mod.parseEnv('GOOD=1\nBAD KEY=2\n$(x)=3\nA-B=4')).toEqual({ GOOD: '1' });
  });

  it('空行與註解忽略', () => {
    expect(mod.parseEnv('# c\n\nA=1\n  # d\n')).toEqual({ A: '1' });
  });
});

describe('loadEnvLocal', () => {
  const dirs: string[] = [];
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); delete process.env.OPS_T_NEW; delete process.env.OPS_T_KEEP; });

  it('只補沒有的 env，已存在的不覆蓋；檔案不存在不丟錯', () => {
    const dir = mkdtempSync(join(tmpdir(), 'envlocal-'));
    dirs.push(dir);
    writeFileSync(join(dir, '.env.local'), 'OPS_T_NEW=from-file\nOPS_T_KEEP=from-file\n');
    process.env.OPS_T_KEEP = 'from-env';
    mod.loadEnvLocal({ dir });
    expect(process.env.OPS_T_NEW).toBe('from-file');
    expect(process.env.OPS_T_KEEP).toBe('from-env');
    expect(() => mod.loadEnvLocal({ dir: join(dir, 'nope') })).not.toThrow();
  });
});

describe('結構：只有 lib/load-env.js 解析 .env.local', () => {
  const ROOT = join(__dirname, '../..');
  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) { if (name !== 'node_modules') walk(p, out); }
      else if (/\.(js|mjs|ts)$/.test(name)) out.push(p);
    }
    return out;
  }
  // 手刻逐行 parser 的特徵：逐行 trim 後以 '#' 判斷註解並 indexOf('=') 切 key/value。
  const HAND_ROLLED = /startsWith\(['"]#['"]\)[\s\S]{0,200}indexOf\(['"]=['"]\)/;

  it('scripts/ 內沒有第二份手刻的 .env parser', () => {
    const offenders = walk(join(ROOT, 'scripts'))
      .filter((p) => !/scripts\/lib\/load-env\.(js|mjs)$/.test(p))
      .filter((p) => HAND_ROLLED.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });

  it('api-server 與 cron-shared 走共用 parser', () => {
    for (const f of ['scripts/tripline-api-server.ts', 'scripts/_lib/cron-shared.ts']) {
      expect(readFileSync(join(ROOT, f), 'utf8'), f).toMatch(/load-env/);
    }
  });
});
