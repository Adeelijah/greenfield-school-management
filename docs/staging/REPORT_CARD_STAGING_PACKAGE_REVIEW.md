# Report-card staging package — source reconciliation and installation plan

Date: 2026-10-22. Source baseline: `03353b4cb95a9b07174365761bbdb69f674b3a87` on `report-cards-foundation`.

This is a review package, not an executable migration bundle. No connection, catalog query, migration, role/grant/RLS installation, route enablement or deployment has occurred. The user confirmed the full **461-test offline gate**, **64 main disposable PostgreSQL groups** and **eight standalone authority groups**. Those fixtures do not establish the installed state of any school database.

## Source reconciliation

`drizzle/meta/_journal.json` contains one entry, `0000_broad_slayback`. Its SQL creates 12 foundation tables and four enums. Current `src/db/schema.ts` declares 18 tables, including six later structure/lifecycle/assignment tables. Presence in that TypeScript file is not a journaled migration or evidence of an applied object.

| Required surface | Journaled `0000` source | Current source / isolated fixture evidence | Staging action before report installation |
| --- | --- | --- | --- |
| School configuration | No `final_primary_year` or `structure_version` | Nullable final year with 5/6 check; structure version in current schema and Step 494 draft | Reconcile actual catalog, add reviewed columns/checks if absent, explicitly configure fictional school to 5 or 6; never guess a final year |
| Academic levels/sections | Absent | `academic_levels`, `academic_sections`, `academic_stage` in current schema and Step 494 review SQL | Prepare selected dependency DDL in order; retain independent sections per level |
| Class placement | Legacy text `name`/`section` only | Nullable `level_id`/`section_id`, both-or-neither check and scoped FKs | Backfill from reviewed explicit mapping; preserve old text; ambiguous/missing mapping denies report readiness |
| Membership composite target | Only school/user uniqueness; no school/id target | `memberships_school_id_id_unique (school_id,id)` in current schema / Step 494 draft | Establish exact unique target before assignment/report actor FKs |
| Enrollment targets | Student/session uniqueness only | School/id and school/id/student keys in current schema / Step 494 draft | Establish those targets; separately add `enrollments_report_binding_unique (school_id,id,student_id,class_id,session_id)` for exact report identity |
| Teacher class/session assignments | Table absent | `teacher_class_assignments` in current schema / Step 494 draft, with active teacher/class/session uniqueness and tenant FKs | Create/reconcile relation; add extra `teacher_class_assignments_school_id_id_unique (school_id,id)` target for subject links |
| Term scope | School/session FK exists; no full unique target | Real source still lacks full target; fixture adds it explicitly | Add `terms_school_session_id_unique (school_id,session_id,id)` before assessment/report FKs; validate term belongs to selected session |
| Academic assessment persistence | All absent | 11 review-only assessment tables; isolated metadata/guard/reader tests | Prepare explicit table list and constraints below; install source revision and immutable-history enforcement before granting use |
| Report persistence | All absent | Five review-only report tables; actual restricted fixture writers verified | Prepare exact enrollment/scope/source/snapshot/version/release FKs and guards; no direct client writes |
| Authority and source locks | No installed state established by journal | Complete authority review SQL; source/advisory gate integration verified only in generated fixture schema | Produce one coordinated non-fixture lock/trigger installation; do not install the standalone authority draft independently and assume common lock order |
| Runtime login and roles | Journal does not establish role policy | App guard expects `greenfield_app`; authority draft names a different non-login runtime; fixtures use generated roles | Resolve explicit login/SET ROLE/membership/ownership mapping before creating an application adapter |

The six later base declarations are academic levels, academic sections, student lifecycle decisions, student departures, student readmissions and teacher class assignments. The three lifecycle tables are **not** report prerequisites. Do not apply the entire Step 494 file simply to obtain the academic subset. It also adds audit/lifecycle changes outside this milestone; reconcile and preserve those separately.

The schema-faithful fixture uses 11 selected base dependencies plus 11 assessment and five report tables (27 total). It is not a migration of all 18 current base tables. A complete current-source inventory plus the 16 proposed tables is 34 relations; the difference includes guardians, student-guardians, admissions, general audit and the three lifecycle tables. Preserve those existing modules and policies in a staging upgrade.

