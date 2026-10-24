# Primary 5 school and fictional test accounts — prepared, not created

Target: isolated Supabase project hweoqkbgmzycyznrbvng. The operator reports successful installation of source 9f6635a and has supplied a passing committed-state read-only check: 33 protected tables, role/API checks and private auth binding checks passed; the Primary 5 school is not configured. The application is disabled. This is operator-supplied evidence, not an assistant database connection.

## Concrete first write

REPORT_CARD_PRIMARY5_SCHOOL_SETUP_REVIEW.sql inserts only school 0c594571-74c5-46fe-a835-a9b217a3a199, name Greenfield Staging, slug greenfield-staging, final_primary_year 5 and structure_version 0. It acquires the installed source gate and authority advisory gate before school discovery, rejects unexpected schools or conflicting configuration, and allows an exact retry without an UPDATE. It leaves contact fields empty and creates no academic configuration, class, enrollment, student, membership or Auth account. It retains all existing triggers, forced RLS and ACLs. Review and approve this target-specific row insertion before executing it.

## Account plan after school setup

Create three separate fictional users through the staging project's Supabase Auth dashboard/Admin API, never by INSERT into auth.users or by an application migration. Each account gets its own strong password, kept locally and never pasted into the conversation or source. Use auto-confirmed test accounts where supported; these reserved example.invalid addresses cannot receive verification mail.

| Planned Auth email | Display name | Planned school role | Initial state |
| --- | --- | --- | --- |
| greenfield.admin@example.invalid | Staging Admin | admin | No membership until reviewed mapping |
| greenfield.teacher@example.invalid | Staging Teacher | teacher | No membership or class assignment |
| greenfield.bursar@example.invalid | Staging Bursar | bursar | No membership; excluded from academic commands |

These are proposed fictional identities, not existing users. The proposed approval scope includes this school row and these three explicitly named test identities with their listed roles; account creation and membership linking are performed only after that scope is approved. The school SQL itself does not create accounts. Obtain the three actual Auth UUIDs after approved account creation; UUIDs are not passwords or tokens. Then prepare one guarded school_users/memberships mapping transaction for exactly those accounts and this school. Reject an existing different user mapping, duplicate active membership or unexpected account rather than adopting it. No role should be inferred from client metadata. Never use the database postgres login as an application or test user.

## Verification after mapping

Use actual SDK sign-in/getUser and the zero-argument actor RPC with each fictional account. Admin and teacher must resolve to this school and their own active membership. The unassigned teacher remains unable to write reports; the bursar must fail academic authority resolution. Anonymous/missing identity must fail. Follow with reviewed academic fixtures and restricted runtime command tests; do not enable routes or claim launch readiness from catalog checks alone.

No student data, live Auth account, app connection, password or token has been read or changed during this preparation. Staging school creation, Auth-account creation, membership mapping, runtime credential provisioning and route enablement are distinct operations with concrete scopes; complete preparation before requesting the corresponding approval.
