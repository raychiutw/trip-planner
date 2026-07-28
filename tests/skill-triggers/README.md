# Skill 觸發率 fixture

每個 `<skill>.json` 是一組 `{query, should_trigger}`，用來量該 skill 的
description 對真實中文問法的命中率（`should_trigger: false` 的是**反例** ——
語意接近但應該路由到別的 skill）。

原本放在 `.claude/skills/tp-*-workspace/` 下。那些目錄沒有 `SKILL.md`，
所以不是 skill，卻因為位置而被當成 skill 目錄列出；同層還混著執行產出。
2026-07-29 把 fixture 搬來這裡、產出目錄整個刪除。

改 skill 的 `description` 後跑這些 fixture 重新量命中率。
