# Greenfield security acceptance matrix

**Not yet executed.** Run against a disposable staging Supabase project before any production migration.

| Actor | Expected read | Expected write |
|---|---|---|
| Anonymous | No school records | Denied |
| Authenticated, no school membership | No school records | Denied |
| Active admin, school A | School A records | Only explicitly authorized school A operations |
| Active teacher, school A | Permitted school A teaching records | No fee, role or school-wide admin changes |
| Active bursar, school A | Permitted school A finance records | No academic or role administration |
| Suspended member, school A | No school records | Denied |
| Active admin, school B | School B records, never school A | Cannot change school A |
| User with memberships A and B | Must select school explicitly | Cannot rely on arbitrary default school |
| Admin attempting self-promotion / cross-school role change | Denied | Denied |
| Last active admin being suspended or demoted | Not applicable | Denied, including concurrent requests |

## Required test assertions
- SELECT, INSERT, UPDATE and DELETE attempts across tenants; include composite-FK bypass attempts and forged school_id.
- Verify `auth.uid()` cannot be spoofed by a request body or query parameter.
- Validate grants, RLS status and FORCE RLS on all 12 tables.
- Test privileged direct connection separately: prove app-level authorization on every route/query or migrate to least-privilege DB access.
- Test membership table and audit table writes cannot be made by a browser-authenticated user.
- Verify suspended membership invalidates access and revocation takes effect on subsequent requests.
- Confirm nonmember authenticated users receive Access pending and signed-out users receive login.
- Test multi-school selection is fail-closed.
- Test SQL helper privileges and no unexpected PUBLIC grants.
- Check initial bootstrap transaction rollback and duplicate/idempotent invocation.
- Verify school_admin last-admin protection under concurrent transactions.
- Ensure user invitations cannot elevate privileges or join arbitrary schools.

**Release blocker:** Any untested or failing cross-school read/write, privilege escalation, or last-admin case.
