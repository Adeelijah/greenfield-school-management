'use server';
import { revalidatePath } from 'next/cache';
import { stagingCommandsEnabled, parseStagingCommandForm } from '@/lib/academics/report-card-staging-ui';
import { getLocalStagingDatabase, localStagingRuntimeConfig } from '@/server/academics/report-card-staging-connection';
import { createVerifiedStagingReportCommands } from '@/server/academics/report-card-staging-commands';
import type { ReportCardCommandResponse } from '@/lib/academics/report-card-command-response';

export async function runStagingReportCommand(_previous: ReportCardCommandResponse | null, form: FormData): Promise<ReportCardCommandResponse> {
  if (!stagingCommandsEnabled(process.env)) return { ok: false, code: 'forbidden' };
  const command = parseStagingCommandForm(form);
  if (!command) return { ok: false, code: 'invalid' };
  try {
    const execute = createVerifiedStagingReportCommands(getLocalStagingDatabase(), localStagingRuntimeConfig);
    const result = await execute(command);
    if (result.ok) revalidatePath('/staging/report-cards');
    return result;
  } catch { return { ok: false, code: 'unavailable' }; }
}
