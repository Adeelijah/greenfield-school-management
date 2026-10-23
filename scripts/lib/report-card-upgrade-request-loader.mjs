// Controlled test transport only. Real server entry/bridge/domain modules remain
// intact; no Next server, SDK credentials, application adapter or connection.
import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { registerHooks, stripTypeScriptTypes } from 'node:module';
import { readFileSync } from 'node:fs';

const academic = ['report-card-sql-scope', 'report-card-command-response', 'report-card-staging-runtime', 'report-card-staging-command-boundary', 'report-card-actor-authority', 'report-card-request-command', 'report-card-complete-fixture-boundary',
  'report-card-postgres-workflow-writer', 'report-card-postgres-canonical-writer', 'report-card-postgres-revoke-writer',
  'report-card-postgres-command-context', 'assessment-postgres-canonical-reader', 'assessment-postgres-fixture-source-reader',
  'report-card-persisted-model-map', 'assessment-persistence-policy', 'calendar-assessments', 'report-card-approved-snapshot',
  'assessment-canonical-source', 'assessment-relational-recalculation', 'report-card-canonical-snapshot',
  'report-card-snapshot-readiness', 'report-card-release-correction'];

export async function openUpgradeRequestFixture() {
  const root = new URL('../../', import.meta.url), token = randomUUID();
  const paths = academic.map(name => 'src/lib/academics/' + name + '.ts').concat(['src/server/auth/report-card-identity.ts', 'src/server/academics/report-card-fixture-commands.ts', 'src/server/academics/report-card-staging-commands.ts']);
  const urls = new Map(paths.map(path => { const url = new URL(path, root); url.searchParams.set('upgradeRequest', token); return [path, url.href]; }));
  const sources = new Set(urls.values());
  const key = 'greenfield.upgrade-request.' + token;
  const requests = new AsyncLocalStorage();
  globalThis[Symbol.for(key)] = requests;
  const mocks = new Map([
    ['server-only', 'export {};'],
    ['drizzle-orm', 'export function sql(){throw Error("Application SQL builder is outside this fixture");}'],
    ['@/db/client', 'export function getDatabase(){throw Error("Application connection is outside this fixture");}'],
    ['@/lib/supabase/server', `export function createSupabaseServerClient(){
      const request=globalThis[Symbol.for(${JSON.stringify(key)})]?.getStore();
      if(!request)throw Error('Missing controlled request transport');
      return {auth:{getUser:()=>request.getUser()},rpc:(...args)=>request.rpc(...args)};
    }`],
  ]);
  const prefix = 'greenfield-upgrade-request-' + token + ':';
  const hooks = registerHooks({
    resolve(specifier, context, next) {
      if (!sources.has(context.parentURL)) return next(specifier, context);
      if (mocks.has(specifier)) return { url: prefix + encodeURIComponent(specifier), shortCircuit: true };
      if (specifier === 'node:crypto') return next(specifier, context);
      let path;
      if (specifier.startsWith('@/')) path = 'src/' + specifier.slice(2) + '.ts';
      else if (specifier.startsWith('./') && specifier.endsWith('.ts')) {
        const target = new URL(specifier, context.parentURL);
        path = target.pathname.slice(root.pathname.length);
      }
      if (!urls.has(path)) throw Error('Unexpected controlled request dependency: ' + specifier);
      return { url: urls.get(path), shortCircuit: true };
    },
    load(url, context, next) {
      if (url.startsWith(prefix)) return { format: 'module', source: mocks.get(decodeURIComponent(url.slice(prefix.length))), shortCircuit: true };
      if (!sources.has(url)) return next(url, context);
      const file = new URL(url); file.search = '';
      return { format: 'module', source: stripTypeScriptTypes(readFileSync(file, 'utf8')), shortCircuit: true };
    },
  });
  let closed = false, active = 0;
  const close = () => {
    if (active) throw Error('Drain controlled requests before closing loader');
    if (!closed) { closed = true; hooks.deregister(); requests.disable(); delete globalThis[Symbol.for(key)]; }
  };
  try {
    const { createVerifiedFixtureReportCommands } = await import(urls.get('src/server/academics/report-card-fixture-commands.ts'));
    const { createVerifiedStagingReportCommands } = await import(urls.get('src/server/academics/report-card-staging-commands.ts'));
    return {
      createStaging: createVerifiedStagingReportCommands,
      create: createVerifiedFixtureReportCommands,
      async withRequest(transport, work) {
        if (closed || !transport || typeof transport.getUser !== 'function' || typeof transport.rpc !== 'function' || typeof work !== 'function') throw Error('Invalid controlled request');
        // Copy transport functions per request; overlapping requests never share
        // a mutable global actor or overwrite one another's SDK callbacks.
        const bound = Object.freeze({ getUser: transport.getUser, rpc: transport.rpc });
        active++;
        try { return await requests.run(bound, work); } finally { active--; }
      },
      close,
    };
  } catch (error) { close(); throw error; }
}
