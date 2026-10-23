// Pure, target-specific SQL planning. No connection, credentials or execution.
const mode = 'supabase-postgres-createrole';
const owner = 'greenfield_report_card_authority_owner';
const runtime = 'greenfield_report_card_runtime';
const login = 'greenfield_app';
const names = [login, runtime, owner];
const roleList = names.map(name => "'" + name + "'").join(',');

export function managedStagingRoleReview(config, guardSource) {
  if (config?.roleAdministration !== mode || config.projectRef !== 'hweoqkbgmzycyznrbvng' ||
    config.schoolId !== '0c594571-74c5-46fe-a835-a9b217a3a199' || config.finalPrimaryYear !== 5 ||
    config.schema !== 'public' || config.mode !== 'isolated-staging-review') throw Error('Exact managed staging target required');
  if (typeof guardSource !== 'string') throw Error('Reviewed coordinated guards required');
  const source = guardSource.replaceAll('\r\n', '\n');
  const anchor = `CREATE ROLE ${runtime}\n  NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION;`;
  if (source.split(anchor).length !== 2 || !source.trimEnd().endsWith('\nCOMMIT;') ||
    (source.match(/OWNER TO greenfield_report_card_authority_owner;/g) ?? []).length !== 4 ||
    /GRANT CREATE ON SCHEMA|GRANTED BY postgres/.test(source)) throw Error('Coordinated guard layout changed; review required');
  const temporary = `
-- Temporary ownership-transfer capability, granted by this operator only.
-- The bootstrap-owned ADMIN-only memberships cannot be revoked by postgres.
GRANT ${owner} TO postgres WITH ADMIN FALSE GRANTED BY postgres;
GRANT ${owner} TO postgres WITH INHERIT FALSE GRANTED BY postgres;
GRANT ${owner} TO postgres WITH SET TRUE GRANTED BY postgres;
GRANT CREATE ON SCHEMA public TO ${owner};
`;
  const cleanup = `
-- Remove only our temporary grant; preserve bootstrap-owned administration.
REVOKE CREATE ON SCHEMA public FROM ${owner};
REVOKE ${owner} FROM postgres GRANTED BY postgres;
`;
  const guards = source.replace(anchor, anchor + '\n' + temporary).replace(/\nCOMMIT;\s*$/, cleanup + '\nCOMMIT;\n');
  const bootstrap = `DO $managed_preflight$
BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres' OR NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=current_user AND NOT rolsuper AND rolcreaterole AND rolbypassrls
 ) THEN RAISE EXCEPTION 'reviewed managed postgres operator required'; END IF;
 IF current_setting('server_version_num')::integer < 170000 OR current_setting('server_version_num')::integer >= 180000 THEN
  RAISE EXCEPTION 'reviewed PostgreSQL 17 required'; END IF;
 IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname IN (${roleList})) THEN
  RAISE EXCEPTION 'fresh Greenfield roles required; no existing roles are adopted'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='auth' AND p.proname='uid' AND p.pronargs=0 AND p.prorettype='uuid'::pg_catalog.regtype)<>1 THEN
  RAISE EXCEPTION 'reviewed auth.uid signature required'; END IF;
END $managed_preflight$;
CREATE ROLE ${login} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD NULL;`;
  const verify = `DO $managed_role_graph$
BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN (${roleList})
  AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND NOT rolinherit
  AND rolcanlogin=(rolname='${login}'))<>3 THEN RAISE EXCEPTION 'unexpected application role flags'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles r ON r.oid=m.roleid
  WHERE r.rolname IN (${roleList}))<>4 THEN RAISE EXCEPTION 'unexpected incoming memberships'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m
  JOIN pg_catalog.pg_roles r ON r.oid=m.roleid JOIN pg_catalog.pg_roles p ON p.oid=m.member
  JOIN pg_catalog.pg_roles g ON g.oid=m.grantor
  WHERE r.rolname IN (${roleList}) AND p.rolname='postgres' AND NOT p.rolsuper AND p.rolcreaterole AND p.rolbypassrls
  AND m.admin_option AND NOT m.set_option AND NOT m.inherit_option AND g.rolsuper)<>3 THEN
  RAISE EXCEPTION 'expected bootstrap-owned administration missing or changed'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p ON p.oid=m.member
  WHERE p.rolname IN (${roleList}))<>1 OR NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p ON p.oid=m.member
  JOIN pg_catalog.pg_roles r ON r.oid=m.roleid WHERE p.rolname='${login}' AND r.rolname='${runtime}'
  AND m.set_option AND NOT m.inherit_option AND NOT m.admin_option
 ) THEN RAISE EXCEPTION 'application role graph is not SET-only'; END IF;
 IF has_schema_privilege('${owner}','public','CREATE') THEN RAISE EXCEPTION 'temporary schema creation privilege remains'; END IF;
END $managed_role_graph$;`;
  return Object.freeze({ mode, bootstrap, guards, verify, applicationPasswordEnabled: false });
}
