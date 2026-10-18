# Greenfield UI consistency audit

Scope: source inspection of `src/app/globals.css`, `src/components/app-shell.tsx`, Students, Academic Operations, Admissions/Guardians and Calendar/Assessments styles and component imports on `greenfield-development` at `d875491`. **No browser rendering or tests were run as part of this audit.** All visual conclusions are hypotheses pending screenshot review.

| Priority | Finding | Evidence | Recommended change | Risk |
| --- | --- | --- | --- | --- |
| High | Multiple primary greens | Global `.primary` uses `var(--forest)` (`#08734d`); academic/admissions/calendar use `#27623e` | Make new module primary actions consume the existing token, verify contrast and hover visually | Appearance change; needs QA |
| High | Duplicate panels | Global `.card` uses `--border`, `--radius`, `--shadow`; `.academic-ops-panel` and `.admissions-panel` define independent border, radius and shadow | Compare actual layouts and unify the underlying panel contract | Padding differences may be intentional |
| High | Cross-module CSS imports | `calendar-assessment-workspace.tsx` imports its CSS plus `academic-operations.css` and `../students/students.css` | Move shared dropdown/date-picker styling to a dedicated shared stylesheet, then eliminate cross-module imports after dependency check | Can break preview CSS bundling |
| Medium | Duplicated tabs | `.academic-ops-tabs` and `.admissions-tabs` have nearly identical pill layouts and active states | Extract shared accessible tabs only after confirming navigation semantics | Potential aria behavior divergence |
| Medium | Duplicated buttons | Academic, Admissions and Calendar define separate primary/secondary classes and font sizing | Introduce minimal shared button variants; migrate one module at a time | Risk of unintended button sizing |
| Medium | Inconsistent heading sizes | Original `.page-heading h1` 28px; newer academic/admissions headings 26px, calendar uses its own scale | Use page heading contract; preserve appropriate mobile wrapping | Low |
| Medium | Compact text may be hard to read | Many newer module labels, rows and actions use 9–11px sizes | Evaluate in actual 320–390px renders; raise where necessary | Layout changes |
| Medium | Mobile data presentation differs | Student directory uses internal horizontal scrolling; assessment components/grade bands have mobile-specific cards | Decide based on task density, avoid workspace overflow | Needs visual QA |
| Low | Stylesheets contain repeated literal colors | Module styles include `#e3ebe5`, `#d9e5dc`, `#718078` etc. near existing tokens | Normalize gradually rather than blanket replace | Contrast changes |

## Current reference hierarchy

1. Original application shell, dashboard and global tokens.
2. Existing shared Greenfield dropdown and date picker, including mobile viewport fixes.
3. Student workspace conventions where visually approved.
4. Newer module-specific patterns only after side-by-side approval.

## Suggested incremental implementation

- **Pass A:** centralize shared controls' styles without changing behavior; add smoke checks for each preview bundle.
- **Pass B:** normalize page headers, panels and button color across one module; inspect desktop and 320/375/390/768px.
- **Pass C:** unify tabs/status/empty states where genuinely reusable.
- **Pass D:** remove cross-module stylesheet dependencies and add design showcase using real components.

## Implementation progress

- **Pass B started (source-level only):** Academic Operations and Admissions panels now use shared `--border`, `--radius`, `--surface`, and `--shadow` tokens. Primary-action and active-tab backgrounds in Academic Operations and Admissions, and the Calendar primary action, now use `--forest` instead of `#27623e`.
- These are deliberate visual changes and **have not been rendered or tested** in this GitHub-only session. They must be compared against the approved dashboard and student controls before sign-off.
- Cross-module CSS imports, shared tab extraction, and text-size/accessibility audit remain open.

## Release blockers

No visual sign-off of the design-system showcase, no cross-module screenshot comparison, and no independent TypeScript/ESLint/offline test run in this GitHub-only review. Do not label the consolidation completed until these checks are satisfied.

## Explicit exclusions

No database connections, SQL execution, migrations, live auth/RLS changes, dependencies, deployment, or merges into `main`.
