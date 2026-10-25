import 'server-only';
import { readLocalStagingWorkspace } from '@/server/academics/report-card-staging-workspace';
import { stagingClassChoices } from '@/lib/academics/report-card-staging-ui';
import { projectStagingDashboard } from '@/lib/accounts/staging-dashboard';
import type { StagingWorkspace } from '@/lib/academics/report-card-staging-ui';

export async function readStagingDashboard(role: 'admin' | 'teacher' | 'bursar') {
  // Never send the bursar through an academic adapter, or query finance through
  // the academic runtime. There is no approved finance reader on this boundary.
  if (role === 'bursar') return null;
  const classes: { key: string; label: string; workspace: StagingWorkspace }[] = [];
  for (const choice of stagingClassChoices) {
    const result = await readLocalStagingWorkspace(choice.key);
    if (!result.ok) {
      if (role === 'teacher' && result.code === 'forbidden') continue;
      return null;
    }
    if (result.workspace.role !== role) return null;
    classes.push({ key: choice.key, label: choice.label, workspace: result.workspace });
  }
  if (!classes.length) return null;
  return projectStagingDashboard(role, classes);
}
