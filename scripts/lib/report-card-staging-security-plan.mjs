// SQL review fragment only. No driver, environment, connection or execution.
const base = ['schools', 'school_users', 'memberships', 'academic_sessions', 'terms', 'academic_levels', 'academic_sections', 'classes', 'students', 'enrollments', 'teacher_class_assignments'];
const academic = ['assessment_subjects', 'assessment_config_versions', 'assessment_scopes', 'assessment_subject_roster', 'assessment_teacher_subjects', 'assessment_scores', 'assessment_source_versions', 'assessment_teacher_reviews', 'assessment_finalizations', 'assessment_audit', 'assessment_operation_receipts'];
const reports = ['report_cards', 'report_card_snapshots', 'report_card_audit', 'report_card_operation_receipts', 'report_card_releases'];
const updates = ['stage', 'version', 'submitted_by', 'approved_by', 'published_at', 'return_reason', 'assessment_source_version_id', 'assessment_revision'];
const table = name => 'public."' + name + '"';
const runtime = 'greenfield_report_card_runtime', login = 'greenfield_app';

export function stagingReportSecurityPlan(config) {
  if (!config || config.mode !== 'isolated-staging-review' || config.schema !== 'public' ||
    typeof config.schoolId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(config.schoolId) ||
    typeof config.sourceCommit !== 'string' || !/^[a-f0-9]{40}$/.test(config.sourceCommit)) throw Error('Explicit staging school and source revision required');
  const schoolId = config.schoolId.toLowerCase(), school = "'" + schoolId + "'::uuid";
  const targets = [...base, ...academic, ...reports, 'assessment_source_write_gate'];
  const scope = name => name === 'schools' ? 'id=' + school
    : name === 'school_users' ? 'EXISTS(SELECT 1 FROM public.memberships m WHERE m.user_id="school_users".id AND m.school_id=' + school + ')'
      : name === 'assessment_source_write_gate' ? 'id=1' : 'school_id=' + school;
  const statements = [
    'GRANT USAGE ON SCHEMA public TO ' + runtime,
    `CREATE FUNCTION public.report_card_restrict_runtime_writes() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_SCHEMA<>'public' THEN RAISE EXCEPTION 'unexpected report runtime schema'; END IF;
 IF current_user='greenfield_report_card_runtime' THEN
  IF TG_TABLE_NAME='report_cards' AND TG_OP IN ('INSERT','UPDATE') THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME='report_card_releases' AND TG_OP='UPDATE' THEN RETURN NULL; END IF;
  IF TG_TABLE_NAME IN ('report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases') AND TG_OP='INSERT' THEN RETURN NULL; END IF;
  RAISE EXCEPTION 'report runtime cannot mutate academic or immutable rows' USING ERRCODE='42501';
 ELSIF current_user IN ('greenfield_app','anon','authenticated') AND TG_TABLE_NAME IN ('report_cards','report_card_snapshots','report_card_audit','report_card_operation_receipts','report_card_releases') THEN
  RAISE EXCEPTION 'explicit report runtime role required' USING ERRCODE='42501';
 END IF;
 RETURN NULL;
END $$`,
    'REVOKE ALL ON FUNCTION public.report_card_restrict_runtime_writes() FROM PUBLIC,anon,authenticated,' + login + ',' + runtime,
  ];
  for (const name of targets) {
    const target = table(name), predicate = scope(name);
    // Dedicated report-role privileges only. Preserve existing module/API ACLs.
    statements.push('REVOKE ALL ON TABLE ' + target + ' FROM ' + runtime,
      'ALTER TABLE ' + target + ' ENABLE ROW LEVEL SECURITY', 'ALTER TABLE ' + target + ' FORCE ROW LEVEL SECURITY',
      'CREATE POLICY report_card_fixed_school ON ' + target + ' AS RESTRICTIVE FOR ALL TO ' + login + ',' + runtime + ' USING (' + predicate + ') WITH CHECK (' + predicate + ')',
      'CREATE POLICY report_card_runtime_read ON ' + target + ' FOR SELECT TO ' + runtime + ' USING (' + predicate + ')',
      'CREATE POLICY report_card_runtime_lock ON ' + target + ' FOR UPDATE TO ' + runtime + ' USING (' + predicate + ') WITH CHECK (false)',
      'GRANT SELECT ON ' + target + ' TO ' + runtime,
      'CREATE TRIGGER aaa_report_card_runtime_write_guard BEFORE INSERT OR UPDATE OR DELETE ON ' + target + ' FOR EACH STATEMENT EXECUTE FUNCTION public.report_card_restrict_runtime_writes()',
      'CREATE TRIGGER aaa_report_card_runtime_truncate_guard BEFORE TRUNCATE ON ' + target + ' FOR EACH STATEMENT EXECUTE FUNCTION public.report_card_restrict_runtime_writes()');
    if (name !== 'report_cards' && name !== 'report_card_releases') statements.push('GRANT UPDATE (id) ON ' + target + ' TO ' + runtime);
    if (name !== 'assessment_source_write_gate') statements.push('CREATE POLICY report_card_policy_setup_operator ON ' + target + ' FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true)');
  }
  for (const name of reports) statements.push('GRANT INSERT ON ' + table(name) + ' TO ' + runtime,
    'CREATE POLICY report_card_runtime_insert ON ' + table(name) + ' FOR INSERT TO ' + runtime + ' WITH CHECK (school_id=' + school + ')');
  statements.push('GRANT UPDATE (' + updates.join(',') + ') ON public.report_cards TO ' + runtime,
    'CREATE POLICY report_card_runtime_transition ON public.report_cards FOR UPDATE TO ' + runtime + ' USING (school_id=' + school + ') WITH CHECK (school_id=' + school + ')',
    'GRANT UPDATE (revoked_at) ON public.report_card_releases TO ' + runtime,
    'CREATE POLICY report_card_runtime_revoke ON public.report_card_releases FOR UPDATE TO ' + runtime + ' USING (school_id=' + school + ') WITH CHECK (school_id=' + school + ' AND revoked_at IS NOT NULL)',
    'REVOKE ALL ON FUNCTION public.lock_report_card_actor(uuid) FROM PUBLIC,anon,authenticated,' + login,
    'GRANT EXECUTE ON FUNCTION public.lock_report_card_actor(uuid) TO ' + runtime,
    'GRANT ' + runtime + ' TO ' + login + ' WITH SET TRUE',
    'GRANT ' + runtime + ' TO ' + login + ' WITH INHERIT FALSE',
    'GRANT ' + runtime + ' TO ' + login + ' WITH ADMIN FALSE');
  return Object.freeze({ mode: config.mode, schema: 'public', schoolId, sourceCommit: config.sourceCommit,
    targets: Object.freeze(targets), reportUpdates: Object.freeze([...updates]), statements: Object.freeze(statements),
    requiresEffectivePrivilegeAudit: true });
}
