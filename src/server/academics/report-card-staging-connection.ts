import 'server-only';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { stagingSchoolId, stagingUiEnabled, validStagingDatabaseUrl } from '@/lib/academics/report-card-staging-ui';
import type { SqlDatabase, SqlClient } from '@/lib/academics/report-card-postgres-disposable-adapter';

export const localStagingRuntimeConfig = {
  mode: 'isolated-staging-review', schema: 'public', schoolId: stagingSchoolId,
  loginRole: 'greenfield_app', commandRole: 'greenfield_report_card_runtime',
  roleAdministration: 'supabase-postgres-createrole',
} as const;

/** Separate, lazy staging connection. Never reads DATABASE_URL or owner credentials. */
export function getLocalStagingDatabase(): SqlDatabase {
  if (!stagingUiEnabled(process.env)) throw Error('Local staging is disabled');
  const url = process.env.GREENFIELD_STAGING_DATABASE_URL;
  const certificatePath = process.env.GREENFIELD_STAGING_DB_CA_FILE;
  if (!validStagingDatabaseUrl(url) || !certificatePath) throw Error('Staging connection configuration is incomplete');
  const ca = readFileSync(certificatePath, 'utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw Error('Staging certificate is invalid');
  // Opening the SQL transaction remains deferred until the command entry has
  // verified identity. Short-lived clients avoid cross-reload configuration reuse.
  return {
    unsafe(): never { throw Error('Staging SQL requires a transaction'); },
    async begin<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      const started = Date.now();
      let queryCount = 0, queryMs = 0, setupMs = 0, completed = false;
      const client = postgres(url, { max: 1, prepare: false, ssl: { ca, rejectUnauthorized: true }, connect_timeout: 20, onnotice: () => {} });
      try {
        // The adapter shape deliberately exposes only the reviewed SQL port.
        return await client.begin(async tx => {
          await tx.unsafe("SET LOCAL statement_timeout='60s'");
          await tx.unsafe("SET LOCAL lock_timeout='5s'");
          setupMs = Date.now() - started;
          const result = await work({ unsafe: async (query, params) => {
            const queryStarted = Date.now(); queryCount++;
            try {
              const rows = await tx.unsafe(query, params as Parameters<typeof tx.unsafe>[1]);
              return Array.from(rows);
            } catch (error) {
              const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(error.code) ? error.code : 'unavailable';
              const relation = /\bFROM\s+(?:"public"\.|public\.)(?:"([a-z_]+)"|([a-z_]+))/.exec(query);
              const operation = relation?.[1] ?? relation?.[2] ?? (query.includes('pg_catalog.pg_roles') ? 'role_catalog' : 'transaction');
              console.warn(`Greenfield staging SQL: operation=${operation}; code=${code}`);
              throw error;
            } finally { queryMs += Date.now() - queryStarted; }
          } });
          completed = true;
          return result;
        }) as T;
      } catch (error) {
        const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(error.code) ? error.code : 'unavailable';
        console.warn(`Greenfield staging transaction: code=${code}`);
        throw error;
      } finally {
        await client.end({ timeout: 5 });
        console.info(`Greenfield staging timing: outcome=${completed ? 'callback_completed' : 'failed'}; total_ms=${Date.now() - started}; setup_ms=${setupMs}; queries=${queryCount}; query_ms=${queryMs}`);
      }
    },
  };
}
