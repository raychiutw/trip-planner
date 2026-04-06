---
name: tp-shared
description: Shared API settings, POI field specs, doc structure, and travel semantics for all tp-* skills. Not invoked directly — referenced by other tp-* skills.
user-invocable: false
---

所有 tp-* skill 共用的定義和規範集中地。

完整內容見 `references.md`，涵蓋：
- API Base URL + 認證 headers
- curl 模板（Windows encoding 解法）
- POI 欄位規格（各 type 必填/建議欄位）
- 資料所有權（pois vs trip_pois）
- API 操作端點
- Markdown 支援欄位
- travel 欄位語意（鐵律）
- Doc 結構規格 + 連動規則（鐵律）
- 品質規則索引（→ tp-quality-rules）
