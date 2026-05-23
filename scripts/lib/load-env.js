'use strict';
/**
 * Load `.env.local` into `process.env` (existing process.env wins).
 *
 * v2.33.29: 統一 5 個 script 的 loadEnvLocal — 之前各自寫的 regex
 * `/^(\w+)=(.+)/` 不處理 values with `=` in them（base64 / JWT / JSON），
 * 也不處理引號包裹的值。改用 indexOf 與 strip-quotes 後安全多。
 *
 * CommonJS-only wrapper（搭配 require()）；ESM 版本見 `load-env.mjs`。
 */
const fs = require('fs');
const path = require('path');

function loadEnvLocal() {
  try {
    const envPath = path.join(__dirname, '..', '..', '.env.local');
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      let val = trimmed.slice(idx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) process.env[key] = val;
    }
  } catch {
    // .env.local 不存在 (CI / launchd) 屬正常路徑；env 已透過外部 inject
  }
}

module.exports = { loadEnvLocal };
