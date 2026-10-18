# Greenfield design system — baseline v1

Status: **source-grounded baseline, pending visual sign-off**. This document records patterns already present in the application; it does not declare newer preview modules visually approved. The original application shell, dashboard, student controls and user-approved mobile corrections take precedence over ad-hoc styling in later previews.

## Visual direction

Quiet, practical school administration UI. Light canvas, white panels, forest-green primary actions, restrained shadows, compact readable typography, and clear information hierarchy. Avoid decorative gradients, glass effects, oversized marketing headers, excessive pills, and multiple competing primary actions.

## Existing tokens

Defined in `src/app/globals.css`:

| Token | Current value | Role |
| --- | --- | --- |
| `--forest` | `#08734d` | Primary action and active navigation |
| `--forest-dark` | `#075c3e` | Primary hover |
| `--canvas` | `#f7f9f8` | Workspace background |
| `--ink` | `#14283a` | Main text |
| `--muted` | `#77857e` | Supporting text |
| `--border` | `#e6ece8` | Subtle separators |
| `--surface` | `#fff` | Cards and menus |
| `--radius` | `13px` | General panel rounding |
| `--shadow` | `0 2px 6px rgba(24,49,34,.025), 0 9px 22px rgba(24,49,34,.04)` | Subtle elevation |

These are the **authoritative existing values**, not a new palette. Avoid adding hard-coded near-duplicates (for example `#27623e` primary actions) in new modules. New semantic tokens require a reviewed use case.

## Type and spacing

- Font stack: Inter, Segoe UI, Arial, sans-serif.
- Workspace page heading: existing `.page-heading h1`, 28px desktop and 23px small mobile; tight tracking.
- Section headings: existing `.card h2` at 15px; use clear text labels.
- Body/supporting copy in existing shell is compact (approximately 12–13px). For new dense workflows, prioritize readability and touch access over reproducing the smallest legacy font sizes.
- Main content: `.content` maximum 1550px, 32px/34px desktop padding, reduced at 800px and 580px.
- Existing shell panels: `.card` uses the shared surface, border, radius and shadow. Do not introduce a competing panel system.
- Spacing is contextual rather than a documented numeric scale. **Unapproved decision:** whether to introduce a spacing scale and standard control height; audit before changing existing components.

## Component contract

| Purpose | Existing reference | Guidance |
| --- | --- | --- |
| Navigation | `src/components/app-shell.tsx` and `src/components/workspace-header.tsx` | Keep sidebar/topbar consistent; preserve mobile drawer |
| Page header | `.page-heading` in `globals.css` | Reuse for heading + short explanation + optional action |
| Panel | `.card` in `globals.css` | Prefer shared panel before module-specific variants |
| Primary button | `.primary` in `globals.css` | One clear primary action per region |
| Dropdown | `src/components/greenfield-dropdown.tsx` | Reuse portal positioning, keyboard behavior and viewport clamping; do not recreate native-looking custom menus |
| Date picker | `src/components/greenfield-date-picker.tsx` | Reuse existing viewport-safe popup and keyboard controls |
| Tables | Student directory and academic operations tables | Desktop tables are appropriate; choose readable mobile cards or intentional horizontal scroll per task |
| Empty state | Student workspace empty state | State what is missing and offer a relevant next step |
| Status | Student/admissions status patterns | Semantic colors only; do not make status depend on color alone |
| Tabs | Academic Operations and Admissions | Similar patterns currently duplicated; consolidate after visual comparison |

Avoid extracting components just because class names resemble one another. A shared component must preserve accessible semantics and genuinely repeated behavior.

## Responsive and interaction requirements

- Review at 320, 375, 390, 768px and desktop widths.
- No horizontal overflow of the workspace or clipped form controls; dense data may scroll *within a labeled region* when justified.
- At narrow widths, stack form fields, maintain usable tap targets, and allow text to wrap.
- Dropdowns and calendars must not be clipped by panels or viewport edges.
- Preserve visible keyboard focus, labels, error descriptions, disabled states and Escape behavior where applicable.
- Respect reduced-motion preferences.

## Preview and production boundary

Development previews use fictional in-memory fixtures only. A preview that simulates saving or authorization is not a persisted, deployed workflow. Do not connect a database, modify auth/RLS, execute SQL, or run migrations to demonstrate a design.

## Approval and migration plan

1. Compare original dashboard, Student Directory, Academic Operations, Admissions, and Calendar/Assessments side-by-side in the same widths.
2. Record deviations in `docs/UI_CONSISTENCY_AUDIT.md`.
3. Consolidate tokens and shared components incrementally, retaining the approved shell and shared controls.
4. Render real React components in the offline preview; visually inspect before declaring any design-system milestone complete.
5. Only then extend the same patterns to Report Cards.

**Pending user sign-off:** representative screenshots of the approved desktop and mobile pages; preferred treatment of mobile data tables; whether compact 10–11px preview text should be increased for readability.
