## MODIFIED Requirements

### Requirement: Issue submission form
The edit page Issue submission form SHALL include a mode dropdown (before the text input) with options "✏️ 修改行程" (value: trip-edit) and "💡 問建議" (value: trip-plan). The default selection SHALL be "✏️ 修改行程". The submit button SHALL create a GitHub Issue with labels derived from the selected mode and the current tripId.

#### Scenario: Default mode selection
- **WHEN** the edit page loads
- **THEN** the mode dropdown SHALL show "✏️ 修改行程" as selected

#### Scenario: Mode affects Issue labels
- **WHEN** user selects "💡 問建議" and submits text
- **THEN** the Issue SHALL be created with labels `[trip-plan, {tripId}]`

### Requirement: Issue body format
The Issue body SHALL be the user's raw text input without any JSON wrapping or metadata fields. The previous JSON format `{owner, tripSlug, text, timestamp}` is removed.

#### Scenario: Plain text body
- **WHEN** user enters "Day 2 想加一個景點" and submits
- **THEN** the Issue body SHALL be "Day 2 想加一個景點"

### Requirement: Issue history list display
Each Issue item in the history list SHALL display: (1) a colored badge indicating mode — "edit" for trip-edit, "plan" for trip-plan, (2) the Issue title, (3) the Issue body text, and (4) the creation date.

#### Scenario: List item with edit badge
- **WHEN** an Issue has label `trip-edit`
- **THEN** the list item SHALL show an "edit" badge with appropriate styling

#### Scenario: List item with plan badge
- **WHEN** an Issue has label `trip-plan`
- **THEN** the list item SHALL show a "plan" badge with appropriate styling

#### Scenario: Body text displayed
- **WHEN** an Issue has body "把 D1 晚餐換成燒肉"
- **THEN** the list item SHALL show the body text below the title
