import { config } from 'dotenv';
import postgres from 'postgres';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { makeRestrictedUrl } from './verify-restricted-db-connection.mjs';

config({ path: '.env.local', quiet: true });

export async function auditRestrictedPrivilegeSurface(sql) {
  const [identity] = await sql`
    SELECT current_user AS role_name,
      (SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname = current_user) AS bypass_rls`;
  if (identity?.role_name !== 'greenfield_app' || identity.bypass_rls !== false) {
    throw new Error('Not authenticated as the expected non-bypass application role');
  }

  const defaultAcl = await sql`
    SELECT owner.rolname AS owner_role, COALESCE(ns.nspname, '(all schemas)') AS schema_name,
      d.defaclobjtype AS object_type,
      CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE grantee.rolname END AS grantee_role,
      a.privilege_type, a.is_grantable
    FROM pg_catalog.pg_default_acl d
    JOIN pg_catalog.pg_roles owner ON owner.oid = d.defaclrole
    LEFT JOIN pg_catalog.pg_namespace ns ON ns.oid = d.defaclnamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(d.defaclacl) a
    LEFT JOIN pg_catalog.pg_roles grantee ON grantee.oid = a.grantee
    WHERE a.grantee = 0 OR a.grantee = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = current_user)
    ORDER BY owner.rolname, schema_name, object_type, grantee_role, a.privilege_type`;

  const functions = await sql`
    SELECT ns.nspname AS schema_name, p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS argument_types,
      p.prosecdef AS security_definer,
      pg_catalog.has_function_privilege(current_user, p.oid, 'EXECUTE') AS can_execute,
      EXISTS (SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))) acl WHERE acl.grantee = 0 AND acl.privilege_type = 'EXECUTE') AS public_execute
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace ns ON ns.oid = p.pronamespace
    WHERE ns.nspname = 'public'
    ORDER BY p.proname, argument_types`;

  const schemas = await sql`
    SELECT n.nspname AS schema_name,
      pg_catalog.has_schema_privilege(current_user, n.oid, 'USAGE') AS can_use,
      pg_catalog.has_schema_privilege(current_user, n.oid, 'CREATE') AS can_create
    FROM pg_catalog.pg_namespace n
    WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
    ORDER BY n.nspname`;

  const executable = functions.filter(f => f.can_execute);
  const securityDefinerExecutable = executable.filter(f => f.security_definer);
  return {
    mode: 'READ_ONLY_RESTRICTED_PRIVILEGE_SURFACE_AUDIT',
    role: identity.role_name,
    defaultAcl,
    schemas,
    publicSchemaFunctions: {
      total: functions.length,
      executable: executable.length,
      executableSecurityDefiner: securityDefinerExecutable,
      executableFunctions: executable,
    },
    requiresReview: defaultAcl.length > 0 || executable.length > 0 || schemas.some(s => s.can_create),
    note: 'Catalog inspection only. Default ACL entries are not effective grants; built-in PUBLIC defaults, implicit privileges, other schemas, future migrations, and function bodies require separate review. No approval is implied.',
  };
}

async function main() {
  const sql = postgres(makeRestrictedUrl(process.env), {
    max: 1, connect_timeout: 10, idle_timeout: 2, prepare: false, onnotice: () => {},
  });
  try {
    const report = await auditRestrictedPrivilegeSurface(sql);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error('Restricted privilege audit failed. No connection strings, credentials or server messages were printed.');
    process.exitCode = 1;
  });
}
