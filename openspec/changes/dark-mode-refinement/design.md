## Context

Dark mode 缺乏層次感（卡片同色、shadow 不可見、separator 太暗）。同時 Zen dark 和 Sun dark 太接近，需要用「降低飽和度」策略拉開差異，複製淺色模式的差異邏輯。

## Goals / Non-Goals

**Goals:**
- Elevated surface 三層色調（越高越亮）
- Shadow 改用 glow + highlight border
- Separator 用半透明白色
- Zen dark 降飽和度，與 Sun dark 拉開差異
- Forest dark 微調讓綠色更明顯

**Non-Goals:**
- 不改 light mode
- 不改 accent 色（品牌色）

## Decisions

### D1. Elevated Surface 三層
```
背景（最暗）→ 卡片（稍亮 + 頂部微光）→ Sheet 面板（更亮 + accent tint）→ FAB（glow）
```
用 `body.dark` 選擇器統一處理，6 個主題都適用。

### D2. Zen Dark 降飽和度策略

淺色差異策略：Sun = 高飽和暖色 vs Zen = 低飽和暖色
深色複製同樣策略：Sun dark = 中飽和暖棕 vs Zen dark = 更灰的暖色

| Token | Sun dark（不改） | Zen dark（改後） |
|---|---|---|
| background | #1E1A16 | #1B1918（更灰） |
| secondary | #2A2520 | #242220（更灰） |
| tertiary | #36302A | #302E2A（更灰） |
| hover | #332C26 | #2C2A26（更灰） |
| foreground | #EAE2D6 | #E4DED4（微灰） |
| muted | #B0A698 | #908580（明顯更灰柔） |
| border | #3E3830 | #363330（更灰） |
| scrollbar-thumb | 不改 | #403C38（更灰） |

Accent #D4A88E 保持不變。

### D3. Forest Dark 微調
| Token | 改前 | 改後 |
|---|---|---|
| background | #161C18 | #141A16（綠調更強） |
| muted | #8AB090 | #80A888（更沉穩） |

### D4. Shadow → Glow（所有深色主題）
```css
body.dark .tl-card {
  box-shadow: 0 1px 0 rgba(255,255,255,0.04);
}
body.dark .edit-fab,
body.dark .quick-panel-trigger {
  box-shadow: 0 0 20px color-mix(in srgb, var(--color-accent) 30%, transparent),
              0 2px 8px rgba(0,0,0,0.4);
}
body.dark .tl-segment {
  border-left-color: rgba(255,255,255,0.12);
}
```

## Risks / Trade-offs
- **[Risk] 降飽和度後 Zen dark 可能太灰** → Mitigation：保留 accent 暖陶土色，核心暖意不丟失
- **[Risk] 6 主題統一 body.dark 規則可能與特定主題衝突** → Mitigation：用 CSS specificity 讓主題特定規則優先
