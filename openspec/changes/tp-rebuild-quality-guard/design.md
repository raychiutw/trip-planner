## Architecture

純文字規則修改，無程式碼架構變更。

## Approach

### 1. R7 飯店購物 infoBox 生成 checklist

在 `/tp-rebuild.md` R7 段落末尾加入明確的兩階段 checklist：

```
#### 飯店購物 infoBox checklist（兩階段）

**階段 1：驗證既有**
- 所有 shopping infoBox 的 shop.category 是否為 7 類標準分類之一
- 每個 shop 是否含 category/name/hours/mustBuy(≥3)/blogUrl
- 是否有 souvenir type 殘留需改為 shopping

**階段 2：生成缺漏**
- 逐日檢查：hotel 物件是否有 infoBoxes 陣列？
- 若無 infoBoxes 或無 type=shopping → 新建 shopping infoBox
- 搜尋飯店名稱 + 附近超市/超商/唐吉軻德，補到 3+ shops
- shopping infoBox 放在 hotel.infoBoxes，不放在 timeline entry
```

### 2. R2 一日遊午餐

修改 R2 的一日遊 scenario，從「不補午餐」改為：
- 插入午餐 timeline entry，`title` 為「午餐（團體行程已含）」
- 不附 `infoBoxes[type=restaurants]`
- 讓行程表上看得到午餐存在，但不給無意義的推薦

### 3. titleUrl/blogUrl 可選

- R4 `titleUrl`：已有「找不到官網則不放」→ 維持不變
- R4 `blogUrl`：加入「查不到適合的繁中文章時 blogUrl 為 null」
- R5 `blogUrl`：同上
- R6 搜尋方式：加入「搜尋無結果或結果不相關時，blogUrl 設為 null」

## Affected Files

| 檔案 | 變更 |
|------|------|
| `.claude/commands/tp-rebuild.md` | R2/R4/R5/R7 規則文字更新 |
| `openspec/specs/trip-enrich-rules/spec.md` | R2/R4/R5/R6/R7 scenario 更新 |

## Risks

- 規則文字越長，agent 遵守的注意力成本越高 → checklist 用條列式、放在規則末尾
