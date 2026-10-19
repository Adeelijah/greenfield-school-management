// Offline preparation only. A passing result is a prerequisite, not proof of RLS.
const fixturePattern = /^rc_it_[a-f0-9]{16}$/;
const dangerousFlags = ['superuser', 'bypassRls', 'createRole', 'createDb', 'replication', 'login', 'inherit'];
export function fixtureRolePreflightPlan(schema) {
 if (!fixturePattern.test(schema)) throw Error('Only generated disposable fixture schemas allowed.');
 const roles = { reader: schema + '_reader', writer: schema + '_writer' };
 // All outgoing memberships are refused, regardless of inherit/set/admin options.
 // pg_shdepend includes ownership beyond this schema, including shared objects.
 const query = `SELECT r.rolname AS name,
 r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
 r.rolcreaterole AS "createRole", r.rolcreatedb AS "createDb",
 r.rolreplication AS replication, r.rolcanlogin AS login, r.rolinherit AS inherit,
 ARRAY(SELECT p.rolname FROM pg_catalog.pg_auth_members m
  JOIN pg_catalog.pg_roles p ON p.oid=m.roleid WHERE m.member=r.oid ORDER BY p.rolname) AS "memberOf",
 EXISTS(SELECT 1 FROM pg_catalog.pg_shdepend d WHERE d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass
  AND d.refobjid=r.oid AND d.deptype='o') AS "ownsObjects"
 FROM pg_catalog.pg_roles r WHERE r.rolname IN ($1,$2) ORDER BY r.rolname`;
 return { schema, roles, query, parameters: [roles.reader, roles.writer] };
}
export function inspectFixtureRestrictedRoles(schema, rows) {
 const plan = fixtureRolePreflightPlan(schema);
 const failure = code => ({ ok: false, code });
 if (!Array.isArray(rows) || rows.length !== 2) return failure('missing_or_ambiguous_roles');
 const names = new Set();
 for (const row of rows) {
  if (!row || typeof row !== 'object' || !Object.values(plan.roles).includes(row.name) || names.has(row.name)) return failure('missing_or_ambiguous_roles');
  names.add(row.name);
  if (dangerousFlags.some(flag => typeof row[flag] !== 'boolean') || typeof row.ownsObjects !== 'boolean' || !Array.isArray(row.memberOf) || row.memberOf.some(name => typeof name !== 'string')) return failure('malformed_catalog_evidence');
  if (dangerousFlags.some(flag => row[flag])) return failure('privileged_role');
  if (row.memberOf.length !== 0) return failure('role_membership');
  if (row.ownsObjects) return failure('object_owner');
 }
 return { ok: true, roles: plan.roles };
}
