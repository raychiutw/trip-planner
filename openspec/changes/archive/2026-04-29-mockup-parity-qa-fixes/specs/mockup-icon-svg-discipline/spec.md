## ADDED Requirements

### Requirement: Modal / Dialog close button MUST 使用 SVG icon sprite reference

任何 modal、dialog、sheet 的 close button SHALL 使用 inline SVG icon (`<Icon name="x-mark" />`)，且 MUST NOT 直接以 UTF-8 字元（如「✕」「×」「✗」「✘」）作為 visible label。延續 `CLAUDE.md` 「icon 用 inline SVG，不用 emoji」明文規範到 modal scope。

#### Scenario: NewTripModal close button 使用 SVG

- **WHEN** 使用者在 `/trips` 點「新增行程 `+`」開啟 NewTripModal
- **THEN** `.tp-new-form-close` element SHALL 包含 `<svg>` element 且 `innerHTML` MUST NOT 包含「✕」字元

#### Scenario: AddStopModal close button 使用 SVG

- **WHEN** 使用者在 `/trip/:id` 點「+ 加景點」開啟 AddStopModal
- **THEN** modal header 上的 close button SHALL 包含 `<svg>` element
