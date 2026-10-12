import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Verified identity only. Never accept user IDs from request bodies or URL params
 * as proof of authentication. This does not authorize access to any school.
 */
export async function getVerifiedAuthUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function requireVerifiedAuthUser() {
  const user = await getVerifiedAuthUser();
  if (!user) throw new Error('UNAUTHENTICATED');
  return user;
}
