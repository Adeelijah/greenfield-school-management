// Generated disposable finance only. No environment, driver, SDK or live route.
// @ts-expect-error Explicit extension for the offline Node type-strip runner.
import { parseFinanceCommand } from './finance.ts';
import type { FinanceCommand, FinanceSuccess } from './finance';

type Sql = { unsafe(query: string, params?: unknown[]): Promise<Record<string, unknown>[]> };
export type FinanceFixtureDatabase = { begin<T>(work: (tx: Sql) => Promise<T>): Promise<T> };
const failures = ['invalid', 'forbidden', 'conflict', 'invalid_history', 'overpayment', 'duplicate_reference', 'unavailable'] as const;
type Denial = { ok: false; code: typeof failures[number] };
export type FinanceFixtureOutcome = Denial | { ok: true; kind: 'applied' | 'replay'; result: FinanceSuccess };
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const unavailable: Denial = { ok: false, code: 'unavailable' };
class Rejected extends Error {
  readonly outcome: Denial;
  constructor(outcome: Denial) { super('Finance fixture transaction rejected'); this.outcome = outcome; }
}

function decode(raw: unknown, command: FinanceCommand): FinanceFixtureOutcome | null {
  if (!object(raw)) return null;
  if (raw.ok === false && Object.keys(raw).length === 2 && failures.some(code => code === raw.code)) return { ok: false, code: raw.code as Denial['code'] };
  const r = raw.result;
  if (raw.ok !== true || Object.keys(raw).length !== 3 || (raw.kind !== 'applied' && raw.kind !== 'replay') || !object(r) || Object.keys(r).length !== 6 || r.ok !== true || r.action !== command.action || r.invoiceId !== command.invoiceId || r.version !== command.expectedVersion + 1 || !uuid(r.eventId)) return null;
  if (command.action === 'record_payment' ? !uuid(r.receiptId) : r.receiptId !== null) return null;
  return { ok: true, kind: raw.kind, result: { ok: true, action: command.action, invoiceId: command.invoiceId, version: command.expectedVersion + 1, eventId: r.eventId, receiptId: r.receiptId as string | null } };
}

/** The trusted server/fixture callback supplies the verified identity, never the request. */
export async function executeFinancePostingFixture(db: FinanceFixtureDatabase, schema: string, identity: () => Promise<{ authUserId: string } | null>, raw: unknown): Promise<FinanceFixtureOutcome> {
  if (!/^fi_it_[a-f0-9]{16}$/.test(schema)) return { ok: false, code: 'invalid' };
  const command = parseFinanceCommand(raw);
  if (!command) return { ok: false, code: 'invalid' };
  const payload = JSON.stringify(command);
  const login = schema + '_login';
  const worker = schema + '_worker';
  try {
    const principal = await identity();
    if (!principal || !uuid(principal.authUserId)) return { ok: false, code: 'forbidden' };
    const authUserId = principal.authUserId.toLowerCase();
    return await db.begin(async tx => {
      const session = async (role: string) => {
        const rows = await tx.unsafe('SELECT session_user AS login,current_user AS role');
        if (rows.length !== 1 || rows[0]!.login !== login || rows[0]!.role !== role) throw new Rejected({ ok: false, code: 'forbidden' });
      };
      await session(login);
      await tx.unsafe(`SET LOCAL ROLE "${worker}"`);
      await session(worker);
      const rows = await tx.unsafe(`SELECT "${schema}"."post_finance"($1::uuid,$2::text::jsonb) AS outcome`, [authUserId, payload]);
      const outcome = rows.length === 1 ? decode(rows[0]!.outcome, command) : null;
      if (!outcome) throw new Rejected(unavailable);
      if (!outcome.ok) throw new Rejected(outcome);
      return outcome;
    });
  } catch (error) { return error instanceof Rejected ? error.outcome : unavailable; }
}