## Explicit table and enum order

No proposal file may enter a Drizzle schema glob. The report proposal's `proposedTermsCompositeTarget` and `proposedEnrollmentCompositeTarget` are shadow descriptions of existing relations, not tables to create a second time.

| Installation layer | New relations / types | Dependencies |
| --- | --- | --- |
| Academic base subset | `academic_stage`; `academic_levels`, `academic_sections`, `teacher_class_assignments`; selected base ALTERs and composite targets | Reconciled `0000` foundation and approved school/class configuration |
| Assessment catalog | `assessment_config_state`, `assessment_mode`; `assessment_subjects`, `assessment_config_versions`, `assessment_scopes` | School, levels, classes, sessions, full term target |
| Assessment participation | `assessment_subject_roster`, `assessment_teacher_subjects`, `assessment_scores` | Config/catalog/scope; composite class-assignment and enrollment/student targets |
| Assessment provenance | `assessment_source_versions`, `assessment_teacher_reviews`, `assessment_finalizations`, `assessment_audit`, `assessment_operation_receipts` | Scope/roster/config/scores/actors; exact source/review tuples |
| Report workflow | `report_card_stage`, `report_card_action`; `report_cards` | Full enrollment tuple, scope identity and immutable source revision |
| Report history | `report_card_snapshots`, `report_card_audit`, `report_card_operation_receipts`, `report_card_releases` | Report identity, exact approved snapshot/version, scoped actor |
| Guard and security layer | Production-named discovery gate, revision claims, immutable/release guards, complete authority functions and statement gates; reviewed roles, grants and RLS | All relevant tables; consistent lock order; no public/default EXECUTE leak |

Create all tables before adding any cross-table FKs when using a generated bundle, or prove the topological order. Do not use the fixture DDL builder as the production migration generator: it rewrites namespaces/enums, creates only a subset and installs fixture-specific helper names/policies.

## Installation sequence and hold points

| Step | Concrete deliverable | Exit evidence | Current state |
| --- | --- | --- | --- |
| S0 | Named isolated staging target, owner/operator, scope of authorization and immutable source SHA | Target cannot be confused with a school production DB; no real pupils | Not selected or connected |
| S1 | Catalog reconciliation using `REPORT_CARD_CATALOG_PREFLIGHT_REVIEW.sql`, deployment migration journal and object/grant review | Actual columns/types/keys/policies/roles compared with this matrix; unknown/missing objects recorded | Read-only query draft prepared, unexecuted |
| S2 | Forward-only academic dependency SQL and explicit fictional school/class configuration manifest | No duplicate/recreated base tables, no inferred backfill, no collateral lifecycle changes; all FK targets valid | Source requirements reconciled; SQL bundle not generated |
| S3 | Explicit assessment/report schema bundle plus append-only/revision/release guards | Apply from clean baseline and upgrade rehearsal; whole failure rolls back; source-only hash constraints not mistaken for canonical validation | Proposals/fixture semantics verified; non-fixture bundle absent |
| S4 | Coordinated authority/source locking and least-privilege security bundle | Hidden membership, both arrival orders, writer/reader misuse, owner fallback and transitive privileges denied in target layout | Fixture evidence exists; target mapping/installation absent |
| S5 | Restricted connection bootstrap and non-fixture adapter, verified SDK RPC installation | Real cookie/JWT request resolves only its actor, fixed-school connection agrees, current authority rechecked in one transaction | Unused fixture entry/bridge only |
| S6 | Fictional admin/teacher UAT and report output | Create/submit/return/approve/publish/revoke/correct/replay, two-school denial, expired session, mobile/accessibility and printable output | Not run |
| S7 | Signed staging operational review and separate production change request | Restore rehearsal, audit retention, monitoring, approved production migration and deployment window | Not prepared for execution |

S0/S1 need approval for a specific isolated target before connecting or running queries. S2–S4 are source preparation until that installation is separately authorized. Passing fixture tests or the standing approval for source commits does not authorize production SQL or deployment. No production apply command is included in this package.

## Data and eligibility preflight requirements

