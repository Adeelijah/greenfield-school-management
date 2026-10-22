// OPT-IN local disposable semantic-baseline upgrade rehearsal. No env loader,
// Drizzle configuration, application adapter, public writes or role creation.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as assembly from '../src/db/report-card-staging-schema.review.ts';
import { assessmentFixtureDDL } from './lib/assessment-disposable-schema.mjs';
import { reportUpgradeSourcePlan, reportUpgradeProposalPlan, upgradeFixtureSchema } from './lib/report-card-upgrade-plan.mjs';

const url = process.env.REPORT_CARD_TEST_DATABASE_URL;
if (!url || process.env.REPORT_CARD_TEST_CONFIRM !== 'DISPOSABLE_REPORT_CARD_TEST_ONLY') {
  console.error('SKIPPED: explicit local disposable database URL and confirmation required.');
  process.exitCode = 2;
} else {
  const parsed = new URL(url);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.search || parsed.hash || !/^greenfield_report_cards_disposable(?:_[a-z0-9_]+)?$/.test(decodeURIComponent(parsed.pathname.slice(1)))) throw Error('Only a local disposable database URL without query options is permitted.');
  const schema = 'rc_it_' + randomBytes(8).toString('hex');
  const q = upgradeFixtureSchema(schema), table = name => q + '."' + name + '"';
  const [baseline, dependencies] = await Promise.all([
    readFile(new URL('../drizzle/0000_broad_slayback.sql', import.meta.url), 'utf8'),
    readFile(new URL('../docs/staging/REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql', import.meta.url), 'utf8'),
  ]);
  const plan = reportUpgradeSourcePlan(schema, baseline, dependencies);
  const fixture = assessmentFixtureDDL(schema, { includeReports: true });
  const proposals = reportUpgradeProposalPlan(schema, fixture.statements);
  const client = postgres(url, { max: 1, prepare: false, connect_timeout: 5, onnotice: () => {} });
  const run = async (tx, statements) => { for (const statement of statements) await tx.unsafe(statement); };
  const snapshot = async tx => {
    const relations = await tx.unsafe(`SELECT c.relname,c.relkind,a.attname,a.attnum,a.attnotnull,
      pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
      pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expr
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      LEFT JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname=$1 AND c.relkind IN ('r','i') ORDER BY c.relname,a.attnum`, [schema]);
    const constraints = await tx.unsafe(`SELECT c.relname,k.conname,k.convalidated,pg_catalog.pg_get_constraintdef(k.oid) AS definition
      FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 ORDER BY c.relname,k.conname`, [schema]);
    const enums = await tx.unsafe(`SELECT t.typname,e.enumsortorder,e.enumlabel FROM pg_catalog.pg_type t
      JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid
      WHERE n.nspname=$1 ORDER BY t.typname,e.enumsortorder`, [schema]);
    return JSON.parse(JSON.stringify({ relations, constraints, enums }));
  };
  const relationNames = async tx => Array.from(await tx.unsafe(`SELECT c.relname FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' ORDER BY c.relname`, [schema]), r => r.relname);
  const ids = { school: randomUUID(), class: randomUUID(), student: randomUUID(), guardian: randomUUID(), admission: randomUUID(), audit: randomUUID() };
  const legacyData = async tx => {
    const result = {};
    for (const name of ['schools', 'classes', 'students', 'guardians', 'student_guardians', 'admissions', 'audit_events']) {
      // Keep original column surface; later nullable/additive columns are checked separately.
      const columns = {
        schools: 'id,name,slug', classes: 'id,school_id,name,section', students: 'id,school_id,admission_number,first_name,last_name,status',
        guardians: 'id,school_id,full_name', student_guardians: 'school_id,student_id,guardian_id,relationship,is_primary',
        admissions: 'id,school_id,applicant_name,status', audit_events: 'id,school_id,action,entity_type',
      }[name];
      result[name] = await tx.unsafe('SELECT ' + columns + ' FROM ' + table(name));
    }
    return JSON.parse(JSON.stringify(result));
  };
  let created = false, failure;
  const cleanupProbe = Error('Intentional upgrade fixture cleanup probe');
  try {
    // Fixed private-client session setting; every relation/type is qualified.
    // Prevent an operator role's custom search path from selecting public helpers.
    await client.unsafe('SET search_path=pg_catalog');
    await client.unsafe('CREATE SCHEMA ' + q); created = true;
    await client.begin(async tx => {
      await run(tx, plan.baselineStatements);
      await tx.unsafe('INSERT INTO ' + table('schools') + ' (id,name,slug) VALUES ($1,\'Upgrade fixture school\',\'upgrade-fixture\')', [ids.school]);
      await tx.unsafe('INSERT INTO ' + table('classes') + ' (id,school_id,name,section) VALUES ($1,$2,\'Legacy class\',\'A\')', [ids.class, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('students') + ' (id,school_id,admission_number,first_name,last_name) VALUES ($1,$2,\'FIXTURE-1\',\'Fictional\',\'Pupil\')', [ids.student, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('guardians') + ' (id,school_id,full_name) VALUES ($1,$2,\'Fictional guardian\')', [ids.guardian, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('student_guardians') + ' (school_id,student_id,guardian_id,relationship,is_primary) VALUES ($1,$2,$3,\'parent\',true)', [ids.school, ids.student, ids.guardian]);
      await tx.unsafe('INSERT INTO ' + table('admissions') + ' (id,school_id,applicant_name) VALUES ($1,$2,\'Fictional applicant\')', [ids.admission, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('audit_events') + ' (id,school_id,action,entity_type) VALUES ($1,$2,\'fixture\',\'fixture\')', [ids.audit, ids.school]);
    });
    assert.deepEqual(await relationNames(client), [...plan.baselineTables].sort());
    const before = await snapshot(client), beforeData = await legacyData(client);
    console.log('PASS: journal-source semantic baseline creates 12 relations in dependency order with fictional legacy data');

    const inject = Error('Injected upgrade failure');
    for (const phase of ['dependencies', 'proposal_tables', 'foreign_keys']) {
      await assert.rejects(client.begin(async tx => {
        await run(tx, plan.dependencyStatements);
        if (phase === 'dependencies') throw inject;
        for (const statement of proposals) {
          await tx.unsafe(statement);
          if (phase === 'proposal_tables' && statement.startsWith('CREATE TABLE ') && statement.includes('"report_cards"')) throw inject;
        }
        throw inject;
      }), error => error === inject);
      assert.deepEqual(await snapshot(client), before); assert.deepEqual(await legacyData(client), beforeData);
      console.log('PASS: injected ' + phase + ' failure restores baseline catalog, enums and legacy rows');
    }

    await client.unsafe('ALTER TABLE ' + table('schools') + ' ADD COLUMN final_primary_year text');
    const incompatible = await snapshot(client);
    await assert.rejects(client.begin(async tx => { await run(tx, plan.dependencyStatements); }), error => error.code === '42701');
    assert.deepEqual(await snapshot(client), incompatible); assert.deepEqual(await legacyData(client), beforeData);
    await client.unsafe('ALTER TABLE ' + table('schools') + ' DROP COLUMN final_primary_year');
    // Dropped attributes change internal ordinals only; visible baseline remains unchanged.
    const restored = await snapshot(client);
    assert.deepEqual({ ...restored, relations: restored.relations.map(({ attnum, ...row }) => row) }, { ...before, relations: before.relations.map(({ attnum, ...row }) => row) });
    console.log('PASS: incompatible partial baseline rejects without repairing or mutating its committed state');

    await client.begin(async tx => { await run(tx, plan.dependencyStatements); await run(tx, proposals); });
    assert.deepEqual(await relationNames(client), [...plan.upgradedTables].sort());
    const metadata = Object.values(assembly).filter(value => value && typeof value === 'object').map(getTableConfig);
    const normalizeType = type => type.replaceAll('"', '').replaceAll('character varying', 'varchar').replaceAll(/\s+/g, '').toLowerCase();
    const columns = await client.unsafe(`SELECT c.relname,a.attname,a.attnotnull,pg_catalog.format_type(a.atttypid,a.atttypmod) AS type,
      pg_catalog.pg_get_expr(d.adbin,d.adrelid) AS default_expr
      FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
      LEFT JOIN pg_catalog.pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
      WHERE n.nspname=$1 AND c.relkind='r'`, [schema]);
    const foreignKeys = await client.unsafe(`SELECT c.relname,k.conname,k.convalidated,k.confdeltype,tn.nspname AS target_schema,t.relname AS target,
      ARRAY(SELECT a.attname FROM pg_catalog.unnest(k.conkey) WITH ORDINALITY u(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=u.num ORDER BY u.ord) AS columns,
      ARRAY(SELECT a.attname FROM pg_catalog.unnest(k.confkey) WITH ORDINALITY u(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=t.oid AND a.attnum=u.num ORDER BY u.ord) AS target_columns
      FROM pg_catalog.pg_constraint k JOIN pg_catalog.pg_class c ON c.oid=k.conrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace JOIN pg_catalog.pg_class t ON t.oid=k.confrelid
      JOIN pg_catalog.pg_namespace tn ON tn.oid=t.relnamespace WHERE n.nspname=$1 AND k.contype='f'`, [schema]);
    const indexes = await client.unsafe(`SELECT c.relname,i.relname AS name,x.indisunique,x.indisvalid,x.indisready,x.indpred IS NOT NULL AS partial,
      ARRAY(SELECT a.attname FROM pg_catalog.unnest(x.indkey::smallint[]) WITH ORDINALITY u(num,ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid AND a.attnum=u.num ORDER BY u.ord) AS columns
      FROM pg_catalog.pg_index x JOIN pg_catalog.pg_class c ON c.oid=x.indrelid JOIN pg_catalog.pg_class i ON i.oid=x.indexrelid
      JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1`, [schema]);
    for (const config of metadata) {
      const actual = columns.filter(row => row.relname === config.name);
      assert.equal(actual.length, config.columns.length, config.name + ' column count');
      for (const column of config.columns) {
        const found = actual.find(row => row.attname === column.name); assert.ok(found);
        assert.equal(normalizeType(found.type), normalizeType(fixture.columnType(column)), config.name + '.' + column.name + ' type');
        assert.equal(found.attnotnull, column.notNull, config.name + '.' + column.name + ' nullability');
        assert.equal(found.default_expr !== null, column.default !== undefined, config.name + '.' + column.name + ' default presence');
      }
      const actualFKs = foreignKeys.filter(row => row.relname === config.name);
      assert.equal(actualFKs.length, config.foreignKeys.length, config.name + ' FK count');
      for (const fk of config.foreignKeys) {
        const ref = fk.reference(), found = actualFKs.find(row => row.conname === fk.getName()); assert.ok(found, fk.getName());
        assert.equal(found.convalidated, true); assert.equal(found.target_schema, schema);
        assert.equal(found.target, getTableConfig(ref.foreignTable).name);
        assert.deepEqual(found.columns, ref.columns.map(c => c.name)); assert.deepEqual(found.target_columns, ref.foreignColumns.map(c => c.name));
        assert.equal(found.confdeltype, { restrict: 'r', cascade: 'c', 'no action': 'a', 'set null': 'n', 'set default': 'd' }[fk.onDelete ?? 'no action']);
      }
      for (const index of config.indexes) {
        const found = indexes.find(row => row.relname === config.name && row.name === index.config.name); assert.ok(found, index.config.name);
        assert.equal(found.indisvalid, true); assert.equal(found.indisready, true);
        assert.equal(found.indisunique, index.config.unique); assert.equal(found.partial, !!index.config.where);
        assert.deepEqual(found.columns, index.config.columns.map(c => c.name));
      }
    }
    assert.ok(indexes.every(index => index.indisvalid && index.indisready));
    const enums = await client.unsafe(`SELECT t.typname,e.enumlabel FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
      JOIN pg_catalog.pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=$1 ORDER BY t.typname,e.enumsortorder`, [schema]);
    assert.equal(new Set(enums.map(row => row.typname)).size, 9);
    for (const type of Object.values(assembly).filter(value => typeof value === 'function' && typeof value.enumName === 'string')) {
      assert.deepEqual(Array.from(enums.filter(row => row.typname === type.enumName), row => row.enumlabel), type.enumValues);
    }
    console.log('PASS: committed upgrade creates 31 relations with matching selected columns, enum labels, index tuples and exact validated FKs');

    assert.deepEqual(await legacyData(client), beforeData);
    assert.deepEqual((await client.unsafe('SELECT final_primary_year,structure_version FROM ' + table('schools'))).map(row => ({ ...row })), [{ final_primary_year: null, structure_version: 0 }]);
    assert.deepEqual((await client.unsafe('SELECT level_id,section_id FROM ' + table('classes'))).map(row => ({ ...row })), [{ level_id: null, section_id: null }]);
    console.log('PASS: legacy admissions, guardian links and audit rows survive without inferred school year or class backfill');
    throw cleanupProbe;
  } catch (error) { if (error !== cleanupProbe) failure = error; }
  finally {
    try {
      if (created) {
        upgradeFixtureSchema(schema);
        await client.unsafe('DROP SCHEMA ' + q + ' CASCADE');
        const remaining = await client.unsafe('SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname=$1', [schema]);
        assert.equal(remaining.length, 0, 'Generated upgrade schema remains after cleanup');
      }
    } catch (cleanupError) { failure = failure ? new AggregateError([failure, cleanupError], 'Upgrade rehearsal and cleanup failed') : cleanupError; }
    finally { await client.end(); }
  }
  if (failure) throw failure;
  console.log('PASS: exact generated upgrade schema is removed after intentional workload failure');
}
