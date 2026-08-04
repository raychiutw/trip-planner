# Tripline (for Gemini CLI / 其他 AI agent)

> **2026-05-02 更新**：本檔之前停留在 V1 era（vanilla JS + markdown 來源），與現況差距過大。已重寫為各文件 redirect。請依下表查詢正確資訊：

| 想知道什麼 | 看哪份文件 |
|---|---|
| 專案目標 + 功能列表 | [README.md](README.md) |
| 架構（tech stack、topology、資料模型、auth、部署） | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 上手 / 跑起來 / 跑測試 / commit 規則 | [CONTRIBUTING.md](CONTRIBUTING.md) |
| 設計系統（V2 Terracotta、tokens、版型） | [DESIGN.md](DESIGN.md) |
| 開發工作流與發布規則 | [AGENTS.md](AGENTS.md) |
| 專案事實、命名歷史與環境變數 | [CLAUDE.md](CLAUDE.md) |
| 待辦 / 已完成項目 | [TODOS.md](TODOS.md) |
| 進行中需求與規格 | [GitHub Issues](https://github.com/raychiutw/trip-planner/issues) |
| 版本紀錄 | [CHANGELOG.md](CHANGELOG.md) |

## 給 AI agent 的最低限度 onboarding

- **Tech**：React 19 + Vite + Cloudflare Pages Functions + D1 SQLite。**不是** vanilla JS、**不是** markdown source。
- **資料**：行程在 D1 `trips` / `trip_days` / `trip_entries` 表，POI 走 `pois` master + `trip_entry_pois` junction (v2.27.0 多 POI per entry)。`trip_pois` 已 DROP (v2.29.0 migration 0062)。`data/dist/` 已不存在。
- **Skills**：程式變更依 `AGENTS.md` 的 Matt Pocock 工作流；`/tp-create`、`/tp-edit`、`/tp-check` 等行程資料技能直接走 API，skill 定義同步放在 `.codex/skills/` 與 `.claude/skills/`。
- **語言**：所有溝通與 commit message 用繁體中文（台灣）。
- **Workflow**：依工作規模走 Matt Pocock 官方技能鏈，再套用 Tripline 的 feature branch、驗證與 PR 規則，詳見 `AGENTS.md`。
- **規則**：代理流程依 `AGENTS.md`，架構依 `ARCHITECTURE.md`，UI/UX 依 `DESIGN.md`。

## 為何重寫

舊版 GEMINI.md 描述的「Markdown 來源 → JSON build」於 V2 架構大改後（2026-04 V2 OAuth + POI Schema 正規化）已不存在。留著錯誤資訊比沒有更糟，故改 redirect。
