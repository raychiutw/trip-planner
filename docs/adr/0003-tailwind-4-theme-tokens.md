# ADR-0003：Tailwind CSS 4 + `@theme`，不用 CSS modules

- **Status**：Accepted（決策仍有效；**原始 Context 的前提已於 2026-07-25 更正**，見下）
- **來源**：自 `ARCHITECTURE.md` 的 Key Architectural Decisions 搬入（2026-07-22）

## Context

**原始前提（已不成立）**：需要支援 6 套主題（color theme × dark mode）的樣式切換。

**現況（2026-07-25 更正）**：多主題已退場，現在是 **single-theme** —— `css/tokens.css` 只有 `body.dark` 與 `body.theme-print` 兩個覆寫，`theme-sun` / `sky` / `zen` / `forest` / `sakura` / `night` 全部不存在（`tests/unit/tokens-css.test.ts` 有斷言鎖住）。色彩收斂為單一柔褐 accent（`--color-accent: #A97A4A`）+ cream 底（`#FFFBF5`）。

決策本身不受影響：`@theme` + custom property 仍是 token 定義處，light/dark 切換仍靠換值。只是「多主題」不再是採用它的理由，**dark mode 與列印樣式才是**。

## Decision

用 Tailwind CSS 4 的 `@theme` + CSS custom property 做 token 切換；元件層全用 utility class。不採用 CSS modules。

## Consequences

- light/dark 與列印樣式切換只需換 custom property 值，不需要重新編譯或載入不同 stylesheet。
- Utility class 減少 dead CSS。
- **代價**：token 命名與層級需要紀律（見 `DESIGN.md`）；`@theme` 的 tree-shake 行為曾造成 token 失蹤，新增 token 要確認有 consumer。