The supplied SQL inspects catalogs only. A separately reviewed data-validation script must check counts/invariants without exporting pupil/guardian identities: school final-year configuration; unmapped/ambiguous classes; cross-school or orphan references; term/session consistency; duplicate active memberships; duplicate assignment/enrollment scopes; and config/roster/score completeness. Resolve failures explicitly rather than weakening FKs or selecting the first row.

Current enrollment/student enum source is active/graduated/withdrawn; it has no completed value. The current report source reader's active eligibility remains the policy for this package. Do not silently add a lifecycle state or make historical/inactive students eligible as a migration shortcut. Session/term ordinal, lifecycle and version storage remains a distinct calendar reconciliation; do not infer it from names or `is_current`.

Persisted report creation requires an existing positive-revision complete finalized academic source. Do not seed reports with dummy source UUIDs, revision zero or minimal manifests. Fictional setup must first create valid config/subject roster/scores, canonical source, teacher review and admin finalization through reviewed setup routines.

## Runtime and security contract

- The existing application connection guard compares URLs/usernames/operator acknowledgement; it does not verify live role attributes, ownership or effective grants. Do not bypass it or reuse migration credentials for reports.
- Decide whether `greenfield_app` is the unprivileged login or a selected role, how the draft `greenfield_report_card_runtime` is reached, and which single school the installation serves. The decision must include both membership directions and SET/INHERIT/ADMIN options. Do not invent a new environment variable or shared pool role-switch behavior before this decision.
- Runtime must be non-superuser, non-BYPASSRLS, non-owner, without role/database creation or administration membership. Verify actual role in every transaction; SET LOCAL/transaction cleanup must not leak role or school scope into the next pooled request. Configuration failure must not fall back to owner/application-default access.
- Keep the complete membership helper private to the exact report execution role, with a narrow non-login owner. The zero-argument request RPC derives only `auth.uid()`; the transaction helper accepts only the server-verified ID. Check PUBLIC/default privileges and policies applying to the authority owner; fixed-school runtime visibility cannot prove global membership completeness.
- Use source discovery before shared authority advisory lock, actor, membership/school and report/source child locks. Authority/source writers take the corresponding exclusive discovery gate before row discovery, including zero-row statements and truncate rejection. Port the tested order, not just function names. Review cascades, explicit owner row locks, imports/background jobs and contention.
- Report writer may insert report/history records and update only approved transition columns/revocation timestamp. Academic/identity writes and snapshot/audit/receipt update/delete/truncate remain denied. School RLS remains forced and clamped. Review sequences, schemas, functions, default grants, partitions and effective transitive privileges, not table ACLs alone.
- Disable all report endpoints during installation/rehearsal. Guardian access stays disabled and bursars remain excluded from academic decisions. Source presence is not a feature flag or runtime approval.

## Failure and recovery plan

Before any approved installation, record source SHA and exact SQL hashes, baseline catalog, operator/target identity, restore point and verified restore procedure. An initial fictional staging rehearsal may be rebuilt only when that exact disposable target is authorized. Existing school databases must never be dropped/recreated as a shortcut.

Prefer a reviewed transaction for related DDL where supported; do not add concurrent-index/autocommit operations without documenting separate failure boundaries. Inject failure after dependency/schema/security stages and verify rollback or the exact recoverable partial state. An idempotent-looking IF NOT EXISTS does not reconcile incorrect definitions.

If a transaction fails, keep endpoints disabled, preserve the error and compare the catalog with the recorded baseline. If a later stage fails after an earlier commit, keep runtime privileges disabled and apply a reviewed forward repair. Do not delete immutable report history or revoke provenance constraints to get a retry through. Restore the isolated backup only through the approved target-specific recovery plan. A production withdrawal/correction is the tested revoke/new-approval workflow, not schema rollback.

## Next development action

Prepare an isolated schema assembly entry and academic dependency DDL draft with explicit export lists, avoiding both shadow relations and unrelated lifecycle deltas. Review its output against the catalog matrix and current Drizzle metadata before extending the disposable harness to rehearse a real baseline-to-target upgrade. Do not enable routes or request production deployment at this stage.
