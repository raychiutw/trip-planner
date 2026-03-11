## RENAMED Requirements

### Requirement: Skill file rename
- **FROM**: `.claude/commands/tp-issue.md`
- **TO**: `.claude/commands/tp-request.md`

## MODIFIED Requirements

### Requirement: Issue metadata extraction
The tp-request skill SHALL extract metadata entirely from the GitHub Issue object:
- **mode**: determined by label (`trip-edit` or `trip-plan`)
- **tripId**: the label that is neither `trip-edit` nor `trip-plan`
- **owner**: `tripId.split('-').pop()`
- **timestamp**: `issue.created_at`
- **text**: `issue.body` (raw text)

The skill SHALL NOT parse the Issue body for metadata (previous JSON format is removed).

#### Scenario: Extract tripId from labels
- **WHEN** an Issue has labels `[trip-edit, okinawa-trip-2026-Ray]`
- **THEN** tripId SHALL be `okinawa-trip-2026-Ray` and owner SHALL be `Ray`

### Requirement: Label-based routing with intent detection
The skill SHALL first determine the mode from labels, then use LLM intent detection on the body text to decide the action:

- trip-edit + intent=修改 → execute tp-edit workflow (modify MD → commit → deploy)
- trip-edit + intent=諮詢 → post comment reply, no file changes
- trip-plan + intent=諮詢 → post comment reply, no file changes
- trip-plan + intent=修改 → post comment suggesting re-submit as trip-edit

#### Scenario: trip-edit with modification intent
- **WHEN** Issue label is `trip-edit` and body is "把 D3 午餐從拉麵換成燒肉"
- **THEN** the skill SHALL modify the trip MD files, commit, deploy, and comment with results

#### Scenario: trip-plan with advice request
- **WHEN** Issue label is `trip-plan` and body is "D2 下午有推薦的咖啡廳嗎"
- **THEN** the skill SHALL post a comment with recommendations without modifying any files

#### Scenario: trip-plan with modification intent detected
- **WHEN** Issue label is `trip-plan` and body is "把 D1 飯店換成 Hilton"
- **THEN** the skill SHALL post a comment suggesting the user re-submit using "✏️ 修改行程" mode

### Requirement: Query both trip-edit and trip-plan Issues
The tp-request skill SHALL query GitHub Issues with both `trip-edit` and `trip-plan` labels for the given tripId, processing all unprocessed Issues regardless of mode.

#### Scenario: Process mixed-mode Issues
- **WHEN** there are 2 unprocessed trip-edit Issues and 1 unprocessed trip-plan Issue
- **THEN** the skill SHALL process all 3 Issues according to their respective label routing rules
