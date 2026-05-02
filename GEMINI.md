# Tripline (for Gemini CLI / 其他 AI agent)

> **2026-05-02 更新**：本檔之前停留在 V1 era（vanilla JS + markdown 來源），與現況差距過大。已重寫為各文件 redirect。請依下表查詢正確資訊：

| 想知道什麼 | 看哪份文件 |
|---|---|
| 專案目標 + 功能列表 | [README.md](README.md) |
| 架構（tech stack、topology、資料模型、auth、部署） | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 上手 / 跑起來 / 跑測試 / commit 規則 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 設計系統（V2 Terracotta、tokens、版型） | [DESIGN.md](DESIGN.md) |
| 開發流程 + gstack pipeline + 環境變數 | [CLAUDE.md](CLAUDE.md) |
| 待辦 / 已完成項目 | [TODOS.md](TODOS.md) |
| 進行中規格 | [SPEC.md](SPEC.md) |
| 版本紀錄 | [CHANGELOG.md](CHANGELOG.md) |

## 給 AI agent 的最低限度 onboarding

- **Tech**：React 19 + Vite + Cloudflare Pages Functions + D1 SQLite。**不是** vanilla JS、**不是** markdown source。
- **資料**：行程在 D1 `trips` / `trip_days` / `trip_entries` 表，POI 走 `pois` master + `trip_pois` 覆寫。`data/dist/` 已不存在。
- **Skills**：以 Claude Code skills 為主（`/tp-create` `/tp-edit` `/tp-check` 等走 API），非 Gemini CLI。Gemini CLI 也可用，但 skill set 在 `.claude/skills/` 不是 `.gemini/skills/`。
- **語言**：所有溝通與 commit message 用繁體中文（台灣）。
- **Pipeline**：code 變更走 7 階段（Think → Plan → Build → Review → Test → Ship → Reflect），詳見 CLAUDE.md。
- **規則**：`openspec/config.yaml` 定義強制規範，不論是否走 OpenSpec 流程都遵守。

## 為何重寫

舊版 GEMINI.md 描述的「Markdown 來源 → JSON build」於 V2 架構大改後（2026-04 V2 OAuth + POI Schema 正規化）已不存在。留著錯誤資訊比沒有更糟，故改 redirect。
