# 三色系統 design spec（探索保留，未落地）

> **狀態：DESIGN SPEC，尚未實作。** 2026-06-06 探索定案，待決定落地時機。
> 現行 DESIGN.md「單一 terracotta」單主題仍是 prod 生效規範；本 spec 不改變現狀，只記錄探索結論。
> 來源參考：ままほいくえん（mamahoikuen.jp）的暖柔三色系統。
> 視覺 mockup：`2026-06-06-three-color-mockup.html`（右上鈕切 light/dark）。

## 背景

DESIGN.md 把「單一 terracotta accent」定為核心差異化（非六主題、非冷藍 Ocean）。因「色系太過單調」需求，參考 mamahoikuen.jp 的柔和三色，探索 trip-planner 的三色系統候選。這是設計系統級變更（換主色 + 建立三色），影響全站，故先存 spec、不倉促動 code。

## 三色定案

### Light
| 角色 | accent | deep | subtle | bg |
|------|--------|------|--------|-----|
| 主 · 柔褐 | `#A97A4A` | `#8A6038` | `#F4EDE3` | `#E9DBC8` |
| 第二 · sage 綠 | `#A8BAAA` | `#7E9580` | `#ECF0ED` | `#D4DDD5` |
| 第三 · 玫瑰粉 | `#E78C99` | `#C66B78` | `#FAF1F3` | `#F2DBE0` |

### Dark
| 角色 | accent | deep | subtle | bg |
|------|--------|------|--------|-----|
| 主 · 柔褐 | `#CBA06E` | `#A97A4A` | `#33271A` | `#44341F` |
| 第二 · sage 綠 | `#8FBE9C` | `#A4CBAF` | `#243A2C` | `#2E3D30` |
| 第三 · 玫瑰粉 | `#E8A0AB` | `#CC8590` | `#33232A` | `#43303A` |

中性色（背景 / 文字 / border / line-strong）維持 trip-planner 既有：light 奶油底、dark 暖褐黑（Terracotta Dark）。

## 用途規範

| 色 | 用在 | 不用在 |
|----|------|--------|
| **主 柔褐** | CTA、active state、link、景點·餐廳 icon、分類 chip、★rating、active day / nav | — |
| **sage 綠** | 交通資訊（travel connector、車程/步行 badge）、地圖類次要 | 主 CTA、品牌重點 |
| **粉** | 收藏 / 愛心、備選標記、活動類標籤 | 主 CTA、交通 |

原則沿用「一個 accent 守重點」精神，但擴成三色分工：主色守重點、sage 守交通、粉守收藏/備選。三色各司其職，不交叉。

## 決策記錄

- **主色**：定柔褐 `#A97A4A`（mamahoikuen）取代 terracotta `#D97848`。對照後選柔調（整體更柔、貼近參考安心感）。替代方案保留 `#D97848` 未採用。
- **第二色**：sage 綠。探索過冷色（sage/teal/blue，user：不要冷色）、暖色（olive/mustard/rose，rose/mustard 與 terracotta 糊、olive 偏綠），最終回到 mamahoikuen sage。
  - **深色 sage 定 `#8FBE9C`**（明確飽和）；初版 `#B5C7B7` 太灰被換掉。light/dark 同色相一致。
- **第三色**：玫瑰粉 `#E78C99`（mamahoikuen「スタッフ募集」圓）。

## 來源色碼（從 mamahoikuen.jp 讀取）

| 色 | rgb | hex | 採用 |
|----|-----|-----|------|
| 暖橘褐 | rgb(169,122,74) | `#A97A4A` | ✅ 主色 |
| sage 綠 | rgb(168,186,170) | `#A8BAAA` | ✅ 第二色 |
| 玫瑰粉 | rgb(231,140,153) | `#E78C99` | ✅ 第三色 |
| 可可灰褐 | rgb(161,141,120) | `#A18D78` | ❌ 與主色太近 |
| 奶油底 | — | `#EFEEEA` | 參考（trip-planner 用 `#FFFBF5`） |

## 落地計畫（待執行）

這是全站改版，影響：

1. **tokens.css**：`--color-accent` 換柔褐 + 新增 `--color-accent-2-*`(sage) / `--color-accent-3-*`(粉)，light + dark 都要。
2. **DESIGN.md Color section**：核心理念「單一 terracotta」→ 三色系統，重寫用途；連 mockup 定位「V2 Terracotta」需重新命名。
3. **全站元素套色**：交通 → sage、收藏/備選 → 粉，逐 component 改（大量 CSS）。
4. **terracotta-preview mockup** 更新。
5. 順帶修：DESIGN.md 寫 `info = #3B7EA1` 但 tokens.css 實際 `--color-info: #D97848`（drift），落地時一併對齊。

**建議路徑**：試點 trip 明細頁（tokens + 一頁套色，light+dark）→ 真實 app 驗證 → 滿意再推全站。

## Mockup 參考

`2026-06-06-three-color-mockup.html` — trip 明細頁三色示意，右上鈕切 light/dark。
