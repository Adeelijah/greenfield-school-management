import { config } from 'dotenv';
import postgres from 'postgres';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDisposableTarget, inspectFoundationStatements } from './validate-isolated-foundation.mjs';

config({ path: '.env.local', quiet: true });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');
const uuids = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  admin: '33333333-3333-4333-8333-333333333333',
  teacher: '44444444-4444-4444-8444-444444444444',
  bursar: '55555555-5555-4555-8555-555555555555',
  suspended: '66666666-6666-4666-8666-666666666666',
  outsider: '77777777-7777-4777-8777-777777777777',
  otherAdmin: '88888888-8888-4888-8888-888888888888',
};

export function securityStatements(source) {
  const sql = source.split('\n').filter(line => !/^\s*--/.test(line)).join('\n');
  const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
  if (statements.length !== 35) throw new Error('Unexpected security review SQL statement count');
  if (statements.some(s => !/^(REVOKE|ALTER TABLE|CREATE POLICY|GRANT)/.test(s))) {
    throw new Error('Unexpected security SQL command');
  }
  return statements;
}


export async function expectPermissionDenied(tx, statement, label) {
  // A denied statement aborts the current PostgreSQL transaction until its
  // savepoint is rolled back. Never suppress any error other than 42501.
  await tx.unsafe('SAVEPOINT greenfield_negative_check');
  let denied = false;
  try {
    await tx.unsafe(statement);
  } catch (error) {
    denied = error.code === '42501';
    if (!denied) {
      await tx.unsafe('ROLLBACK TO SAVEPOINT greenfield_negative_check');
      await tx.unsafe('RELEASE SAVEPOINT greenfield_negative_check');
      throw error;
    }
  }
  await tx.unsafe('ROLLBACK TO SAVEPOINT greenfield_negative_check');
  await tx.unsafe('RELEASE SAVEPOINT greenfield_negative_check');
  if (!denied) throw new Error('Unexpectedly permitted: ' + label);
  return label;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) throw new Error(label + ': expected ' + expected + ', got ' + actual);
}

