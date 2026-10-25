// Lifecycle only: never stores a user, authorization decision, query or result.
export type DrainableStagingPool = { end(options: { timeout: number }): Promise<unknown> };
export type StagingPoolManager<P extends DrainableStagingPool> = {
  run<T>(key: string, create: () => P, work: (pool: P, reused: boolean) => Promise<T>): Promise<T>;
  retire(): Promise<void>;
};

/** Keep one current configuration. Retired pools drain only after their final
 * borrower completes, so rotation cannot close another request's transaction. */
export function createStagingPoolManager<P extends DrainableStagingPool>(): StagingPoolManager<P> {
  type Entry = { key: string; pool: P; leases: number; retired: boolean; closing?: Promise<void> };
  let current: Entry | undefined;
  const drain = async (entry: Entry) => {
    if (!entry.retired || entry.leases !== 0) return;
    // Cleanup errors cannot restore a retired pool or mask a transaction error.
    entry.closing ??= Promise.resolve().then(() => entry.pool.end({ timeout: 5 })).then(() => {}, () => {});
    await entry.closing;
  };
  return {
    async run<T>(key: string, create: () => P, work: (pool: P, reused: boolean) => Promise<T>): Promise<T> {
      if (!key || typeof create !== 'function' || typeof work !== 'function') throw Error('Invalid staging pool request');
      let entry = current;
      const reused = !!entry && entry.key === key;
      let previous: Entry | undefined;
      if (!reused) {
        const pool = create();
        previous = current;
        entry = { key, pool, leases: 0, retired: false };
        current = entry;
        if (previous) previous.retired = true;
      }
      const borrowed = entry!;
      borrowed.leases++;
      try {
        if (previous) await drain(previous);
        return await work(borrowed.pool, reused);
      } catch (error) {
        borrowed.retired = true;
        if (current === borrowed) current = undefined;
        throw error;
      } finally {
        borrowed.leases--;
        await drain(borrowed);
      }
    },
    async retire() {
      const previous = current; current = undefined;
      if (previous) { previous.retired = true; await drain(previous); }
    },
  };
}
