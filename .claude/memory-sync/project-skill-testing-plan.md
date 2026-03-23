---
name: project-skill-testing-plan
description: 待執行的 tp-* skill 壓力測試計畫（commands→skills 遷移後）
type: project
---

tp-* skills 已從 .claude/commands/ 遷移到 .claude/skills/（2026-03-16）。全部 5 個高/中風險 skill 已通過壓力測試。

**Why:** 遷移過程中 tp-rebuild 移除了內嵌規則副本、所有 cross-reference 改為 description 自動載入，需驗證 agent 在新架構下仍能正確執行。

**How to apply:** 壓力測試已全部完成，此計畫可歸檔。

## 已完成

- tp-check：3 個壓力測試 → 4 個漏洞修正 → REFACTOR 驗證通過
- tp-edit：3 個壓力測試 → 5 個漏洞修正（R range R1-R14→R0-R15、POI checklist、travel 明確化、git status pre-check、R1-R12 不一致）
- tp-rebuild：2 個漏洞修正（git status pre-check、travel 明確化）
- tp-create：2 個漏洞修正（Phase 0 git status、POI 必填欄位 checklist）
- tp-request：5 個漏洞修正（R1-R13→R0-R15 x3 處、POI checklist、Korean naverQuery、travel 明確化、git checkout . 改為 scope 限定）
- tp-deploy, tp-run, tp-shutdown：純流程操作，跳過
- tp-quality-rules, tp-search-strategies, tp-hig：知識庫，被動載入，跳過
- tp-patch, tp-rebuild-all：委託其他 skill，低風險

## 跨 skill 共通修正模式

| 模式 | 影響的 skill | 修正 |
|------|-------------|------|
| R range 不完整（遺漏 R0/R14/R15） | tp-edit, tp-request | 統一為 R0-R15 |
| 新增 POI 缺必填欄位指引 | tp-edit, tp-create, tp-request | 加 source/note/maps/rating checklist |
| travel 步驟模糊 | tp-edit, tp-rebuild, tp-request | 明確寫「插入/移除 entry 時重算相鄰 travel」 |
| git checkout 缺 pre-edit check | tp-edit, tp-rebuild, tp-create, tp-request | 加 Step 0 記錄 pre-existing 變更 |
| 失敗還原範圍太大 | tp-request | `git checkout .` → `git checkout -- data/trips-md/{tripId}/` |
