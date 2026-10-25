// Local staging policy only. No environment reads, credentials, SQL or SDK calls.
// @ts-expect-error Explicit source extension for the offline Node runner.
import { parseReportCardRequestCommand } from './report-card-request-command.ts';
import type { ReportCardRequestCommand } from './report-card-request-command';

export const stagingSchoolId = '0c594571-74c5-46fe-a835-a9b217a3a199';
export const stagingProjectUrl = 'https://hweoqkbgmzycyznrbvng.supabase.co';
export function validStagingPublicKey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return false;
    // Classification only, not JWT authentication. The SDK verifies requests.
    const payload = JSON.parse(atob(parts[1]!.replaceAll('-', '+').replaceAll('_', '/')));
    return payload?.role === 'anon' && payload?.ref === 'hweoqkbgmzycyznrbvng';
  } catch { return false; }
}
export function stagingUiEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.NODE_ENV === 'development' && env.GREENFIELD_STAGING_UI === 'LOCAL_STAGING_REPORTS_ONLY' &&
    env.NEXT_PUBLIC_SUPABASE_URL === stagingProjectUrl && validStagingPublicKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
export function stagingCommandsEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  return stagingUiEnabled(env) && env.GREENFIELD_STAGING_COMMANDS === 'FICTIONAL_STAGING_WRITES_ONLY';
}
export function isStagingPath(path: string): boolean {
  return path === '/staging' || path.startsWith('/staging/');
}
export function stagingProxyDestination(path: string, authenticated: boolean): string | null {
  return !authenticated && path !== '/staging/login' ? '/staging/login'
    : authenticated && path === '/staging/login' ? '/staging/dashboard' : null;
}
export function validStagingDatabaseUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'postgresql:' && url.hostname === 'aws-0-eu-west-1.pooler.supabase.com' &&
      url.port === '5432' && url.pathname === '/postgres' && url.username === 'greenfield_app.hweoqkbgmzycyznrbvng' &&
      !!url.password && !url.search && !url.hash;
  } catch { return false; }
}
export function parseStagingCommandForm(form: FormData): ReportCardRequestCommand | null {
  const row: Record<string, unknown> = Object.create(null);
  for (const [key, value] of form.entries()) {
    // Next injects action metadata into progressively enhanced form submissions.
    if (key.startsWith('$ACTION_')) continue;
    if (Object.hasOwn(row, key) || typeof value !== 'string') return null;
    if (key === 'expectedVersion') {
      if (!/^[1-9]\d*$/.test(value)) return null;
      row[key] = Number(value);
    } else row[key] = value;
  }
  return parseReportCardRequestCommand(row);
}

// Two fictional fixture scopes only. No request may select another school/year.
export const stagingClassChoices = [
  { key: 'primary5', label: 'Primary 5 A', classId: '1dbfa5e7-99b8-5094-b1f9-c872477d4bf6' },
  { key: 'creche', label: 'Creche A', classId: 'fe6e5a74-b93a-5d00-8115-53b6952153be' },
] as const;
export function stagingSelector(value: unknown) {
  const choice = stagingClassChoices.find(c => c.key === value);
  return choice ? { classId: choice.classId, sessionId: '8a9350ca-95cb-50ca-b750-2d8d5a192044', termId: 'f7742f7c-ffe4-58ee-8dce-c687ec623330' } : null;
}
export type StagingReportRow = {
  reportId: string; studentId: string; enrollmentId: string; version: number;
  stage: 'draft' | 'submitted' | 'returned' | 'approved' | 'published';
  returnReason: string | null; releaseId: string | null;
};
export type StagingPupil = { studentId: string; enrollmentId: string; label: string };
export type StagingWorkspace = {
  role: 'admin' | 'teacher'; pupils: StagingPupil[]; reports: StagingReportRow[];
  assessmentRevision: number; subjectCount: number;
};
