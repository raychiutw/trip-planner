# Plan: pr7-og-preview

## 執行順序

```
F001（生成圖片）→ F002（index.html meta）→ F003（TODOS.md）→ F004（_headers）
```

依賴關係：
- F001 必須先執行 — F002 的 og:image URL 指向 F001 生成的檔案
- F002 可以在 F001 圖片生成前先寫測試（F002 紅）
- F003 純文件，任何時候都可以做
- F004 獨立，只依賴 `public/_headers` 檔案存在（已存在）

## F001 — 靜態 brand OG image

1. 先寫 `tests/unit/og-image.test.ts`（紅）
2. 安裝 `sharp`：`npm install --save-dev sharp`
3. 建 `scripts/generate-og-image.mjs`
4. 執行腳本生成 `public/og/tripline-default.png`
5. 跑測試確認綠

**Commit**: `test(og): F001 red — og-image.test.ts`
**Commit**: `feat(og): F001 green — generate static brand OG image`

## F002 — index.html OG meta

1. 先寫 `tests/unit/og-meta.test.ts`（紅）
2. 更新 `index.html`：補 `og:image`、尺寸 meta、twitter card
3. 跑測試確認綠

**Commit**: `test(og): F002 red — og-meta.test.ts`
**Commit**: `feat(og): F002 green — index.html OG + Twitter card meta`

## F003 — TODOS.md

1. 在 `TODOS.md` 加 dynamic OG roadmap 段落

**Commit**: `docs(todos): F003 — dynamic OG roadmap`

## F004 — _headers Cache-Control

1. 先寫 `tests/unit/og-headers.test.ts`（紅）
2. 更新 `public/_headers`
3. 跑測試確認綠

**Commit**: `test(og): F004 red — og-headers.test.ts`
**Commit**: `feat(og): F004 green — _headers /og/* Cache-Control`

## 最終整合

- 跑 `npm test` 全綠
- 跑 `npx tsc --noEmit` 0 errors
- 確認 `public/og/tripline-default.png` 大小 10KB–500KB

## Rollback 計劃

- F001：刪除 `public/og/tripline-default.png` + 腳本，無副作用
- F002：移除新增的 meta tags，恢復原 index.html
- F003：純文件，rollback = 移除段落
- F004：移除 `/og/*` rule，原 `_headers` 完全不受影響
