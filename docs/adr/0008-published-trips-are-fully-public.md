# ADR-0008：已發布行程對匿名讀者全公開 —— 隱私邊界畫在「筆記區塊」，不在行程本體

- **Status**：Accepted
- **來源**：2026-10-09 架構審查中發現匿名讀者讀已發布行程會拿到每個景點的 `reservation`／`reservation_url`／`note`（#1426），owner 決定維持現狀。

## Context

匿名 `GET /api/trips/:id/days/:num`（對 `published = 1` 的行程）會回傳每個景點的 `reservation`（訂位註解）、`reservation_url`、`note`、`description`。API 測試實證過（見 `tests/api/published-trip-public-body.integration.test.ts`）。

這看起來像洩漏，但分享連結那一側的程式本來就這樣設計：`_share.ts` 的 `loadVisibleShareData` 註解寫明「always-public trip body（reusing `buildAllDays` — byte-identical to the authed view）+ ONLY the share's visible note sections」。

## Decision

**行程本體對匿名讀者永遠公開；隱私邊界只畫在「筆記區塊」。**

| 層 | 內容 | 匿名讀者（已發布／分享連結） |
|---|---|---|
| 行程本體 | days／entries／POIs，含每個景點的 `description`、`note`、`reservation`、`reservation_url` | **看得到**（分享連結與已發布行程一致） |
| 筆記區塊 | 航班、住宿、訂位表、行前、緊急聯絡人 | **預設看不到**；分享連結以 `visibleSections` 逐項開放 |

「發布」或「建立分享連結」就是 owner 決定公開行程本體。要放私人資訊（訂位人姓名、確認碼、電話）請放進**筆記區塊**，不要寫在景點的 `reservation`／`note`。

## Consequences

- 匿名讀取路徑**不**依 `requireTripReadAccess` 回傳的 `{ published, isMember }` 過濾欄位；該回傳值目前沒有呼叫端使用，不是遺漏。
- 匿名可讀表格（`trips`、`trip_days`、`trip_entries`、`pois`）因為用 `SELECT *`，新增欄位會自動公開 —— `tests/unit/trips-public-columns.test.ts` 的欄位白名單會迫使新增欄位時明確決定要不要公開。
- 日後有人（包含 AI 審查）再把「匿名讀到 `reservation`」當成漏洞提出，先讀這份。要改隱私模型是另一個決定，要同時處理 `/api/trips/:id/days*`、分享連結、clone 三個入口，並新增 `visibleSections` 項目讓 owner 自己選。

## Considered Options

**匿名讀者隱藏 per-POI 的 `reservation`／`note`（否決，#1426）。** 需要三個入口一致，並重定義「行程本體」與「筆記區塊」的邊界；owner 認為現行模型已足夠，且『發布』本來就是公開的意思。
