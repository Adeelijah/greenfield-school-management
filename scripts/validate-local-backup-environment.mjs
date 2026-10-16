const FORBIDDEN_VARIABLES = [
  'PGHOST',
  'PGHOSTADDR',
  'PGPORT',
  'PGDATABASE',
  'PGUSER',
  'PGPASSWORD',
  'PGPASSFILE',
  'PGSERVICE',
  'PGSERVICEFILE',
  'PGOPTIONS',
  'PGSSLMODE',
  'PGSSLROOTCERT',
  'PGSSLCERT',
  'PGSSLKEY',
  'PGTARGETSESSIONATTRS'
];

export function validateLocalBackupEnvironment(env) {
  if (!env || typeof env !== 'object') {
    throw new Error('Explicit environment object required');
  }

  const present = FORBIDDEN_VARIABLES.filter(
    name => Object.hasOwn(env, name)
  );

  if (present.length > 0) {
    throw new Error(
      `Inherited PostgreSQL environment variables prohibited: ${present.join(', ')}`
    );
  }

  return {
    safe: true,
    checkedVariables: FORBIDDEN_VARIABLES.length
  };
}

export { FORBIDDEN_VARIABLES };