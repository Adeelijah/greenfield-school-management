// Unused isolated-staging bootstrap. No driver, environment or application import.
import type { SqlClient, SqlDatabase } from './report-card-postgres-disposable-adapter';

export type StagingReportRoleAdministration = 'isolated-strict' | 'supabase-postgres-createrole';
export type StagingReportRuntimeConfig = {
  mode: 'isolated-staging-review'; schema: 'public'; schoolId: string;
  loginRole: 'greenfield_app'; commandRole: 'greenfield_report_card_runtime';
  roleAdministration?: StagingReportRoleAdministration;
};
const loginRole = 'greenfield_app', commandRole = 'greenfield_report_card_runtime', ownerRole = 'greenfield_report_card_authority_owner';
const roleNames = [loginRole, commandRole, ownerRole];
const flags = ['superuser', 'bypass', 'creator', 'database', 'replication', 'inherit'] as const;
const failure = () => new Error('Staging report runtime verification failed');

/** Catalog evidence only, not proof of table grants, RLS, helper bodies or auth.
 * PostgreSQL 16+ membership options are required by this reviewed contract.
 */
export const stagingReportRoleQuery = `SELECT r.rolname AS name,
 r.rolcanlogin AS login,r.rolinherit AS inherit,r.rolsuper AS superuser,
 r.rolbypassrls AS bypass,r.rolcreaterole AS creator,r.rolcreatedb AS database,r.rolreplication AS replication,
 EXISTS(SELECT 1 FROM pg_catalog.pg_shdepend d WHERE d.refclassid='pg_catalog.pg_authid'::pg_catalog.regclass AND d.refobjid=r.oid AND d.deptype='o') AS owner,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'set',m.set_option,'inherit',m.inherit_option,'admin',m.admin_option) ORDER BY p.rolname)
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p ON p.oid=m.roleid WHERE m.member=r.oid),'[]'::jsonb) AS memberships,
 COALESCE((SELECT jsonb_agg(jsonb_build_object('role',p.rolname,'set',m.set_option,'inherit',m.inherit_option,'admin',m.admin_option,
 'grantor',g.rolname,'grantorSuperuser',g.rolsuper,'memberSuperuser',p.rolsuper,'memberCreator',p.rolcreaterole,'memberBypass',p.rolbypassrls) ORDER BY p.rolname,m.grantor)
 FROM pg_catalog.pg_auth_members m JOIN pg_catalog.pg_roles p ON p.oid=m.member
 JOIN pg_catalog.pg_roles g ON g.oid=m.grantor WHERE m.roleid=r.oid),'[]'::jsonb) AS members
 FROM pg_catalog.pg_roles r WHERE r.rolname IN ($1::text,$2::text,$3::text) ORDER BY r.rolname`;
export const stagingReportSessionQuery = 'SELECT session_user AS "loginRole",current_user AS "executionRole"';

function exactMembership(value: unknown, expected: string): boolean {
  if (!Array.isArray(value) || value.length !== 1) return false;
  const row = value[0];
  return !!row && typeof row === 'object' && row.role === expected && row.set === true && row.inherit === false && row.admin === false;
}
export function inspectStagingReportRoles(rows: unknown, administration: StagingReportRoleAdministration = 'isolated-strict'): boolean {
  if (administration !== 'isolated-strict' && administration !== 'supabase-postgres-createrole') return false;
  if (!Array.isArray(rows) || rows.length !== 3 || new Set(rows.map(row => row?.name)).size !== 3) return false;
  for (const row of rows) {
    if (!row || !roleNames.includes(row.name) || flags.some(flag => row[flag] !== false) ||
      row.login !== (row.name === loginRole) || typeof row.owner !== 'boolean' || !Array.isArray(row.memberships) || !Array.isArray(row.members)) return false;
    if (row.name !== ownerRole && row.owner) return false;
    if (row.name === loginRole ? !exactMembership(row.memberships, commandRole) : row.memberships.length !== 0) return false;
    let members = row.members;
    if (administration === 'supabase-postgres-createrole') {
      // Incoming control-plane administration does not grant the application a
      // reverse membership. Only the observed operator and bootstrap grant fit.
      const administrative = members.filter((member: Record<string, unknown> | null) => member?.role === 'postgres');
      if (administrative.length !== 1) return false;
      const member = administrative[0];
      if (member.admin !== true || member.set !== false || member.inherit !== false ||
        member.memberSuperuser !== false || member.memberCreator !== true || member.memberBypass !== true ||
        typeof member.grantor !== 'string' || !member.grantor || member.grantorSuperuser !== true) return false;
      members = members.filter((member: Record<string, unknown> | null) => member?.role !== 'postgres');
    }
    if (row.name === commandRole ? !exactMembership(members, loginRole) : members.length !== 0) return false;
  }
  return true;
}

/** This adapter only selects/verifies the reviewed role inside a supplied tx.
 * It does not authenticate a request, install RLS or make fixture-only writers
 * accept public. No route or application client imports this staging surface.
 */
export function createStagingReportRuntime(db: SqlDatabase, config: StagingReportRuntimeConfig): SqlDatabase & {
  readonly scope: Readonly<{ schema: 'public'; schoolId: string }>;
} {
  if (!db || typeof db.begin !== 'function' || !config || config.mode !== 'isolated-staging-review' ||
    config.schema !== 'public' || config.loginRole !== loginRole || config.commandRole !== commandRole ||
    (config.roleAdministration !== undefined && config.roleAdministration !== 'isolated-strict' && config.roleAdministration !== 'supabase-postgres-createrole') ||
    typeof config.schoolId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config.schoolId)) throw failure();
  const scope = Object.freeze({ schema: 'public' as const, schoolId: config.schoolId.toLowerCase() });
  const administration = config.roleAdministration ?? 'isolated-strict';
  return Object.freeze({
    scope,
    unsafe(): never { throw Error('Staging report SQL requires its runtime transaction'); },
    async begin<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      if (typeof work !== 'function') throw failure();
      return db.begin(async tx => {
        const checkSession = async (expected: string) => {
          const rows = await tx.unsafe(stagingReportSessionQuery);
          if (rows.length !== 1 || rows[0]!.loginRole !== loginRole || rows[0]!.executionRole !== expected) throw failure();
        };
        // Never RESET a contaminated incoming connection into apparent safety.
        await checkSession(loginRole);
        if (!inspectStagingReportRoles(await tx.unsafe(stagingReportRoleQuery, [...roleNames]), administration)) throw failure();
        await tx.unsafe('SET LOCAL ROLE "greenfield_report_card_runtime"');
        await checkSession(commandRole);
        let active = true, poisoned = false;
        const leased: SqlClient = { async unsafe(query, params) {
          if (!active) throw Error('Expired staging report transaction');
          try { return await tx.unsafe(query, params); } catch (error) { poisoned = true; throw error; }
        } };
        try {
          const result = await work(leased);
          if (poisoned) throw failure();
          await checkSession(commandRole);
          return result;
        } finally { active = false; }
      });
    },
  });
}
