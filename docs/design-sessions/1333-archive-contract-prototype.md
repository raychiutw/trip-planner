# #1333 archive contract prototype

**Throwaway branch:** `prototype/1333-archive-contract`. No production React, API, migration, or PR changes.

Open the interactive file with one command from this worktree:

```sh
python3 -m http.server 8765
```

Then open `http://localhost:8765/docs/design-sessions/1333-archive-contract-prototype.html?variant=personal` (A) or `?variant=global` (B). The black bottom bar changes contract and actor; it is prototype control, not proposed product UI. Choose the selected trip's `⋯` menu, archive, switch actor, then use 已歸檔 and 取消歸檔. The selected detail stays on Day 2 while its card changes category. The prototype keeps state in memory only; reload resets it.

## Exact owner decision

**Should 歸檔 be A, a personal list preference, or B, an owner action affecting every collaborator?**

| | A — personal (recommended) | B — trip-wide |
| --- | --- | --- |
| Who can archive/restore? | Each accessible user, including owner/member/viewer, in their own list | Trip owner only |
| Other collaborator's list | Unchanged | Moves to/from 已歸檔 for everyone |
| Trip access and content | Unchanged | Unchanged |
| Selected detail / Day 2 position | Stays open | Stays open |
| Proposed state owner | `trip_permissions.archived_at` | `trips.archived_at` |

A follows the existing client-side classification: filters change presentation, not access or selected-trip validity. B needs explicit intent because a single owner's list action changes every collaborator's list. Both include a reversible restore action. The cards, menu, confirmation, tabs and detail use the existing Tripline density and current token values; only the archive/restore action and consequence copy are under review.

Captured comparisons: [A confirmation](1333-archive-screenshots/tripline-1333-personal-confirm.png), [A after archive](1333-archive-screenshots/tripline-1333-personal-after.png), [B confirmation](1333-archive-screenshots/tripline-1333-global-confirm.png), [B collaborator after archive](1333-archive-screenshots/tripline-1333-global-member-archived.png), and [375px selected detail continuity](1333-archive-screenshots/tripline-1333-personal-mobile-continuity.png).

## Proposed seams after sign-off

- **S2, actual D1 handler:** extend `tests/api/my-trips.integration.test.ts` with two users sharing a trip; archive and restore through the public API handler; read `/api/my-trips` for both users and verify `archivedAt` camelCase and the chosen scope. Verify unauthorized/restricted token denial and no mutation after failure. Use `createTestDb()`/Miniflare, not an in-memory fake.
- **S1, real page/browser:** on `/trips?selected=<trip>`, begin at nonzero Day 2 scroll; archive from the card menu, then verify the active card disappears, 已歸檔 count/card updates, selected detail and scroll persist, and restore reverses the category. Cover desktop, mobile list/detail, back/reload, owner and collaborator views, and failed server response retaining the original card/state.

Current master has no archive column on `trips` or `trip_permissions`, `/api/my-trips` does not return `archivedAt`, and there is no archive mutation. #1390 intentionally left #1333 open. An additional #1333 issue remains: 最新編輯 sort currently follows the API's `ORDER BY p.trip_id`, not `updatedAt`.
