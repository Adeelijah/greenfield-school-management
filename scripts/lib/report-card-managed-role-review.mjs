// Pure, target-specific SQL planning. No connection, credentials or execution.
const mode = 'supabase-postgres-createrole';
const owner = 'greenfield_report_card_authority_owner';
const runtime = 'greenfield_report_card_runtime';
const login = 'greenfield_app';
const names = [login, runtime, owner];
const roleList = names.map(name => "'" + name + "'").join(',');

/** Rollback rehearsal only: insert after ownership transfer and before removal
 * of the operator's temporary SET grant. Never part of the install composer.
 * Uses fictional request settings, not a token, account or provider auth write.
 */
export function managedStagingAuthBindingProbe() {
  return `SET LOCAL ROLE ${owner};
DO $managed_auth_binding_probe$
DECLARE denied boolean := false;
BEGIN
 IF current_user<>'${owner}' OR has_schema_privilege(current_user,'auth','USAGE') THEN
  RAISE EXCEPTION 'rehearsal requires the narrow owner without auth schema usage'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000091',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000091","role":"authenticated"}',true);
 IF public.report_card_request_auth_uid() IS DISTINCT FROM '00000000-0000-0000-0000-000000000091'::uuid THEN
  RAISE EXCEPTION 'bound provider uid does not match fictional legacy request'; END IF;
 BEGIN
  EXECUTE 'SELECT auth.uid()';
 EXCEPTION WHEN insufficient_privilege THEN denied := true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'direct provider lookup unexpectedly permitted'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claim.sub','',true);
 PERFORM pg_catalog.set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000092","role":"authenticated"}',true);
 IF public.report_card_request_auth_uid() IS DISTINCT FROM '00000000-0000-0000-0000-000000000092'::uuid THEN
  RAISE EXCEPTION 'bound provider uid does not match fictional JSON request'; END IF;
 -- This fixture actor must not exist; no student or Auth account is created.
 IF EXISTS (SELECT 1 FROM public.resolve_report_card_actor()) THEN
  RAISE EXCEPTION 'fictional rehearsal identity unexpectedly resolves'; END IF;
 PERFORM pg_catalog.set_config('request.jwt.claims','{}',true);
 IF public.report_card_request_auth_uid() IS NOT NULL OR EXISTS (SELECT 1 FROM public.resolve_report_card_actor()) THEN
  RAISE EXCEPTION 'missing identity did not fail closed'; END IF;
END $managed_auth_binding_probe$;
SET LOCAL ROLE postgres;`;
}

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
  const authorityFunctions = ['resolve_report_card_actor()', 'lock_report_card_actor(uuid)',
    'lock_report_card_authority_write_gate()', 'lock_report_card_membership_actor_anchor()'];
  const transfers = authorityFunctions.map(name => `ALTER FUNCTION public.${name}\n  OWNER TO ${owner};`);
  let guards = source.replace(anchor, anchor + '\n' + temporary);
  for (const statement of transfers) {
    if (guards.split(statement).length !== 2) throw Error('Exact authority ownership statements required');
    guards = guards.replace(statement, '-- Ownership transfer deferred until all grants and triggers are installed.');
  }
  const binding = 'report_card_request_auth_uid()';
  const replacements = [
    [`GRANT USAGE ON SCHEMA public, auth TO ${owner};`, `GRANT USAGE ON SCHEMA public TO ${owner};`],
    [`GRANT EXECUTE ON FUNCTION auth.uid() TO ${owner};`, '-- Provider auth.uid EXECUTE is required, but no provider grant is attempted.'],
    ['verified_auth_id uuid := auth.uid();', `verified_auth_id uuid := public.${binding};`],
    ['CREATE FUNCTION public.resolve_report_card_actor()', `-- SQL-standard body is parsed by the installation operator, before ownership transfer.
-- It binds the official provider function by OID without copying JWT parsing.
CREATE FUNCTION public.${binding}
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER
SET search_path=pg_catalog SET row_security=on
BEGIN ATOMIC
 SELECT auth.uid();
END;

CREATE FUNCTION public.resolve_report_card_actor()`],
  ];
  for (const [from, to] of replacements) {
    if (guards.split(from).length !== 2) throw Error('Exact provider auth binding layout required');
    guards = guards.replace(from, to);
  }
  transfers.push(`ALTER FUNCTION public.${binding}\n  OWNER TO ${owner};`);
  const ownership = transfers.join('\n') + '\n' + cleanup;
  const newTables = ['academic_levels', 'academic_sections', 'teacher_class_assignments',
    'assessment_subjects', 'assessment_config_versions', 'assessment_scopes', 'assessment_subject_roster',
    'assessment_teacher_subjects', 'assessment_scores', 'assessment_source_versions', 'assessment_teacher_reviews',
    'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts', 'report_cards',
    'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts', 'report_card_releases',
    'assessment_source_write_gate', 'assessment_source_write_claims'];
  const functions = ['assessment_lock_source_write()', 'assessment_mark_source_scope(uuid)',
    'assessment_invalidate_source_rows()', 'assessment_reject_source_truncate()', 'assessment_invalidate_parent_rows()',
    'report_card_reject_history()', 'report_card_guard_release_history()', ...authorityFunctions,
    'report_card_restrict_runtime_writes()', binding];
  // Scope the reset to objects created by this candidate. Preserve historical
  // module ACLs and the exact runtime/authority-owner grants already installed.
  const access = [
    ...newTables.map(name => `REVOKE ALL ON TABLE public.${name} FROM PUBLIC,anon,authenticated,service_role;`),
    ...functions.map(name => `REVOKE ALL ON FUNCTION public.${name} FROM PUBLIC,anon,authenticated,service_role${name === binding ? ',' + login + ',' + runtime : ''};`),
    'GRANT EXECUTE ON FUNCTION public.resolve_report_card_actor() TO authenticated;',
    `DO $managed_api_access$
DECLARE role_name text; object_name text;
BEGIN
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relname IN (${newTables.map(name => "'" + name + "'").join(',')})
  AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>21 THEN
  RAISE EXCEPTION 'new relation RLS is missing or not forced'; END IF;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  FOREACH object_name IN ARRAY ARRAY[${newTables.map(name => "'public." + name + "'").join(',')}] LOOP
   IF has_table_privilege(role_name,object_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    OR has_any_column_privilege(role_name,object_name,'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'unexpected effective API relation access: %, %',role_name,object_name;
   END IF;
  END LOOP;
  FOREACH object_name IN ARRAY ARRAY[${functions.map(name => "'public." + name + "'").join(',')}] LOOP
   IF has_function_privilege(role_name,object_name,'EXECUTE') IS DISTINCT FROM
    (role_name='authenticated' AND object_name='public.resolve_report_card_actor()') THEN
    RAISE EXCEPTION 'unexpected effective API function access: %, %',role_name,object_name;
   END IF;
  END LOOP;
 END LOOP;
END $managed_api_access$;`,
  ].join('\n');
  const bootstrap = `SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
DO $managed_preflight$
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
 IF NOT has_schema_privilege(current_user,'auth','USAGE') OR NOT has_function_privilege(current_user,'auth.uid()','EXECUTE') THEN
  RAISE EXCEPTION 'installation operator cannot bind provider auth.uid'; END IF;
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
 IF NOT has_schema_privilege('${owner}','public','USAGE')
  OR NOT has_function_privilege('${owner}','auth.uid()','EXECUTE') THEN
  RAISE EXCEPTION 'authority owner lacks public lookup or provider EXECUTE access'; END IF;
 IF has_schema_privilege('${owner}','auth','USAGE') THEN RAISE EXCEPTION 'authority owner unexpectedly has provider schema access'; END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
  WHERE n.nspname='public' AND p.oid IN (${authorityFunctions.map(name => "'public." + name + "'::pg_catalog.regprocedure").join(',')})
  AND r.rolname='${owner}' AND p.prosecdef AND p.proconfig @> ARRAY['search_path=pg_catalog','row_security=on'])<>4 THEN
  RAISE EXCEPTION 'authority ownership or security settings differ'; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid=p.proowner
  JOIN pg_catalog.pg_language l ON l.oid=p.prolang WHERE p.oid='public.${binding}'::pg_catalog.regprocedure
  AND r.rolname='${owner}' AND NOT p.prosecdef AND l.lanname='sql' AND p.prosqlbody IS NOT NULL
  AND p.pronargs=0 AND p.prorettype='uuid'::pg_catalog.regtype AND p.provolatile='s'
  AND p.proconfig @> ARRAY['search_path=pg_catalog','row_security=on']) OR NOT EXISTS (
  SELECT 1 FROM pg_catalog.pg_depend d WHERE d.classid='pg_catalog.pg_proc'::pg_catalog.regclass
  AND d.objid='public.${binding}'::pg_catalog.regprocedure AND d.refclassid='pg_catalog.pg_proc'::pg_catalog.regclass
  AND d.refobjid='auth.uid()'::pg_catalog.regprocedure AND d.deptype='n'
 ) THEN RAISE EXCEPTION 'private auth helper lacks reviewed owner, settings or parsed provider dependency'; END IF;
 IF has_function_privilege('${login}','public.${binding}','EXECUTE')
  OR has_function_privilege('${runtime}','public.${binding}','EXECUTE') THEN
  RAISE EXCEPTION 'private auth helper is reachable by application roles'; END IF;
END $managed_role_graph$;`;
  return Object.freeze({ mode, bootstrap, guards, access, ownership, verify, applicationPasswordEnabled: false });
}
