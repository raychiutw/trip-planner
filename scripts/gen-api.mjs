// 由 api repo（trip-planner-api）匯出的 OpenAPI 文件產生 web 的型別。
//
//   契約來源：contracts/openapi.json（逐字複製自 api repo main 的匯出；要更新契約就覆蓋這個檔再 `npm run gen:api`）
//   產出：src/api/schema.d.ts（提交進 repo，勿手改）
//   `--check`：重新產生到記憶體，與已提交的檔案逐位元比對，不同就失敗（CI 用，見 `npm run check:api-contract`）
//
// 環境變數 OPENAPI_TS_CLI 可指定 cli.js 路徑（只給還沒 npm ci 的環境用；CI 與一般開發用 node_modules 內的）。
// 產生器版本釘死在 package.json（openapi-typescript 7.13.0 exact）；升級要連同重新產生一起提交。
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SPEC = 'contracts/openapi.json';
const OUT = 'src/api/schema.d.ts';
const BANNER = '// 由 openapi-typescript 7.13.0 自 contracts/openapi.json 產生，勿手改（npm run gen:api）。\n';

function generate() {
  const dir = mkdtempSync(join(tmpdir(), 'gen-api-'));
  try {
    const tmp = join(dir, 'schema.d.ts');
    execFileSync(process.execPath, [process.env.OPENAPI_TS_CLI ?? 'node_modules/openapi-typescript/bin/cli.js', SPEC, '-o', tmp], { stdio: ['ignore', 'ignore', 'inherit'] });
    return BANNER + readFileSync(tmp, 'utf8');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const next = generate();
if (process.argv.includes('--check')) {
  let current = '';
  try { current = readFileSync(OUT, 'utf8'); } catch { /* 不存在 = 不同 */ }
  if (current !== next) {
    console.error(`${OUT} 與 ${SPEC} 不一致：請執行 npm run gen:api 並提交結果。`);
    process.exit(1);
  }
  console.log(`${OUT} 與 ${SPEC} 一致。`);
} else {
  writeFileSync(OUT, next);
  console.log(`已產生 ${OUT}`);
}
