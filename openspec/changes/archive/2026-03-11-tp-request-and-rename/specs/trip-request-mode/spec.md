## ADDED Requirements

### Requirement: Mode toggle on edit page
edit.html SHALL provide a dropdown allowing the user to select between "✏️ 修改行程"（trip-edit）and "💡 問建議"（trip-plan）mode before submitting an Issue. The default mode SHALL be "✏️ 修改行程".

#### Scenario: User submits a trip-edit Issue
- **WHEN** user selects "✏️ 修改行程" mode and submits
- **THEN** the created GitHub Issue SHALL have labels `[trip-edit, {tripId}]`

#### Scenario: User submits a trip-plan Issue
- **WHEN** user selects "💡 問建議" mode and submits
- **THEN** the created GitHub Issue SHALL have labels `[trip-plan, {tripId}]`

### Requirement: Issue body is pure text
The Issue body SHALL be the user's raw input text without JSON wrapping or metadata. All metadata SHALL be derived from the Issue itself: mode from labels (trip-edit/trip-plan), tripId from the non-mode label, owner from `tripId.split('-').pop()`, timestamp from `issue.created_at`.

#### Scenario: Issue body format
- **WHEN** user types "把 D3 午餐換成拉麵" and submits
- **THEN** the Issue body SHALL be exactly "把 D3 午餐換成拉麵" (no JSON, no blockquote metadata)

### Requirement: Issue history displays body and label badge
The Issue history list SHALL display each Issue with a label badge (edit/plan) and the Issue body content, in addition to the existing title and date.

#### Scenario: History list rendering
- **WHEN** the Issue list loads
- **THEN** each Issue item SHALL show a colored badge indicating mode (trip-edit or trip-plan) and the body text

### Requirement: tp-request skill routes by label and intent
The tp-request skill (renamed from tp-issue) SHALL process Issues based on the label and detected intent:

| Label | Intent=修改 | Intent=諮詢 |
|---|---|---|
| trip-edit | modify MD → commit → deploy | comment reply, no file changes |
| trip-plan | comment: suggest re-submit as trip-edit | comment reply, no file changes |

Only the trip-edit + intent=修改 combination SHALL modify files.

#### Scenario: trip-edit label with edit intent
- **WHEN** an Issue has label `trip-edit` and the LLM detects intent is 修改
- **THEN** the skill SHALL modify the relevant MD files, commit, and deploy

#### Scenario: trip-edit label with consultation intent
- **WHEN** an Issue has label `trip-edit` and the LLM detects intent is 諮詢
- **THEN** the skill SHALL post a comment reply without modifying any files

#### Scenario: trip-plan label with consultation intent
- **WHEN** an Issue has label `trip-plan` and the LLM detects intent is 諮詢
- **THEN** the skill SHALL post a comment reply without modifying any files

#### Scenario: trip-plan label with edit intent
- **WHEN** an Issue has label `trip-plan` and the LLM detects intent is 修改
- **THEN** the skill SHALL post a comment suggesting the user re-submit using trip-edit mode

### Requirement: Scheduler log rotation
tp-request-scheduler.ps1 (renamed from tp-issue-scheduler.ps1) SHALL write logs to `scripts/logs/tp-request-YYYY-MM-DD.log` (one file per day, append mode). On each execution, it SHALL delete log files older than 7 days. The `scripts/logs/` directory SHALL be added to `.gitignore`.

#### Scenario: Daily log file creation
- **WHEN** the scheduler runs on 2026-03-09
- **THEN** logs SHALL be appended to `scripts/logs/tp-request-2026-03-09.log`

#### Scenario: Old log cleanup
- **WHEN** the scheduler runs and `scripts/logs/` contains files older than 7 days
- **THEN** those old log files SHALL be deleted

### Requirement: Scheduler script rename
`scripts/tp-issue-scheduler.ps1` SHALL be renamed to `scripts/tp-request-scheduler.ps1`. The old `scripts/tp-issue.log` SHALL be removed. `scripts/register-scheduler.ps1` and `scripts/unregister-scheduler.ps1` SHALL be updated to reference the new script name.

#### Scenario: Scheduler registration uses new name
- **WHEN** `register-scheduler.ps1` is executed
- **THEN** it SHALL register `tp-request-scheduler.ps1` (not `tp-issue-scheduler.ps1`)
