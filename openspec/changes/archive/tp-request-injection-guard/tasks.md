# Tasks: tp-request prompt injection 防護

- [x] T1: Layer 1 — 修改 tp-request SKILL.md 加安全邊界
- [x] T2: Layer 2 — _middleware.ts 加 X-Request-Scope 檢查
- [x] T3: Layer 3 — _validate.ts 加 sanitizeReply + requests/[id].ts 呼叫
- [x] T4: tp-request-scheduler.ps1 加 X-Request-Scope header
- [x] T5: Review + Test + Ship
