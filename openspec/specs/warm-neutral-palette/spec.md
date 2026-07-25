# warm-neutral-palette — ⚰️ 已退役（2026-07-25）

## Purpose

**這份 spec 已退役。** 它是一次色盤遷移的 delta（首行原本就是 `## MODIFIED Requirements`），內含「歷史變動紀錄」段落 —— 記錄的是當時刪了哪些別名、改了哪些名字。遷移完成後即凍結為歷史，卻被當成持續有效的規格留在 `specs/`。

保留為 tombstone，**不要照原內容重建**。

## Requirements

### Requirement: 本 capability 已退役

`warm-neutral-palette` SHALL 不再被視為 active spec。色彩現況以 `css/tokens.css` 為權威、`DESIGN.md` 為設計 SoT。

#### Scenario: 有人想重建這份 spec

- **WHEN** 未來有人要為色盤建立 spec
- **THEN** SHALL 先確認色盤代次 —— 本文件描述的是 `#C4704F` 那一代，早已被柔褐 `#A97A4A` + cream `#FFFBF5` 取代

## 為什麼退役

2026-07-25 逐條對照 `css/tokens.css`：提及 29 個 token，**26 個不存在**。它列的整張色彩變數表（`--accent` `#C4704F`、`--bg` `#FAF9F5`、`--text`、`--border`…）用的是 Tailwind v4 遷移前的命名，且色值已隔兩代。

## 各 Requirement 去向

| 原 Requirement | 去向 |
|---|---|
| 全站 CSS 色彩變數定義於 shared.css | **搬** — 定義處是 `css/tokens.css` 的 `@theme`，命名全面改為 `--color-*`。色值另見 `tokens.css`（本 spec 的值已過時兩代）。 |
| 深色模式覆蓋規範 | **搬** — `body.dark` 覆寫的模式仍成立，見 `tokens.css`。 |
| stickyNav 與 Day 1 間隔 | **丟** — 屬版面，SoT 是 `DESIGN.md`。 |
| 深色模式 info-box 統一 | **丟** — `.info-box` 屬 pre-SPA class，已不存在。 |
| 全站 CSS 不得引用已刪除的別名變數 | **丟** — `--blue`/`--sand`/`--gray`/`--white` 的清除是一次性遷移指令，早已完成。 |
| sidebar 與 drawer 深色模式背景 | **丟** — 該 class 屬 pre-SPA 架構；現行桌機 sidebar 是 `DesktopSidebar`，材質規範在 `DESIGN.md` §10.1。 |
