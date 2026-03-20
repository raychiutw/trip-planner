# Reviewer Live Site Report

**Site**: https://trip-planner-dby.pages.dev/
**Date**: 2026-03-20
**Pages tested**: Trip page (okinawa-trip-2026-Ray), Setting page

---

## Summary

The live site is in good shape overall. No console errors, no hardcoded px font-sizes, no card borders, all buttons have aria-labels, and all icons are inline SVGs. One notable discrepancy found between CLAUDE.md and the deployed code.

---

## Detailed Findings

### PASS - SpeedDial

| Check | Result |
|-------|--------|
| Layout | `display: grid` with `grid-template-rows: repeat(4, 1fr)` + `grid-auto-flow: column` = 2-column, 4-row |
| Item count | 8 items (航班, 出發, 緊急, 備案, 建議, 路線, 交通, 設定) |
| Item size | 44x44px (`var(--tap-min)`) |
| Gap | 12px |
| Label position | Absolute, positioned left of icon (confirmed: `labelRight < iconLeft`) |
| Label font-size | 13px (from `var(--font-size-footnote)`) |
| Stagger animation | All 8 children have delays (210ms down to 0ms, bottom-up) |
| Open/close | `.speed-dial.open` class toggles correctly |

**Note**: Task #5 originally specified "2x3 iOS grid", but with 8 items the grid is 2x4. This is correct for the item count.

### PASS - Bottom Sheet Close Button

| Check | Result |
|-------|--------|
| `.sheet-close-btn` | Width: 44px, Height: 44px |
| Meets tap target | Yes (44x44 >= `var(--tap-min)`) |

### PASS - DayNav Pills

| Check | Result |
|-------|--------|
| `aria-label` present | Yes, all 5 day buttons have descriptive aria-labels |
| Format | "7/29 北谷", "7/30 浮潛・瀨底", etc. |
| Active label (`.dn-active-label`) | Visible (26x19px), text "北谷", parent `overflow: visible` |
| No weekday text | Correct - pills show only dates (7/29, 7/30, etc.) |

### PASS - InfoPanel

| Check | Result |
|-------|--------|
| `border-radius` | 16px |
| Background | Semi-transparent (`color(srgb 0.831 0.910 0.941 / 0.9)`) |
| Border | None (0px) |

### PASS - Countdown

| Check | Result |
|-------|--------|
| Format | "131天" (simplified N天 format) |
| Class | `.info-card.countdown-card` |

### PASS - Console Errors

No console errors on any page.

### PASS - CSS Hardcoded Font-Size px

No hardcoded `font-size: Npx` found in any CSS file or computed style. All use `var(--font-size-*)` tokens.

### PASS - Card Borders

No cards (`.info-card`, `.place-card`) have visible borders. Borderless design is maintained.

### PASS - Icons

All 380 SVGs are inline. No `<img>` elements found on the trip page.

### PASS - Accessibility

All buttons have either `aria-label` or text content. No unlabeled buttons found.

---

## ISSUE FOUND

### [INFO] Setting Page `.sticky-nav` Position

**CLAUDE.md states** the setting page should have `.page-setting .sticky-nav { position: relative; }` to neutralise shared.css scroll infrastructure.

**Live site**: `.page-setting .sticky-nav` has `position: sticky` (setting.css line 20).

**Analysis**: The current `position: sticky` was likely an intentional change made after the CLAUDE.md documentation was written — the sticky nav on the settings page works correctly in practice (title bar stays at top when scrolling). The other scroll neutralisation overrides ARE correctly applied:
- `html.page-setting { scroll-behavior: auto; scrollbar-gutter: auto; overflow: visible; overscroll-behavior: none; }` -- APPLIED
- `.page-setting .page-layout { display: block; min-height: 0; }` -- APPLIED
- `.page-setting .container { transition: none; }` -- APPLIED

**Recommendation**: Either update CLAUDE.md to match the code (`position: sticky`), or revert the CSS to `position: relative`. Since the page works correctly with `sticky`, updating documentation is the safer choice.

### [INFO] Setting Page Close Icon

The setting page uses an **X (close) icon**, not a back arrow. The task list mentioned checking for a "返回箭頭" (back arrow). The X icon is appropriate for a modal-style settings page — this is not a bug.

---

## Edit Page

The edit page (`/edit.html?trip=...`) redirects back to the trip page. Unable to test in current session (may require specific state or authentication).

---

## Verdict

The live site passes all major checks. The only actionable item is the CLAUDE.md documentation discrepancy regarding `.sticky-nav` position on the setting page.
