import 'server-only';
import { redirect } from 'next/navigation';
import { getVerifiedAuthUser } from '@/server/auth/identity';
import { getSchoolAccess } from '@/server/auth/authorization';

export async function requireSchoolAccess() {
  const user = await getVerifiedAuthUser();
  if (!user) redirect('/login');
  const access = await getSchoolAccess();
  if (!access) redirect('/access-pending');
  return access;
}

export async function requireSchoolRole(allowedRoles: readonly ('admin' | 'teacher' | 'bursar')[]) {
  const access = await requireSchoolAccess();
  if (!allowedRoles.includes(access.role)) redirect('/access-pending');
  return access;
}
