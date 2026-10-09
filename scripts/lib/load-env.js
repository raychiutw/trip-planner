'use strict';
/**
 * Load `.env.local` into `process.env` (existing process.env wins).
 *
 * v2.33.29: 統一 5 個 script 的 loadEnvLocal — 之前各自寫的 regex
 * `/^(\w+)=(.+)/` 不處理 values with `=` in them（base64 / JWT / JSON），
 * 也不處理引號包裹的值。改用 indexOf 與 strip-quotes 後安全多。
 *
 * CommonJS-only wrapper（搭配 require()）；bash 用的匯出器見 `load-env.mjs`（同一個 parser）。
 */
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * 解析 .env 內容 → { KEY: value }。**全 repo 唯一的 .env.local parser**
 * （ops runtime module：api-server、cron-shared、provision-admin、load-env.mjs 都走這裡）。
 *
 * 用 dotenv.parse（純函數、無副作用、不碰 stdout）：支援跨多行的單引號值（GOOGLE_CLOUD_SA_KEY 的
 * private_key）、值裡的 `=`、雙／單引號。之前各腳本自刻的逐行 parser 對跨多行的值是錯的。
 * key 只收 `[A-Za-z_][A-Za-z0-9_]*`（defense in depth：.env.local 內容最終可能被 export 進 shell）；
 * 被跳過的 key 會呼叫 onSkip(key)（可省略）。
 */
function parseEnv(content, onSkip) {
  const parsed = dotenv.parse(content);
  const out = {};
  for (const [key, val] of Object.entries(parsed)) {
    if (KEY_RE.test(key)) out[key] = val;
    else if (onSkip) onSkip(key);   // 讓呼叫端（如 load-env.mjs）能把「被跳過的 key」寫到 stderr 當診斷
  }
  return out;
}

/** repo 根目錄（本檔在 scripts/lib/ 下）。腳本不要再各自寫 /Users/ray/... 或 process.cwd() 推導。 */
const REPO_ROOT = path.join(__dirname, '..', '..');

/** 把 `<dir>/.env.local` 載入 process.env（已存在的 env 優先、不覆蓋）。檔案不存在屬正常路徑。 */
function loadEnvLocal(opts) {
  const dir = (opts && opts.dir) || REPO_ROOT;
  try {
    const content = fs.readFileSync(path.join(dir, '.env.local'), 'utf8');
    for (const [key, val] of Object.entries(parseEnv(content))) {
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local 不存在 (CI / launchd) 屬正常路徑；env 已透過外部 inject
  }
}

module.exports = { parseEnv, loadEnvLocal, REPO_ROOT };
