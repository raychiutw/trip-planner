# Sentry Alert Configuration Spec

**Last updated:** 2026-04-25 (B-P6 task 10.2)
**Project:** Sentry org `tripline` / project `tripline-react`
**Audience:** Ops / dev with Sentry web UI access

---

## Why this doc

`scripts/daily-check.js` 每日跑一次抓 Sentry unresolved issues 報 Telegram，但這是 24h batch。**realtime alert** 要在 Sentry web UI 設 issue alerts — 此 doc 列當前 spec。

如果改 threshold / 加新 alert，更新本檔 + commit；Sentry web UI 套用。

---

## Alert 1 — Error rate spike

**Trigger:** When the issue is seen more than `100 events` in `1 hour`
**Action:** Send notification to Telegram (via Sentry → Telegram integration)
**Owners:** Ray
**Why:** prod 正常 baseline ~ 5-20 events/hr（從 daily-check 24h average derive ~120-480/24h ≈ 5-20/hr）。100/hr threshold 是 baseline 5x，dev 不會誤觸發但能 catch real spike

## Alert 2 — New issue first seen

**Trigger:** A new issue is created (any severity)
**Action:** Email Ray
**Owners:** Ray
**Why:** 每個新 issue 都該被看到（即使只是 1 次），方便 triage 是 real bug 還是 noise

## Alert 3 — Critical level event

**Trigger:** An event's level equals `error` or `fatal` (not warning)
**Filter:** `environment:production` (排除 staging / preview)
**Action:** Send notification to Telegram + Email Ray
**Owners:** Ray
**Why:** Production error / fatal 都該 immediate aware

## Alert 4 — Crash-free rate (release health)

**Trigger:** Crash-free sessions rate < 99% over 1h
**Filter:** Latest release（B-P6 task 10.1 後 release name = `tripline@<ver>-<sha>`)
**Action:** Email Ray
**Why:** 監控新 release 是否引入 stability regression。99% 是 web SaaS 業界 baseline

---

## Setup steps（手動套用 in Sentry UI）

1. 登入 https://sentry.io/organizations/tripline/projects/tripline-react/
2. 左側 nav → **Alerts** → **Create Alert Rule** → **Issue Alert**
3. 為每個 alert（1-4）：
   a. 設 Conditions（依本 doc spec）
   b. 設 Action target（Telegram channel / email Ray）
   c. Save
4. Verify：`scripts/telegram-smoke.sh` 確認 Telegram channel work（task 10.4）

## Threshold revision flow

修 threshold 時：
1. 先在這檔 update spec + 解釋 why
2. PR review + merge
3. ops 在 Sentry web UI 套用新 threshold
4. 在 PR description 註明「Sentry UI 已套用 on YYYY-MM-DD」

避免 spec / actual 漂移。

---

## Reference

- daily-check.js querySentry — 24h batch report (already in place)
- telegram-smoke.sh — Telegram channel sanity check (B-P6 task 10.4)
- sentry-release-config — release tagging on build (B-P6 task 10.1)
- B-P6 layout-refactor-polish-qa task 10.2 — this doc is the spec
