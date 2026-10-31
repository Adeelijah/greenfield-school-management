import 'server-only';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import postgres from 'postgres';
import { assessmentScoreWritesEnabled, validAssessmentScoreDatabaseUrl } from '@/lib/academics/assessment-score-staging-policy';
import type { SqlDatabase, SqlClient } from '@/lib/academics/report-card-postgres-disposable-adapter';
import { createStagingPoolManager } from '@/lib/academics/report-card-staging-pool';
import type { StagingPoolManager } from '@/lib/academics/report-card-staging-pool';

type Pool = ReturnType<typeof postgres>;
const poolSlot = Symbol.for('greenfield.local-staging.assessment-score-pool.v1');
const pools = globalThis as typeof globalThis & { [key: symbol]: StagingPoolManager<Pool> | undefined };
const manager = pools[poolSlot] ??= createStagingPoolManager<Pool>();

/** Separate, lazy staging connection. Never reads DATABASE_URL or owner credentials. */
export function getStagingAssessmentScoreDatabase(): SqlDatabase {
  if (!assessmentScoreWritesEnabled(process.env)) throw Error('Local staging is disabled');
  const url = process.env.GREENFIELD_STAGING_ASSESSMENT_SCORE_DATABASE_URL;
  const certificatePath = process.env.GREENFIELD_STAGING_DB_CA_FILE;
  if (!validAssessmentScoreDatabaseUrl(url) || !certificatePath) throw Error('Staging connection configuration is incomplete');
  const ca = readFileSync(certificatePath, 'utf8');
  if (!ca.includes('-----BEGIN CERTIFICATE-----')) throw Error('Staging certificate is invalid');
  const key = createHash('sha256').update('local-staging-assessment-score-pool-v1\0').update(url).update('\0').update(ca).digest('hex');
  // Lazy across requests and development reloads; only physical SQL connections
  // are reused. Identity, role catalog and permission checks are never cached.
  return {
    unsafe(): never { throw Error('Staging SQL requires a transaction'); },
    async begin<T>(work: (tx: SqlClient) => Promise<T>): Promise<T> {
      if (!assessmentScoreWritesEnabled(process.env) || process.env.GREENFIELD_STAGING_ASSESSMENT_SCORE_DATABASE_URL !== url ||
        process.env.GREENFIELD_STAGING_DB_CA_FILE !== certificatePath || readFileSync(certificatePath, 'utf8') !== ca) throw Error('Staging connection configuration changed');
      return manager.run(key, () => postgres(url, { max: 2, prepare: false, ssl: { ca, rejectUnauthorized: true },
        connect_timeout: 20, idle_timeout: 30, max_lifetime: 300, onnotice: () => {} }), async (client, reused) => {
        const started = Date.now();
        let queryCount = 0, queryMs = 0, setupMs = 0, completed = false;
        try {
          // The adapter shape deliberately exposes only the reviewed SQL port.
          return await client.begin(async tx => {
            await tx.unsafe("SELECT set_config('statement_timeout','60s',true),set_config('lock_timeout','5s',true)");
            setupMs = Date.now() - started;
            let active = true, poisoned = false, inFlight = 0;
            try {
              const result = await work({ unsafe: async (query, params) => {
                if (!active || poisoned) throw Error('Expired or poisoned staging SQL lease');
                inFlight++;
                const queryStarted = Date.now(); queryCount++;
                try {
                  const rows = await tx.unsafe(query, params as Parameters<typeof tx.unsafe>[1]);
                  return Array.from(rows);
                } catch (error) {
                  poisoned = true;
                  const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(error.code) ? error.code : 'unavailable';
                  const relation = /\bFROM\s+(?:"public"\.|public\.)(?:"([a-z_]+)"|([a-z_]+))/.exec(query);
                  const operation = relation?.[1] ?? relation?.[2] ?? (query.includes('pg_catalog.pg_roles') ? 'role_catalog' : 'transaction');
                  console.warn(`Greenfield assessment-score SQL: operation=${operation}; code=${code}`);
                  throw error;
                } finally { inFlight--; queryMs += Date.now() - queryStarted; }
              } });
              if (poisoned || inFlight !== 0) throw Error('Incomplete staging SQL transaction');
              completed = true;
              return result;
            } finally { active = false; }
          }) as T;
        } catch (error) {
          const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' && /^[A-Za-z0-9_]{1,64}$/.test(error.code) ? error.code : 'unavailable';
          console.warn(`Greenfield assessment-score transaction: code=${code}`);
          throw error;
        } finally {
          console.info(`Greenfield assessment-score timing: outcome=${completed ? 'callback_completed' : 'failed'}; total_ms=${Date.now() - started}; setup_ms=${setupMs}; queries=${queryCount}; query_ms=${queryMs}; pool=${reused ? 'existing' : 'new'}`);
        }
      });
    },
  };
}
