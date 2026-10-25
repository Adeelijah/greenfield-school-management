import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { readStagingStaffAccount } from '@/server/accounts/staging-staff-account';
import { readStagingDashboard } from '@/server/accounts/staging-dashboard';
import { canOpenAcademicPage } from '@/lib/accounts/staging-academic-pages';
import type { AcademicPage } from '@/lib/accounts/staging-academic-pages';

/** The route body never supplies a role or school. Check verified staff role
 * before any academic read; each underlying class reader rechecks it in SQL. */
export async function readStagingStaffPage(view?: AcademicPage, selectedClass: unknown = 'all') {
  if (!stagingUiEnabled(process.env)) return { kind: 'not-found' } as const;
  if (typeof selectedClass !== 'string' || !['all','primary5','creche'].includes(selectedClass)) return { kind: 'not-found' } as const;
  let auth;
  try { const client = await createSupabaseServerClient(); auth = await client.auth.getUser(); } catch { return { kind: 'sign-in' } as const; }
  if (auth.error || !auth.data.user) return { kind: 'sign-in' } as const;
  const role = await readStagingStaffAccount();
  if (!role) return { kind: 'unavailable' } as const;
  if (view && !canOpenAcademicPage(role, view)) return { kind: 'not-found' } as const;
  const data = await readStagingDashboard(role);
  if (data && selectedClass !== 'all' && !data.classes.some(c=>c.key===selectedClass)) return { kind: 'not-found' } as const;
  return { kind: 'ready', role, data, selectedClass } as const;
}
