// OPT-IN local disposable semantic-baseline upgrade rehearsal. No env loader,
// Drizzle configuration, application adapter or public writes. Transactional
// role creation additionally requires the explicit disposable role-admin token.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as assembly from '../src/db/report-card-staging-schema.review.ts';
import { assessmentFixtureDDL } from './lib/assessment-disposable-schema.mjs';
import { reportUpgradeSourcePlan, reportUpgradeProposalPlan, upgradeFixtureSchema } from './lib/report-card-upgrade-plan.mjs';
import { reportUpgradeGuardPlan } from './lib/report-card-upgrade-guards.mjs';
import { awaitFixtureAuthorityLock } from './lib/actor-authority-fixture-lifecycle.mjs';
import { probeUpgradeSecurity } from './lib/report-card-upgrade-security-probe.mjs';
import { probeUpgradeLogin } from './lib/report-card-upgrade-login-probe.mjs';
import { upgradeLoginCleanupPlan } from './lib/report-card-upgrade-login-plan.mjs';

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
  const client = postgres(url, { max: 2, prepare: false, connect_timeout: 5, connection: { search_path: 'pg_catalog' }, onnotice: () => {} });
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
  let created = false, securityCommitted = false, failure;
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

    const guardPlan = reportUpgradeGuardPlan(schema);
    const structural = await snapshot(client);
    await assert.rejects(client.begin(async tx => { await run(tx, guardPlan.statements); throw inject; }), error => error === inject);
    assert.deepEqual(await snapshot(client), structural); assert.deepEqual(await legacyData(client), beforeData);
    assert.equal((await client.unsafe('SELECT p.oid FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1', [schema])).length, 0);
    console.log('PASS: failed guard installation rolls back protocol tables, functions and triggers without changing upgraded data');

    await client.begin(tx => run(tx, guardPlan.statements));
    const triggers = await client.unsafe(`SELECT c.relname,t.tgname,t.tgenabled FROM pg_catalog.pg_trigger t
      JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=$1 AND NOT t.tgisinternal`, [schema]);
    for (const name of guardPlan.immutable) for (const trigger of ['fixture_upgrade_history_write', 'fixture_upgrade_history_truncate']) assert.ok(triggers.some(t => t.relname === name && t.tgname === trigger && t.tgenabled === 'O'));
    for (const name of guardPlan.authorityTargets) assert.ok(triggers.some(t => t.relname === name && t.tgname === 'fixture_authority_gate' && t.tgenabled === 'O'));
    const functions = await client.unsafe(`SELECT p.proname,EXISTS(SELECT 1 FROM pg_catalog.aclexplode(COALESCE(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE') AS public_execute
      FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1`, [schema]);
    assert.equal(functions.length, 7); assert.ok(functions.every(f => !f.public_execute));
    console.log('PASS: upgraded schema installs source, parent, immutable-history and release guards with private helper execution');

    const sessionId = randomUUID(), termId = randomUUID(), scopeId = randomUUID(), enrollmentId = randomUUID();
    await client.begin(async tx => {
      await tx.unsafe('INSERT INTO ' + table('academic_sessions') + " (id,school_id,label,starts_on,ends_on) VALUES ($1,$2,'Fixture session','2026-01-01','2026-12-31')", [sessionId, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('terms') + " (id,school_id,session_id,name,starts_on,ends_on) VALUES ($1,$2,$3,'Fixture term','2026-01-01','2026-04-30')", [termId, ids.school, sessionId]);
      await tx.unsafe('INSERT INTO ' + table('assessment_scopes') + ' (id,school_id,class_id,session_id,term_id) VALUES ($1,$2,$3,$4,$5)', [scopeId, ids.school, ids.class, sessionId, termId]);
    });
    const revision = async () => (await client.unsafe('SELECT revision FROM ' + table('assessment_scopes') + ' WHERE id=$1', [scopeId]))[0].revision;
    const startRevision = await revision();
    await client.begin(async tx => {
      await tx.unsafe('INSERT INTO ' + table('enrollments') + ' (id,school_id,student_id,class_id,session_id) VALUES ($1,$2,$3,$4,$5)', [enrollmentId, ids.school, ids.student, ids.class, sessionId]);
      const school = await tx.unsafe('UPDATE ' + table('schools') + " SET name='Changed fixture school' WHERE id=$1 RETURNING name", [ids.school]);
      const changedClass = await tx.unsafe('UPDATE ' + table('classes') + " SET name='Changed fixture class' WHERE id=$1 RETURNING name", [ids.class]);
      assert.equal(school[0]?.name, 'Changed fixture school'); assert.equal(changedClass[0]?.name, 'Changed fixture class');
    });
    assert.equal(await revision(), startRevision + 1);
    const claims = (await client.unsafe('SELECT transaction_id,scope_id FROM ' + table('fixture_source_write_claims') + ' ORDER BY transaction_id,scope_id')).map(r => ({ ...r }));
    await assert.rejects(client.begin(async tx => {
      await tx.unsafe('DELETE FROM ' + table('enrollments') + ' WHERE id=$1', [enrollmentId]);
      await tx.unsafe('UPDATE ' + table('schools') + " SET name='Rolled-back fixture name' WHERE id=$1", [ids.school]);
      throw inject;
    }), error => error === inject);
    assert.equal(await revision(), startRevision + 1);
    assert.deepEqual((await client.unsafe('SELECT transaction_id,scope_id FROM ' + table('fixture_source_write_claims') + ' ORDER BY transaction_id,scope_id')).map(r => ({ ...r })), claims);
    assert.equal((await client.unsafe('SELECT id FROM ' + table('enrollments') + ' WHERE id=$1', [enrollmentId])).length, 1);
    assert.equal((await client.unsafe('SELECT name FROM ' + table('schools') + ' WHERE id=$1', [ids.school]))[0].name, 'Changed fixture school');
    const unusedLevel = randomUUID();
    await client.unsafe('INSERT INTO ' + table('academic_levels') + " (id,school_id,name,stage,progression_order) VALUES ($1,$2,'Unused fixture level','nursery',99)", [unusedLevel, ids.school]);
    assert.equal((await client.unsafe('DELETE FROM ' + table('academic_levels') + ' WHERE id=$1 RETURNING id', [unusedLevel])).length, 1);
    assert.equal((await client.unsafe('SELECT id FROM ' + table('academic_levels') + ' WHERE id=$1', [unusedLevel])).length, 0);
    console.log('PASS: upgraded parent updates/deletes take effect, invalidate once per transaction and roll back rows and revision claims on failure');

    const userId = randomUUID(), memberId = randomUUID(), auditId = randomUUID(), levelId = randomUUID(), configId = randomUUID();
    await client.begin(async tx => {
      await tx.unsafe('INSERT INTO ' + table('school_users') + " (id,auth_user_id,display_name) VALUES ($1,$2,'Fixture administrator')", [userId, randomUUID()]);
      await tx.unsafe('INSERT INTO ' + table('memberships') + " (id,school_id,user_id,role) VALUES ($1,$2,$3,'admin')", [memberId, ids.school, userId]);
      await tx.unsafe('INSERT INTO ' + table('assessment_audit') + " (id,school_id,scope_id,actor_membership_id,action,before_revision,after_revision) VALUES ($1,$2,$3,$4,'fixture',1,1)", [auditId, ids.school, scopeId, memberId]);
      await tx.unsafe('INSERT INTO ' + table('academic_levels') + " (id,school_id,name,stage,primary_year,progression_order) VALUES ($1,$2,'Fixture Primary 1','primary',1,1)", [levelId, ids.school]);
      await tx.unsafe('INSERT INTO ' + table('assessment_config_versions') + ` (id,school_id,config_key,revision,level_id,session_id,term_id,mode,state,components,grading)
        VALUES ($1,$2,$3,1,$4,$5,$6,'numeric','finalized','[{}]'::jsonb,'{}'::jsonb)`, [configId, ids.school, randomUUID(), levelId, sessionId, termId]);
    });
    const denied = callback => assert.rejects(client.begin(callback), error => error.code === 'P0001');
    for (const name of guardPlan.immutable) {
      await denied(tx => tx.unsafe('UPDATE ' + table(name) + ' SET id=id WHERE false'));
      await denied(tx => tx.unsafe('DELETE FROM ' + table(name) + ' WHERE false'));
      await denied(tx => tx.unsafe('TRUNCATE ' + table(name) + ' CASCADE'));
    }
    await denied(tx => tx.unsafe('UPDATE ' + table('assessment_audit') + " SET action='changed' WHERE id=$1", [auditId]));
    await denied(tx => tx.unsafe('UPDATE ' + table('assessment_config_versions') + " SET state='draft' WHERE id=$1", [configId]));
    await denied(tx => tx.unsafe('DELETE FROM ' + table('assessment_config_versions') + ' WHERE id=$1', [configId]));
    await denied(tx => tx.unsafe('TRUNCATE ' + table('report_card_releases') + ' CASCADE'));
    assert.equal((await client.unsafe('SELECT action FROM ' + table('assessment_audit') + ' WHERE id=$1', [auditId]))[0].action, 'fixture');
    assert.equal((await client.unsafe('SELECT state FROM ' + table('assessment_config_versions') + ' WHERE id=$1', [configId]))[0].state, 'finalized');
    console.log('PASS: upgraded history denies zero-row and populated mutations, finalized configuration changes and release truncation');

    let releaseRead, readyRead;
    const ready = new Promise(resolve => { readyRead = resolve; });
    const hold = new Promise(resolve => { releaseRead = resolve; });
    const holder = client.begin(async tx => { await tx.unsafe(guardPlan.readGate); readyRead(); await hold; });
    try {
      await awaitFixtureAuthorityLock(holder, ready);
      for (const name of ['schools', 'school_users', 'memberships']) {
        await assert.rejects(client.begin(async tx => {
          await tx.unsafe("SET LOCAL lock_timeout='200ms'");
          await tx.unsafe('UPDATE ' + table(name) + ' SET id=id WHERE false');
        }), error => error.code === '55P03');
      }
    } finally { releaseRead(); await holder; }
    await client.begin(tx => tx.unsafe('UPDATE ' + table('school_users') + ' SET id=id WHERE false'));
    console.log('PASS: upgraded shared source gate blocks zero-row authority writes before discovery and releases after the reader ends');
    if (process.env.REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM === 'DISPOSABLE_ROLE_ADMIN_TEST_ONLY') {
      const authorityReview = await readFile(new URL('../docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql', import.meta.url), 'utf8');
      await probeUpgradeSecurity(client, schema, ids.school, userId, authorityReview);
      await probeUpgradeLogin(client, url, schema, ids.school, userId, memberId, authorityReview, () => { securityCommitted = true; });
    } else console.log('SKIPPED: nine upgraded security/LOGIN groups require the explicit disposable role-admin confirmation.');
    throw cleanupProbe;
  } catch (error) { if (error !== cleanupProbe) failure = error; }
  finally {
    try {
      if (created) {
        upgradeFixtureSchema(schema);
        const cleanup = upgradeLoginCleanupPlan(schema, decodeURIComponent(parsed.pathname.slice(1)), securityCommitted);
        await client.begin(async tx => { for (const statement of cleanup.statements) await tx.unsafe(statement); });
        const remaining = await client.unsafe('SELECT nspname FROM pg_catalog.pg_namespace WHERE nspname=$1', [schema]);
        assert.equal(remaining.length, 0, 'Generated upgrade schema remains after cleanup');
        const roles = await client.unsafe('SELECT rolname FROM pg_catalog.pg_roles WHERE rolname IN ($1::text,$2::text,$3::text,$4::text)', cleanup.roles);
        assert.equal(roles.length, 0, 'Generated upgrade roles remain after cleanup');
      }
    } catch (cleanupError) { failure = failure ? new AggregateError([failure, cleanupError], 'Upgrade rehearsal and cleanup failed') : cleanupError; }
    finally { await client.end(); }
  }
  if (failure) throw failure;
  console.log('PASS: exact generated upgrade schema and acknowledged security roles are removed after intentional workload failure');
}
