# Approved compact account dashboards — first UI milestone

The operator selected visual option A and approved its teacher and bursar siblings. The selected direction is a white sidebar, forest-green active item, light canvas, compact metric cards and tables, and a right column for tasks/activity. This source implements that direction at `/staging/account-design`, behind the existing exact development staging gate and verified staff sign-in. It does not replace the working report workflow or change the post-login destination.

The preview includes admin, teacher and bursar navigation and dashboard samples, search, class/status filters, empty state, functional menu selection, clear planned-module panels, dismissible notices, actual staging sign-out and a separate link to the existing report workflow. The sidebar becomes a native keyboard-accessible disclosure on mobile. Tables scroll within a labeled region; controls retain keyboard focus outlines. No new dependencies or external fonts are added.

All metrics, people, transactions and activity on this page are explicitly fictional sample content. The design selector changes sample presentation only, not membership or authority. No academic/financial mutations, API queries for sample records, database connections, role switching or live financial reads were added. Unconnected actions clearly report that no record changed. All three designs can be inspected by the signed-in operator; that is not evidence that production role routing is implemented.

Validation: scoped whitespace checks pass. Existing staging behavior tests remain passing. Project dependencies and a React renderer are unavailable in the authoring runtime, so installed TypeScript/ESLint, rendered desktop/mobile QA and browser interaction are pending operator verification. This is an interactive design milestone, not completed live dashboards.

Next milestone after visual review: connect the shared shell to verified per-account routing and individually reviewed module data adapters. Keep the bursar separate from academic authority; do not reuse the academic-only identity resolver as a bursar authorization mechanism. Before adding live data, inventory existing module implementations and least-privilege grants. Do not expose the sample account selector as a production role switch.

Operator: pull, run the offline verifier, restart the existing read-only local launcher, sign in and open `/staging/account-design` (also linked from report cards). Inspect all three previews at desktop and narrow widths. No additional SQL, password provisioning or test report reset is required.


## Approved mobile revision

The operator approved the compact mobile prototype before implementation. Mobile now uses a slim preview strip and a single header with the Greenfield brand, avatar and keyboard-accessible menu. Navigation, sample account selection and sign-out are inside that menu; selecting a destination closes it and Escape returns focus to the trigger. Dropdown Escape is handled by the shared control without also closing its surrounding menu. Search is consolidated into the records panel on mobile.

The wide table remains on desktop; mobile renders the same filtered records as cards. Teacher cards show attendance/report status, bursar cards show payment amount/method, and admin cards show status/balance. Record properties are stable through filtering. A two-column metric grid, full-width panel action and paired filters match the approved prototype.

Every preview selector now reuses GreenfieldDropdown rather than native select. Its existing portal placement and keyboard behavior are unchanged. A route-local stylesheet reproduces the shared dropdown visual baseline from the student controls, including the body-level portal menu; no shared component or existing module stylesheet was modified. Dropdown labels remain visible and controls have a minimum 44px mobile height.

Validation: the three existing pure dropdown layout/keyboard tests pass; scoped whitespace and CSS brace checks pass. No new behavioral implementation tests were added for this reversible UI adjustment. Installed TypeScript/ESLint and rendered browser QA remain operator-side; no claim of pixel-perfect implementation or live authorization changes. Review at 320/375/390px and desktop, including all three role previews, expanded dropdown near viewport edges, menu Escape/focus, filtering and sign-out pending state.
