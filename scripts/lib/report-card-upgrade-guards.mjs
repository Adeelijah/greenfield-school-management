// Fixture-only guard composition for a structurally upgraded generated schema.
// No roles, RLS, grants, connection or claims of authenticated authorization.
import { assessmentWriteGuardDDL } from './assessment-disposable-write-guards.mjs';
import { assessmentAuthorityGuardDDL } from './assessment-disposable-authority-guards.mjs';
import { reportReleaseGuardDDL } from './report-release-disposable-guards.mjs';
import { upgradeFixtureSchema } from './report-card-upgrade-plan.mjs';

export function reportUpgradeGuardPlan(schema) {
  const q = upgradeFixtureSchema(schema), table = name => q + '."' + name + '"';
  const source = assessmentWriteGuardDDL(schema), parents = assessmentAuthorityGuardDDL(schema);
  const immutable = ['assessment_source_versions', 'assessment_teacher_reviews', 'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts', 'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts'];
  const history = [`CREATE FUNCTION ${table('fixture_upgrade_reject_history')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN RAISE EXCEPTION 'upgrade fixture history is immutable' USING ERRCODE='P0001'; RETURN NULL; END $$`];
  for (const name of immutable) {
    history.push('CREATE TRIGGER fixture_upgrade_history_write BEFORE UPDATE OR DELETE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_upgrade_reject_history') + '()');
    history.push('CREATE TRIGGER fixture_upgrade_history_truncate BEFORE TRUNCATE ON ' + table(name) + ' FOR EACH STATEMENT EXECUTE FUNCTION ' + table('fixture_upgrade_reject_history') + '()');
  }
  history.push('CREATE TRIGGER fixture_upgrade_final_config BEFORE UPDATE OR DELETE ON ' + table('assessment_config_versions') + " FOR EACH ROW WHEN (OLD.state='finalized') EXECUTE FUNCTION " + table('fixture_upgrade_reject_history') + '()');
  const privateFunctions = ['fixture_lock_source_write()', 'fixture_mark_source_scope(uuid)', 'fixture_invalidate_source_rows()', 'fixture_reject_source_truncate()', 'fixture_invalidate_parent_rows()', 'fixture_upgrade_reject_history()', 'fixture_guard_release_history()'];
  const revoke = privateFunctions.map(signature => {
    const [name, args] = signature.split('(');
    return 'REVOKE ALL ON FUNCTION ' + table(name) + '(' + args + ' FROM PUBLIC';
  });
  return {
    statements: [...source.statements, ...parents.statements, ...history, ...reportReleaseGuardDDL(schema).statements, ...revoke],
    immutable, sourceTargets: source.targets, authorityTargets: parents.targets, readGate: source.readGate,
  };
}
