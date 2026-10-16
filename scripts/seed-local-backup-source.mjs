import { config } from 'dotenv';
import postgres from 'postgres';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDisposableTarget } from './validate-isolated-foundation.mjs';

config({ path: '.env.local', quiet: true });
const expected = 'greenfield_disposable_backup_source';
const assert = (ok, message) => { if (!ok) throw new Error(message); };
const ids = {
  schools: ['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002'],
  sessions: ['20000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'],
  classes: ['30000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000002'],
  students: ['40000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002'],
  guardians: ['50000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000002'],
  terms: ['60000000-0000-4000-8000-000000000001','60000000-0000-4000-8000-000000000002'],
  enrollments: ['70000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000002']
};
const tableNames = ['schools','school_users','memberships','academic_sessions','terms','classes',
  'students','guardians','student_guardians','enrollments','admissions','audit_events'];
function target() {
  const value = validateDisposableTarget(process.env);
  const url = new URL(value);
  assert(url.hostname === '127.0.0.1' && (!url.port || url.port === '5432') &&
    decodeURIComponent(url.pathname.slice(1)) === expected && !url.search && !url.hash,
    'Exact local backup-source URL required');
  return value;
}
async function main() {
  assert(process.argv.length === 3 && process.argv[2] === '--execute-local-synthetic-seed',
    'Explicit --execute-local-synthetic-seed required');
  const sql = postgres(target(), { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const [identity] = await sql`SELECT current_database() AS db, current_user AS role`;
    assert(identity.db === expected && identity.role === 'postgres', 'Unexpected database or role');
    const [metadata] = await sql`SELECT
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r') AS tables,
      (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity) AS rls,
      (SELECT count(*)::int FROM pg_policies WHERE schemaname='public') AS policies,
      (SELECT count(*)::int FROM drizzle.__drizzle_migrations) AS journal`;
    assert(metadata.tables === 12 && metadata.rls === 12 &&
      metadata.policies === 7 && metadata.journal === 1, 'Foundation not verified');
    await sql.begin(async tx => {
      // Block concurrent writers during the emptiness check and seed.
      for (const table of tableNames) await tx.unsafe(`LOCK TABLE public."${table}" IN ACCESS EXCLUSIVE MODE`);
      for (const table of tableNames) {
        const [{ count }] = await tx.unsafe(`SELECT count(*)::int AS count FROM public."${table}"`);
        assert(count === 0, 'Expected empty table: ' + table);
      }
      const names = ['Fictional Cedar Academy', 'Fictional Riverbank School'];
      const slugs = ['synthetic-cedar-test','synthetic-riverbank-test'];
      for (let i = 0; i < 2; i++) {
        const s = ids.schools[i], a = ids.sessions[i], c = ids.classes[i],
          st = ids.students[i], g = ids.guardians[i], t = ids.terms[i], e = ids.enrollments[i];
        await tx`INSERT INTO public.schools (id,name,slug)
          VALUES (${s},${names[i]},${slugs[i]})`;
        await tx`INSERT INTO public.academic_sessions (id,school_id,label,starts_on,ends_on,is_current)
          VALUES (${a},${s},'2026/2027','2026-09-01','2027-07-31',true)`;
        await tx`INSERT INTO public.terms (id,school_id,session_id,name,starts_on,ends_on,is_current)
          VALUES (${t},${s},${a},'First Term','2026-09-01','2026-12-18',true)`;
        await tx`INSERT INTO public.classes (id,school_id,name,section)
          VALUES (${c},${s},'Primary 1','primary')`;
        await tx`INSERT INTO public.students
          (id,school_id,admission_number,first_name,last_name,date_of_birth)
          VALUES (${st},${s},${'TEST-'+(i+1)},'Sample',${i === 0 ? 'Cedar' : 'Riverbank'},'2020-01-01')`;
        await tx`INSERT INTO public.guardians (id,school_id,full_name)
          VALUES (${g},${s},${'Fictional Guardian '+(i+1)})`;
        await tx`INSERT INTO public.student_guardians (school_id,student_id,guardian_id,relationship,is_primary)
          VALUES (${s},${st},${g},'parent',true)`;
        await tx`INSERT INTO public.enrollments (id,school_id,student_id,class_id,session_id)
          VALUES (${e},${s},${st},${c},${a})`;
      }
      const [check] = await tx`SELECT
        (SELECT count(*)::int FROM public.schools) AS schools,
        (SELECT count(*)::int FROM public.students) AS students,
        (SELECT count(*)::int FROM public.enrollments) AS enrollments,
        (SELECT count(*)::int FROM public.student_guardians) AS links,
        (SELECT count(*)::int FROM public.enrollments e
          JOIN public.students s ON s.id=e.student_id AND s.school_id=e.school_id
          JOIN public.classes c ON c.id=e.class_id AND c.school_id=e.school_id
          JOIN public.academic_sessions a ON a.id=e.session_id AND a.school_id=e.school_id) AS valid_enrollments`;
      assert(check.schools === 2 && check.students === 2 && check.enrollments === 2 &&
        check.links === 2 && check.valid_enrollments === 2, 'Synthetic integrity checks failed');
    });
    console.log(JSON.stringify({
      mode:'PHASE4F21_SYNTHETIC_LOCAL_SEED', database:expected,
      fictionalSchools:2, fictionalStudents:2, fictionalGuardians:2,
      enrollments:2, studentGuardianLinks:2, crossSchoolLinksCreated:0,
      remoteConnectionsMade:false, backupTaken:false, restoreTested:false
    },null,2));
  } finally { await sql.end(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(() => {
    console.error('Synthetic local seed refused or failed; no credentials printed.');
    process.exitCode = 1;
  });
}
