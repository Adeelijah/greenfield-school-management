// Operator-only development bootstrap. NEVER expose this as a web route.
// DRY RUN ONLY until the foundation migration, RLS/grants and integration
// tests are complete. No database writes are possible in this version.
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const userId = get('--auth-user-id');
const slug = get('--school-slug');
const schoolName = get('--school-name');
const displayName = get('--display-name');

if (args.includes('--execute') || args.includes('--confirm')) {
  console.error('Provisioning is locked: execution is not implemented. This command is dry-run only.');
  process.exitCode = 1;
} else if (!userId || !uuid.test(userId) || !slug || slug.length > 80 || !slugPattern.test(slug) ||
  !schoolName?.trim() || schoolName.length > 180 || !displayName?.trim() || displayName.length > 160) {
  console.error('Usage: node scripts/bootstrap-school-admin.mjs --auth-user-id UUID --school-slug greenfield-demo --school-name "Greenfield Demo School" --display-name "Test Admin"');
  console.error('This command is read-only and does not create schools or memberships.');
  process.exitCode = 1;
} else if (!process.env.MIGRATION_DATABASE_URL) {
  console.error('MIGRATION_DATABASE_URL is missing; do not paste its value into chat.');
  process.exitCode = 1;
} else {
  const db = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, prepare: false, connect_timeout: 5 });
  try {
    const [{ authExists, schoolsExist, usersExist, membersExist, auditsExist }] = await db`
      SELECT
        to_regclass('auth.users') IS NOT NULL AS "authExists",
        to_regclass('public.schools') IS NOT NULL AS "schoolsExist",
        to_regclass('public.school_users') IS NOT NULL AS "usersExist",
        to_regclass('public.memberships') IS NOT NULL AS "membersExist",
        to_regclass('public.audit_events') IS NOT NULL AS "auditsExist"
    `;
    if (![authExists, schoolsExist, usersExist, membersExist, auditsExist].every(Boolean)) {
      console.log('DRY RUN: required tables are not all present. No writes made.');
    } else {
      const [authRows, schoolRows, userRows] = await Promise.all([
        db`SELECT EXISTS(SELECT 1 FROM auth.users WHERE id = ${userId}::uuid) AS found`,
        db`SELECT EXISTS(SELECT 1 FROM public.schools WHERE slug = ${slug}) AS found`,
        db`SELECT EXISTS(SELECT 1 FROM public.school_users WHERE auth_user_id = ${userId}::uuid) AS found`
      ]);
      console.log('DRY RUN (no writes):');
      console.log('Supabase Auth account exists:', authRows[0].found);
      console.log('School slug available:', !schoolRows[0].found);
      console.log('School user already provisioned:', userRows[0].found);
      console.log('Operator review required before implementing transactional execution.');
    }
  } catch (error) {
    console.error('Dry-run inspection failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
