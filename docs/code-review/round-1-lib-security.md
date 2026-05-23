# Round 1 — src/lib/ Security + Stability

- **PR**: [#715](https://github.com/raychiutw/trip-planner/pull/715)
- **Version**: v2.33.36
- **Date**: 2026-05-23
- **Scope**: src/lib/ — 32 .ts files / 2,630 LOC
- **Agents**: code-reviewer + security-auditor + test-engineer

## Findings

### HIGH

| # | Location | Issue | Status |
|---|----------|-------|--------|
| H1 | `sanitize.ts:38-50` | URI attr allowlist 漏 `formaction` / `xlink:href` / `srcset` / `poster` / `background` / `data` / `ping` / `cite` → XSS via SVG/button payload | ✅ Fixed: 擴 attr allowlist + 整支 `<svg>` 拔 + `style` attr 全拔 |

### MEDIUM

| # | Location | Issue | Status |
|---|----------|-------|--------|
| M1 | `sanitize.ts:31-37` | `style` attr 只 blocklist `expression(`/`javascript:` 等 keyword，漏 `position:fixed;opacity:0` clickjack | ✅ Fixed: 整支拔 `style` |
| M2 | `apiClient.ts:39-42` | Sentry `extra: { path, detail }` leak query string + 整段 backend detail → PII | ✅ Fixed: `path.split('?')[0]` + detail cap 200 |
| M3 | `apiClient.ts:8-15` | 缺 CSRF X-Tripline-Client baseline header (defense in depth) | 🔄 Deferred to backend round (handled v2.33.43 Bearer CSRF) |
| M4 | `errors.ts:38-54` | Backend `detail` 直接 toast 給 user → 可能 leak SQL fragment | ✅ Fixed: ApiError constructor cap 200 char + strip newline |
| M5 | `tripExport.ts:29-34` | `a.download = \`${tripName}-...\`` 含 `../` / CRLF / `:` → Safari path traversal | ✅ Fixed: `safeFileBase()` strip + cap 80 |
| M6 | `tripExport.ts:194-243` | CSV cell 以 `=` / `+` / `-` / `@` 開頭被 Excel 當公式 → formula injection | ✅ Fixed: `csvSafe()` prefix `'` |

### Stability (MED→HIGH impact)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| S1 | `apiClient.ts:10` | FormData / Blob / URLSearchParams 強塞 Content-Type: application/json → server parse fail | ✅ Fixed: 只對 string body 補 |
| S2 | `localStorage.ts:18-21` | `lsSet` 包 throw → useEffect crash (Safari private / QuotaExceeded) | ✅ Fixed: try/catch + return bool |
| S3 | `weather.ts:212-214` | fetch 無 AbortSignal / timeout → upstream hang stall render | ✅ Fixed: `AbortSignal.timeout(8000)` + try/catch |
| S4 | `poiHours.ts:17` | `WEEKDAY_RE /g` flag stateful — 依賴 `lastIndex=0` reset | ✅ Fixed: per-call `new RegExp` |
| S5 | `tripExport.ts:268` | `catch {}` swallow err → user 無法附 console 給 bug report | ✅ Fixed: `console.error('[downloadTripFormat]', err)` |
| S6 | `localStorage.ts:50-68` | `lsRenewAll` iter `localStorage.length` 受其它 tab remove 影響 indices | ✅ Fixed: snapshot keys 先 |

### LOW (deferred to round 3)

| # | Location | Issue | Status |
|---|----------|-------|--------|
| L1 | `errors.ts` | `ApiError.code` 缺 length cap (malicious server giant code 串字) | ✅ Round 3 v2.33.38 |
| L2 | `errors.ts:sniffErrorCode` | `includes('admin')` 誤命中 "administered" / 「已系統管理員處理」 | ✅ Round 3 v2.33.38 |
| L3 | `localStorage.ts` | `LS_PREFIX = 'tp-'` 太短 cross-app collision risk | ❌ Won't fix: bump prefix 會 invalidate 既有 user data，LOW 不值 |
| L4 | `localStorage.ts:31` | `JSON.parse` 同 origin 攻擊者寫 malformed envelope shape | ✅ Round 3 v2.33.38 `isLsEntry` guard |
| L5 | `routes.ts` | 無 shared `safeReturnTo(s)` helper | ✅ Round 3 v2.33.38 |
| L6 | `weather.ts:148` | `weatherCache` Record FIFO 不是 LRU | 🔄 Deferred (not material at 20 entries) |
| L7 | `weather.ts:102` | `Math.abs(lat-lastLat) < 0.01` ≈ 1km 只在赤道 | 🔄 Deferred: coarse filter 足夠 |
| L8 | `drag-strategy.ts:93` | `parseClockToMinutes(...)!` double-parse + non-null assertion | ✅ Round 3 v2.33.38 |
| L9 | `constants.ts:27` | `EXTERNAL_NAVIGATION_URL_BASE` unused export | ✅ Round 3 v2.33.38 deleted |
| L10 | `lib/maps/region.ts:79` | `regionToCountryCode` 零 production caller | ✅ Round 3 v2.33.38 marked @deprecated |
| L11 | `mapDay.ts:223` | `(poi as { rating?... })?.rating` redundant cast | ✅ Round 3 v2.33.38 removed |
| L12 | `mapDay.ts:131` | `buildLocation` unused `_lat`/`_lng` params | 📋 Backlog (minor) |
| L13 | `events.ts:11` | Detail map type missing — 每 dispatch site re-type | 📋 Backlog |
| L14 | `sanitize.ts:43-49` | `\0javascript:` whitespace-prefix attack vector | 🔄 Deferred: DOMParser normalize 已防 |
| L15 | `dayArtMapping.ts` | O(keywords × titles) per call — 600 substring checks | 🔄 Deferred: 60ms upper bound 不痛 |

## Tests added

- `sanitize-uri-attrs.test.ts` — 10 XSS attack vector regression
- `trip-export-safety.test.ts` — `safeFileBase` + `csvSafe` 行為
- `errors-detail-cap.test.ts` — 200 char cap + strip newline
- `api-client-content-type.test.ts` — GET/POST(string/FormData/URLSearchParams)/caller-Content-Type
