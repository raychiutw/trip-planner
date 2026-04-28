## ADDED Requirements

### Requirement: /map page entry cards horizontal scroll MUST 在 desktop 也 visible

`/map` page 的 entry cards horizontal-scroll region MUST 在 desktop（≥1024px）viewport 也 render 並 visible，不得僅 `display: block` only on mobile breakpoint。對應 mockup section 20 line 7649-7748 規範 entry cards 雙向 sync 設計。

#### Scenario: Desktop /map entry cards 可見

- **WHEN** 使用者在 1280×900 viewport 開啟 `/map`
- **THEN** `.tp-map-entry-stack` 或 `.tp-global-map-mobile-stack` container SHALL `getBoundingClientRect().height > 0` AND `getComputedStyle().display !== 'none'`

#### Scenario: Class name alias 移除 mobile- 前綴

- **WHEN** 開發者搜尋 entry cards container 的 CSS class
- **THEN** `.tp-map-entry-cards` SHALL 為 canonical class name；既有 `.tp-global-map-mobile-cards` 作為 backward-compat alias 保留

---

### Requirement: /map page MUST NOT 使用 floating top day strip pills

`/map` page MUST NOT render floating top「全覽 / 我的位置」chips bar 在 map canvas 上方。對應 mockup section 20 規範「不用 floating top day strip」+ map FAB 位置。

#### Scenario: Desktop /map「全覽」「我的位置」位於 right-bottom FAB

- **WHEN** 使用者在 desktop `/map`
- **THEN** `.tp-global-map-actions` SHALL `position: absolute; right: ...; bottom: ...`，不在 top-left 浮動位置
