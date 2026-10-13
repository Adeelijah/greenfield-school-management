/**
 * Fail-closed guard for direct application database connections.
 * This is a configuration gate, NOT a substitute for checking actual
 * PostgreSQL role privileges, grants, tenant authorization or RLS.
 */
export function assertRestrictedDatabaseConfiguration(
  applicationUrl: string | undefined,
  migrationUrl: string | undefined,
  verifiedRole: string | undefined,
): void {
  if (!applicationUrl) throw new Error('DATABASE_URL is not configured');
  if (!migrationUrl) throw new Error('MIGRATION_DATABASE_URL is not configured');
  if (applicationUrl === migrationUrl) {
    throw new Error('Application database credentials must differ from migration credentials');
  }
  let username: string;
  try {
    username = decodeURIComponent(new URL(applicationUrl).username);
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
  // Supabase pooler usernames may include a project suffix.
  if (/^postgres(?:\.|$)/i.test(username) || /^supabase_admin(?:\.|$)/i.test(username)) {
    throw new Error('Privileged database usernames are not permitted for application queries');
  }
  // An operator must explicitly acknowledge that live role/grant checks passed.
  // A matching username alone does not prove that RLS is enforced.
  if (verifiedRole !== 'greenfield_app') {
    throw new Error('Restricted application database role has not been verified');
  }
  if (username !== 'greenfield_app' && !username.startsWith('greenfield_app.')) {
    throw new Error('DATABASE_URL must authenticate as the reviewed greenfield_app role');
  }
}
