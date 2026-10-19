// Review-only release history guards for generated disposable schemas.
export function reportReleaseGuardDDL(schema) {
 if(!/^rc_it_[a-f0-9]{16}$/.test(schema))throw Error('Only generated disposable fixture schemas allowed.');
 const table=name=>'"'+schema+'"."'+name+'"';
 return {statements:[
  `CREATE FUNCTION ${table('fixture_guard_release_history')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF TG_TABLE_SCHEMA <> '${schema}' THEN RAISE EXCEPTION 'invalid fixture release schema'; END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'new release must be active' USING ERRCODE='23514'; END IF;
 ELSIF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at') THEN
   RAISE EXCEPTION 'original publication facts are immutable' USING ERRCODE='23514';
  END IF;
  IF OLD.revoked_at IS NOT NULL OR NEW.revoked_at IS NULL OR NEW.revoked_at<OLD.released_at THEN
   RAISE EXCEPTION 'revocation is a single monotonic transition' USING ERRCODE='23514';
  END IF;
 ELSE RAISE EXCEPTION 'release history cannot be deleted or truncated' USING ERRCODE='P0001';
 END IF;
 RETURN NEW;
END $$`,
  'CREATE TRIGGER fixture_release_history BEFORE INSERT OR UPDATE ON '+table('report_card_releases')+' FOR EACH ROW EXECUTE FUNCTION '+table('fixture_guard_release_history')+'()',
  'CREATE TRIGGER fixture_release_no_delete BEFORE DELETE ON '+table('report_card_releases')+' FOR EACH STATEMENT EXECUTE FUNCTION '+table('fixture_guard_release_history')+'()',
  'CREATE TRIGGER fixture_release_no_truncate BEFORE TRUNCATE ON '+table('report_card_releases')+' FOR EACH STATEMENT EXECUTE FUNCTION '+table('fixture_guard_release_history')+'()',
 ]};
}
