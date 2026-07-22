# ADR-0002：自建 V2 OAuth，不用 Cloudflare Access

- **Status**：Accepted（v2.21.x 起生效）
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

需要使用者認證。Cloudflare Access 是現成方案，但強制綁 Google identity provider，且每位使用者每月 $3。

## Decision

自架 OAuth server：opaque session cookie + HKDF + Bearer service token + `client_credentials` grant。

## Consequences

- 打破 vendor lock-in，成本降到零，identity provider 不再被綁定。
- **代價**：自己管 session store、密碼 hash（PBKDF2 600k → Argon2id self-describing）、token rotation。
- Migration runbook：`docs/runbooks/oauth-env-setup.md`。
- 授權模型後來演進為 owner/permissions + service-token ops scope（全域 admin 角色於 v2.55.5–v2.55.7 移除）。
