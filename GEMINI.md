# Trip Planner

## Project Overview
Trip Planner is a frontend web application for creating, managing, and viewing travel itineraries. It uses a custom build process to convert Markdown-based trip data (`data/trips-md/`) into JSON format (`data/dist/`) for the frontend to consume.

### Technologies
- **Frontend**: HTML, CSS (Custom Design System), Vanilla JavaScript.
- **Testing**: Vitest (Unit/Integration), Playwright (E2E).
- **Build System**: Custom Node.js scripts (`scripts/build.js`, `scripts/trip-build.js`).
- **Data Source**: Markdown files stored in `data/trips-md/`.

## Directory Structure
- `index.html`, `edit.html`, `setting.html`: Main HTML entry points.
- `css/`: Stylesheets (`shared.css`, `style.css`, `edit.css`, `setting.css`). Includes a custom 4pt grid system and Apple-inspired design tokens.
- `js/`: Vanilla JS logic (`shared.js`, `icons.js`, `app.js`, `edit.js`, `setting.js`). Uses inline SVG icons.
- `data/trips-md/`: **Primary Data Source**. Contains Markdown files for each trip (e.g., `meta.md`, `day-1.md`).
- `data/dist/`: **Build Output**. Contains JSON files generated from the Markdown files. **Do not edit manually.**
- `data/examples/`: Template files for creating new trip Markdown documents.
- `scripts/`: Custom Node.js build scripts.
- `tests/`: Unit, integration, JSON schema, and E2E tests.
- `.gemini/skills/`: Custom Gemini CLI skills for managing trips (e.g., `tp-create`, `tp-edit`, `tp-check`).

## Building and Running

### Build Data
To convert the Markdown trip data in `data/trips-md/` to JSON files in `data/dist/`:
```bash
npm run build
```
Or for specific trip generation:
```bash
npm run build:trips
```

### Local Development Server
To serve the frontend locally:
```bash
npx serve -l 3000
```
Then open `http://localhost:3000` in your browser. (You can use the `tp-run` skill to automate this).

### Testing
Run all tests (Vitest):
```bash
npm test
```
Watch mode:
```bash
npm run test:watch
```
E2E tests (Playwright):
```bash
npm run test:e2e
```

## Development Conventions
- **Data Modification**: Only modify files in `data/trips-md/`. Never manually edit files in `data/dist/`.
- **Trip Quality**: New or modified trips must adhere to the quality rules defined in `.gemini/skills/tp-rebuild/references/trip-quality-rules.md`. Use the `tp-check` skill to validate them.
- **UI Design**: Adhere to the "Apple-inspired" HIG design specifications:
  - Use the 4pt grid system.
  - Borderless design (use background colors to differentiate hierarchy).
  - Use semantic CSS tokens (e.g., `var(--accent)`, `var(--text)`).
  - Check `.gemini/skills/tp-hig/references/css-hig.md` for full details. Use `tp-hig` skill to help comply.
- **CSS Architecture**: `shared.css` provides the scrolling infrastructure and global tokens. Other pages may need to reset specific scrolling behaviors if they differ significantly from the main trip view (see setting page implementation).
- **Git Commits**: Commit messages should be in Traditional Chinese. Do not automatically push without user confirmation. Ensure tests pass before committing.
- **Language**: Use Traditional Chinese (Taiwan).
- **OpenSpec Workflow**: New features should follow the OpenSpec process (`openspec/config.yaml`), including proposal, design, specs, tasks, and implementation.

## Agent Skills
This project includes specialized Gemini CLI skills to automate workflows. Ensure they are loaded using `/skills reload`.
- `tp-create`: Create a new trip structure.
- `tp-edit`: Modify an existing trip.
- `tp-check`: Validate trip data against quality rules.
- `tp-rebuild` / `tp-rebuild-all`: Automatically fix issues in trip data.
- `tp-deploy`: Commit, push, and deploy to Cloudflare Pages.
