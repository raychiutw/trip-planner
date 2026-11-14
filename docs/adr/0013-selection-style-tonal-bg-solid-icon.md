# ADR-0013：選取樣式＝淡柔褐底 + 深柔褐前景 + 實心圖示，取代實心 accent-fill 膠囊

- **Status**：Accepted（2026-11-14，owner 簽核 #1703 原型變體 B；實作 #1707）。取代 2026-07-24 的「root tab／Day tab 選中＝實心 `--color-accent-fill` 膠囊 + 白字」決策（原記於 `DESIGN.md`，無獨立 ADR）。
- **來源**：#1692（桌機 HIG／App 對齊 spec）、#1703（原型）、App 端 ADR-0004（選取指示＝中性底 + tint 前景）。

## Context

同一個產品有兩套選取語言：桌機側欄是淡柔褐底配中性字（#1689），手機底部膠囊與 Day tab 卻是實心柔褐 + 白字。選中 icon 與未選 icon 同為外框線條，只靠底色分辨；未選 icon 還是柔褐，等於 tint 沒有「選中」的資訊量；聊天頁上「聊天」與目前行程兩列同樣淡底，沒有主次。App 端 ADR-0004 的規則是「選取＝中性底 + tint 前景」。

## Decision

- **四處選中底統一**：手機底部膠囊、Day tab、側欄主導覽，一律 `--color-accent-bg`（不透明淡柔褐）。App 的「中性底」在 Web 的暖色語境下取近似：淺、不飽和、非實心。
- **選中前景**＝新 token `--color-selected-fg`（淺色 `#6F4C2C`、深色 `#D0A576`）。`#8A6038` 疊在 accent-bg 只有 4.55:1，11px label 太緊；`#6F4C2C` 對 accent-bg 6.31、對頁面底 7.42；深色 `#D0A576` 對深色 accent-bg 5.74。`#8A6038`（`--color-accent-fill`）從此只當**填色面**（主要按鈕等），不再用於選取。
- **選中不只靠顏色**：選中 icon 換實心版本（`nav-chat-fill`／`nav-suitcase-fill`／`nav-map-fill`／`nav-fav-fill`），未選 icon 退 `--color-muted`。
- **主次**：聊天頁「聊天」是主（膠囊）；側欄「我的行程」的目前行程是脈絡、為次——不給底，只有字重 700 與左側 3px 柔褐短條。`/trips?selected=` 同理。
- 因為底是不透明色，Day tab 疊在地圖玻璃上時前景對比（6.31／5.74）與底下內容無關。

## Considered Options

- **A 中性灰膠囊、並列同強度**：最貼 App，但灰膠囊在暖奶油底上偏冷、辨識度低；深色 tint 對中性膠囊只有約 3.9:1；聊天頁仍是兩個一樣重的選中。
- **C 行程為主、無底前景指示**：離 App 最遠、無底小字深色對比最吃緊、與 root tab「選中＝膠囊」的 HIG 直覺相反。

## Consequences

- 嚴格讀 App ADR-0004 這是「有色底」而非「中性底」，已由 owner 接受為 Web 的近似。
- 側欄新增「左側短條」視覺元素，僅用於「目前行程」。
