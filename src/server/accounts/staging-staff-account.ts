import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stagingUiEnabled, stagingSchoolId } from '@/lib/academics/report-card-staging-ui';
import { decodeStagingStaffAccount } from '@/lib/academics/staging-staff-account';

/** Presentation routing only. Module access must still use its own current
 * authority checks; never pass this role as command authorization. */
export async function readStagingStaffAccount() {
  if (!stagingUiEnabled(process.env)) return null;
  try {
    const client = await createSupabaseServerClient();
    const verified = await client.auth.getUser();
    if (verified.error || !verified.data.user) return null;
    const result = await client.rpc('resolve_staging_staff_account');
    return result.error ? null : decodeStagingStaffAccount(verified.data.user.id, stagingSchoolId, result.data);
  } catch { return null; }
}