export async function validateLocalSecurity(sql) {
  const [preflight] = await sql.unsafe(`
    SELECT
      EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('authenticated','anon')) AS existing_roles,
      EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') AS existing_auth,
      EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname='schools') AS existing_foundation,
      (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS superuser
  `);
  if (preflight.existing_roles || preflight.existing_auth || preflight.existing_foundation || !preflight.superuser) {
    throw new Error('Disposable database must be empty and use a local PostgreSQL administrator');
  }
  const foundation = inspectFoundationStatements(read('drizzle/0000_broad_slayback.sql')).statements;
  const policies = securityStatements(read('docs/security/09_consolidated_read_only_review.sql'));
  const fk = 'ALTER TABLE public.school_users ADD CONSTRAINT school_users_auth_user_id_auth_users_id_fk FOREIGN KEY (auth_user_id) REFERENCES auth.users (id) ON DELETE RESTRICT';
  let results;
  const marker = 'GREENFIELD_PHASE4D_ROLLBACK';
  try {
    await sql.begin(async tx => {
      await tx.unsafe('CREATE ROLE authenticated NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE ROLE anon NOLOGIN NOSUPERUSER NOBYPASSRLS');
      await tx.unsafe('CREATE SCHEMA auth');
      await tx.unsafe('CREATE TABLE auth.users (id uuid PRIMARY KEY)');
      await tx.unsafe(`CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$`);
      for (const statement of foundation) await tx.unsafe(statement);
      await tx.unsafe(fk);
      for (const statement of policies) await tx.unsafe(statement);
      await tx.unsafe('GRANT USAGE ON SCHEMA public, auth TO authenticated');
      await tx.unsafe('GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated');
      const [rls] = await tx.unsafe(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity`);
      assertEqual(rls.count, 12, 'FORCE RLS table count');
      const [fkCount] = await tx.unsafe(`SELECT count(*)::int AS count FROM pg_constraint WHERE conname='school_users_auth_user_id_auth_users_id_fk' AND contype='f'`);
      assertEqual(fkCount.count, 1, 'Auth FK');
      for (const id of [uuids.admin, uuids.teacher, uuids.bursar, uuids.suspended, uuids.outsider, uuids.otherAdmin]) {
        await tx`INSERT INTO auth.users (id) VALUES (${id})`;
        await tx`INSERT INTO public.school_users (id,auth_user_id,display_name) VALUES (${id},${id},'Synthetic')`;
      }
      await tx`INSERT INTO public.schools (id,name,slug) VALUES (${uuids.a},'Synthetic A','synthetic-a'),(${uuids.b},'Synthetic B','synthetic-b')`;
      for (const [school, user, role, status] of [
        [uuids.a,uuids.admin,'admin','active'],[uuids.a,uuids.teacher,'teacher','active'],
        [uuids.a,uuids.bursar,'bursar','active'],[uuids.a,uuids.suspended,'teacher','suspended'],
        [uuids.b,uuids.otherAdmin,'admin','active']
      ]) await tx`INSERT INTO public.memberships (school_id,user_id,role,status) VALUES (${school},${user},${role},${status})`;
      await tx`INSERT INTO public.students (school_id,admission_number,first_name,last_name,date_of_birth) VALUES (${uuids.a},'A1','Synthetic','One','2018-01-01'),(${uuids.b},'B1','Synthetic','Two','2018-01-01')`;
      await tx.unsafe('SET LOCAL ROLE authenticated');
      const checks = [];
      for (const [name, identity, schools, students] of [
        ['admin',uuids.admin,1,1],['teacher',uuids.teacher,1,1],
        ['bursar',uuids.bursar,1,0],['suspended',uuids.suspended,0,0],
        ['outsider',uuids.outsider,0,0],['other-school-admin',uuids.otherAdmin,1,1]
      ]) {
        await tx`SELECT set_config('request.jwt.claim.sub',${identity},true)`;
        const [schoolCount] = await tx`SELECT count(*)::int AS count FROM public.schools`;
        const [studentCount] = await tx`SELECT count(*)::int AS count FROM public.students`;
        assertEqual(schoolCount.count, schools, name + ' school visibility');
        assertEqual(studentCount.count, students, name + ' student visibility');
        if (schools) {
          const visible = await tx`SELECT id FROM public.schools`;
          assertEqual(visible[0].id, name === 'other-school-admin' ? uuids.b : uuids.a, name + ' tenant isolation');
        }
        checks.push({ identity: name, schools: schoolCount.count, students: studentCount.count });
      }
      const [privileges] = await tx.unsafe(`SELECT
        has_column_privilege('authenticated','public.students','date_of_birth','SELECT') AS dob,
        has_table_privilege('authenticated','public.guardians','SELECT') AS guardians,
        has_table_privilege('authenticated','public.admissions','SELECT') AS admissions,
        has_table_privilege('authenticated','public.audit_events','SELECT') AS audit,
        has_table_privilege('authenticated','public.students','INSERT') AS student_write`);
      if (Object.values(privileges).some(Boolean)) throw new Error('Sensitive read or write privilege exposed');
      // Phase 4E: test actual PostgreSQL denials, not only privilege metadata.
      await tx`SELECT set_config('request.jwt.claim.sub',${uuids.admin},true)`;
      const negativeChecks = [];
      for (const [label, statement] of [
        ['student date of birth read', 'SELECT date_of_birth FROM public.students'],
        ['guardian read', 'SELECT * FROM public.guardians'],
        ['admission read', 'SELECT * FROM public.admissions'],
        ['audit read', 'SELECT * FROM public.audit_events'],
        ['student insert', "INSERT INTO public.students (school_id,admission_number,first_name,last_name) VALUES ('11111111-1111-4111-8111-111111111111','BLOCKED','No','Write')"],
        ['school update', "UPDATE public.schools SET name='Unauthorized' WHERE id='11111111-1111-4111-8111-111111111111'"],
        ['student delete', "DELETE FROM public.students WHERE school_id='11111111-1111-4111-8111-111111111111'"]
      ]) negativeChecks.push(await expectPermissionDenied(tx, statement, label));
      await tx.unsafe('RESET ROLE');
      results = { mode: 'PHASE4D_LOCAL_RLS_ROLLBACK', rlsTables: rls.count, authForeignKey: fkCount.count, checks, restrictedPrivileges: privileges, negativeChecks };
      throw new Error(marker);
    });
  } catch (error) {
    if (error.message !== marker || !results) throw error;
  }
  const [residual] = await sql.unsafe(`SELECT
    EXISTS (SELECT 1 FROM pg_namespace WHERE nspname='auth') AS auth,
    EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') AS authenticated,
    EXISTS (SELECT 1 FROM pg_class WHERE relname='schools' AND relnamespace='public'::regnamespace) AS schools`);
  if (Object.values(residual).some(Boolean)) throw new Error('Rollback left security test objects behind');
  return { ...results, rolledBack: true, residual };
}

async function main() {
  if (!process.argv.includes('--execute-local-rollback')) throw new Error('Explicit rollback flag required');
  const url = validateDisposableTarget(process.env);
  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 5 });
  try { console.log(JSON.stringify(await validateLocalSecurity(sql), null, 2)); }
  finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => { console.error('Local RLS validation failed or was refused; no credentials printed.'); process.exitCode = 1; });
}
