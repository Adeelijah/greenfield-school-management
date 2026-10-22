// Offline-safe lifecycle helpers. Caller supplies the explicitly opted-in client.
export async function awaitFixtureAuthorityLock(work, ready, timeoutMs = 5000) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) throw Error('Invalid fixture lock timeout');
  let timer;
  try {
    await Promise.race([
      ready,
      work.then(() => { throw Error('Authority lock transaction ended before readiness'); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Authority lock readiness timed out')), timeoutMs); }),
    ]);
  } finally { clearTimeout(timer); }
}

export async function cleanupFixtureAuthority(db, names, created) {
  const match = /^rc_auth_([a-f0-9]{16})$/.exec(names.schema);
  if (!match || names.ownerRole !== 'gf_rc_auth_owner_' + match[1] || names.runtimeRole !== 'gf_rc_auth_runtime_' + match[1]) throw Error('Refuse cleanup of non-generated authority fixture names');
  if (['schema','owner','runtime'].some(key => typeof created[key] !== 'boolean')) throw Error('Missing fixture ownership evidence');
  const quote = name => '"' + name + '"';
  const roles = [created.runtime && names.runtimeRole, created.owner && names.ownerRole].filter(Boolean);
  if (!created.schema && roles.length === 0) return;
  // Drop dependent schema privileges first. Roll back the entire cleanup if
  // any exact role cannot be removed; never claim success after an error.
  await db.begin(async tx => {
    if (created.schema) await tx.unsafe('DROP SCHEMA ' + quote(names.schema) + ' CASCADE');
    for (const role of roles) await tx.unsafe('DROP ROLE ' + quote(role));
  });
  const remaining = await db.unsafe(`SELECT 'schema' AS kind,nspname AS name FROM pg_catalog.pg_namespace WHERE nspname=$1::text
    UNION ALL SELECT 'role' AS kind,rolname AS name FROM pg_catalog.pg_roles WHERE rolname IN ($2::text,$3::text)`,
    [created.schema ? names.schema : null, roles[0] ?? null, roles[1] ?? null]);
  if (remaining.length !== 0) throw Error('Authority fixture cleanup verification failed');
}
