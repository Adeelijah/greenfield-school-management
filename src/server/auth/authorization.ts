import 'server-only';
import { eq, and } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { memberships, schoolUsers, schools } from '@/db/schema';
import { getVerifiedAuthUser } from '@/server/auth/identity';

export type SchoolRole = 'admin' | 'teacher' | 'bursar';
export type SchoolAccess = { authUserId: string; schoolId: string; schoolName: string; role: SchoolRole };

export async function getSchoolAccess(): Promise<SchoolAccess | null> {
  const authUser = await getVerifiedAuthUser();
  if (!authUser) return null;
  // No implicit school creation, role assignment, or fallback authorization.
  // Until migrations are applied, this deliberately returns no access.
  try {
    const db = getDatabase();
    const rows = await db.select({
      schoolId: schools.id,
      schoolName: schools.name,
      role: memberships.role,
    }).from(memberships)
      .innerJoin(schoolUsers, eq(memberships.userId, schoolUsers.id))
      .innerJoin(schools, eq(memberships.schoolId, schools.id))
      .where(and(eq(schoolUsers.authUserId, authUser.id), eq(memberships.status, 'active')))
      .limit(2);
    // A user with multiple schools needs explicit selection; never pick a tenant arbitrarily.
    if (rows.length !== 1) return null;
    return { authUserId: authUser.id, ...rows[0] };
  } catch (error) {
    // Fail closed. Never grant access if the schema or DB is unavailable.
    console.error('School authorization lookup failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
