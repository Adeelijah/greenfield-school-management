// Fixture-only durable attendance candidate. Never accepts public/staging schemas.
export function attendanceFixtureNames(schema) {
  if (typeof schema !== 'string' || !/^at_it_[a-f0-9]{16}$/.test(schema)) throw Error('Generated attendance fixture required');
  return { schema, owner: schema + '_owner', worker: schema + '_worker' };
}
export function attendanceFixturePlan(schema) {
  const names = attendanceFixtureNames(schema), q = '"' + schema + '"';
  const t = name => q + '."' + name + '"';
  const prerequisites = [
    `CREATE TABLE ${t('authority_gate')} (id integer PRIMARY KEY CHECK(id=1))`,
    `INSERT INTO ${t('authority_gate')} VALUES(1)`,
    `CREATE TABLE ${t('schools')} (id uuid PRIMARY KEY)`,
    `CREATE TABLE ${t('school_users')} (id uuid PRIMARY KEY, auth_user_id uuid NOT NULL UNIQUE)`,
    `CREATE TABLE ${t('memberships')} (id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES ${t('schools')}, user_id uuid NOT NULL REFERENCES ${t('school_users')}, role text NOT NULL CHECK(role IN ('admin','teacher','bursar')), status text NOT NULL CHECK(status IN ('active','suspended')), UNIQUE(school_id,id))`,
    `CREATE TABLE ${t('classes')} (id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES ${t('schools')}, class_key text NOT NULL CHECK(class_key IN ('primary5','creche')), UNIQUE(school_id,id), UNIQUE(school_id,class_key))`,
    `CREATE TABLE ${t('academic_sessions')} (id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES ${t('schools')}, starts_on date NOT NULL, ends_on date NOT NULL CHECK(ends_on>=starts_on), is_current boolean NOT NULL, UNIQUE(school_id,id))`,
    `CREATE TABLE ${t('students')} (id uuid PRIMARY KEY, school_id uuid NOT NULL REFERENCES ${t('schools')}, status text NOT NULL CHECK(status IN ('active','withdrawn','graduated')), UNIQUE(school_id,id))`,
    `CREATE TABLE ${t('enrollments')} (id uuid PRIMARY KEY, school_id uuid NOT NULL, student_id uuid NOT NULL, class_id uuid NOT NULL, session_id uuid NOT NULL, status text NOT NULL CHECK(status IN ('active','withdrawn','graduated')), FOREIGN KEY(school_id,student_id) REFERENCES ${t('students')}(school_id,id), FOREIGN KEY(school_id,class_id) REFERENCES ${t('classes')}(school_id,id), FOREIGN KEY(school_id,session_id) REFERENCES ${t('academic_sessions')}(school_id,id), UNIQUE(school_id,id,student_id,class_id,session_id))`,
    `CREATE TABLE ${t('teacher_class_assignments')} (id uuid PRIMARY KEY, school_id uuid NOT NULL, teacher_membership_id uuid NOT NULL, class_id uuid NOT NULL, session_id uuid NOT NULL, ended_at timestamptz, FOREIGN KEY(school_id,teacher_membership_id) REFERENCES ${t('memberships')}(school_id,id), FOREIGN KEY(school_id,class_id) REFERENCES ${t('classes')}(school_id,id), FOREIGN KEY(school_id,session_id) REFERENCES ${t('academic_sessions')}(school_id,id))`,
  ];
  const tables = [
    `CREATE TABLE ${t('attendance_registers')} (id uuid PRIMARY KEY, school_id uuid NOT NULL, class_id uuid NOT NULL, session_id uuid NOT NULL, register_date date NOT NULL, version integer NOT NULL CHECK(version>0), FOREIGN KEY(school_id,class_id) REFERENCES ${t('classes')}(school_id,id), FOREIGN KEY(school_id,session_id) REFERENCES ${t('academic_sessions')}(school_id,id), UNIQUE(school_id,class_id,session_id,register_date), UNIQUE(school_id,id,class_id,session_id,register_date))`,
    `CREATE TABLE ${t('attendance_marks')} (school_id uuid NOT NULL, register_id uuid NOT NULL, student_id uuid NOT NULL, enrollment_id uuid NOT NULL, class_id uuid NOT NULL, session_id uuid NOT NULL, register_date date NOT NULL, status text NOT NULL CHECK(status IN ('present','absent','late','excused')), PRIMARY KEY(school_id,register_id,student_id), UNIQUE(school_id,student_id,register_date), FOREIGN KEY(school_id,register_id,class_id,session_id,register_date) REFERENCES ${t('attendance_registers')}(school_id,id,class_id,session_id,register_date), FOREIGN KEY(school_id,enrollment_id,student_id,class_id,session_id) REFERENCES ${t('enrollments')}(school_id,id,student_id,class_id,session_id))`,
    `CREATE TABLE ${t('attendance_audit')} (id uuid PRIMARY KEY, school_id uuid NOT NULL, register_id uuid NOT NULL, class_id uuid NOT NULL, session_id uuid NOT NULL, register_date date NOT NULL, actor_id uuid NOT NULL, version integer NOT NULL CHECK(version>0), reason text, marks jsonb NOT NULL CHECK(jsonb_typeof(marks)='object'), created_at timestamptz NOT NULL DEFAULT clock_timestamp(), CHECK((version=1 AND reason IS NULL) OR (version>1 AND reason IS NOT NULL AND length(btrim(reason)) BETWEEN 1 AND 2000)), FOREIGN KEY(school_id,actor_id) REFERENCES ${t('memberships')}(school_id,id), FOREIGN KEY(school_id,register_id,class_id,session_id,register_date) REFERENCES ${t('attendance_registers')}(school_id,id,class_id,session_id,register_date), UNIQUE(school_id,register_id,version), UNIQUE(school_id,id,actor_id,version))`,
    `CREATE TABLE ${t('attendance_receipts')} (school_id uuid NOT NULL, actor_id uuid NOT NULL, operation_key text NOT NULL CHECK(operation_key ~ '^[A-Za-z0-9:_-]{8,120}$'), command jsonb NOT NULL CHECK(jsonb_typeof(command)='object'), audit_id uuid NOT NULL, version integer NOT NULL, PRIMARY KEY(school_id,actor_id,operation_key), FOREIGN KEY(school_id,audit_id,actor_id,version) REFERENCES ${t('attendance_audit')}(school_id,id,actor_id,version))`,
  ];
  const functions = [
    `CREATE FUNCTION ${t('lock_attendance_parents')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $f$ BEGIN PERFORM id FROM ${t('authority_gate')} WHERE id=1 FOR UPDATE; RETURN NULL; END $f$`,
    `CREATE FUNCTION ${t('deny_attendance_history_change')}() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog AS $f$ BEGIN RAISE EXCEPTION 'Attendance history is immutable' USING ERRCODE='42501'; END $f$`,
    `CREATE FUNCTION ${t('save_attendance')}(verified_auth uuid, cmd jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $f$
DECLARE actor record; klass record; sess record; reg record; prior record; day date; expected integer; n integer; audit_uuid uuid; register_uuid uuid; marks jsonb; canonical jsonb;
BEGIN
 -- Trusted fixture server passes verified_auth; never expose this UUID-taking API through PostgREST.
 -- A single exclusive fixture gate serializes register and authority discovery, including empty writes.
 PERFORM id FROM ${t('authority_gate')} WHERE id=1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Missing attendance gate'; END IF;
 IF cmd IS NULL OR jsonb_typeof(cmd)<>'object' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF (SELECT count(*) FROM jsonb_object_keys(cmd))<>7 OR NOT (cmd ?& ARRAY['action','classKey','date','expectedVersion','operationKey','reason','marks'])
 OR cmd->>'action'<>'save_register' OR cmd->>'classKey' NOT IN ('primary5','creche')
 OR jsonb_typeof(cmd->'action')<>'string' OR jsonb_typeof(cmd->'classKey')<>'string'
 OR jsonb_typeof(cmd->'date')<>'string' OR cmd->>'date' !~ '^\\d{4}-\\d{2}-\\d{2}$'
 OR jsonb_typeof(cmd->'expectedVersion')<>'number' OR cmd->>'expectedVersion' !~ '^(0|[1-9][0-9]{0,9})$'
 OR (cmd->>'expectedVersion')::numeric>=2147483647
 OR jsonb_typeof(cmd->'operationKey')<>'string' OR cmd->>'operationKey' !~ '^[A-Za-z0-9:_-]{8,120}$'
 OR jsonb_typeof(cmd->'marks')<>'object' THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 expected:=(cmd->>'expectedVersion')::integer; marks:=cmd->'marks';
 IF (expected=0 AND cmd->'reason'<>'null'::jsonb) OR (expected>0 AND (jsonb_typeof(cmd->'reason')<>'string' OR length(btrim(cmd->>'reason')) NOT BETWEEN 1 AND 2000)) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 BEGIN day:=(cmd->>'date')::date; EXCEPTION WHEN datetime_field_overflow OR invalid_datetime_format THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END;
 IF to_char(day,'YYYY-MM-DD')<>cmd->>'date' OR day>(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Lagos')::date THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_each(marks)) OR EXISTS(SELECT 1 FROM jsonb_each(marks) e WHERE e.key !~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' OR jsonb_typeof(e.value)<>'string' OR e.value#>>'{}' NOT IN ('present','absent','late','excused')) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 -- Complete membership set is visible to the private fixture owner, without client school scope.
 IF (SELECT count(*) FROM ${t('school_users')} WHERE auth_user_id=verified_auth)<>1 OR (SELECT count(*) FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active')<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT m.* INTO actor FROM ${t('memberships')} m JOIN ${t('school_users')} u ON u.id=m.user_id WHERE u.auth_user_id=verified_auth AND m.status='active';
 IF actor.role NOT IN ('admin','teacher') THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 SELECT * INTO klass FROM ${t('classes')} WHERE school_id=actor.school_id AND class_key=cmd->>'classKey';
 IF NOT FOUND THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 IF (SELECT count(*) FROM ${t('academic_sessions')} WHERE school_id=actor.school_id AND is_current)<>1 THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 SELECT * INTO sess FROM ${t('academic_sessions')} WHERE school_id=actor.school_id AND is_current;
 IF day NOT BETWEEN sess.starts_on AND sess.ends_on THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 IF actor.role='teacher' AND (SELECT count(*) FROM ${t('teacher_class_assignments')} WHERE school_id=actor.school_id AND teacher_membership_id=actor.id AND class_id=klass.id AND session_id=sess.id AND ended_at IS NULL)<>1 THEN RETURN '{"ok":false,"code":"forbidden"}'::jsonb; END IF;
 canonical:=cmd || jsonb_build_object('reason',CASE WHEN expected=0 THEN NULL ELSE btrim(cmd->>'reason') END);
 SELECT * INTO prior FROM ${t('attendance_receipts')} WHERE school_id=actor.school_id AND actor_id=actor.id AND operation_key=cmd->>'operationKey';
 IF FOUND THEN IF prior.command=canonical THEN RETURN jsonb_build_object('ok',true,'kind','replay','version',prior.version); ELSE RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF; END IF;
 -- Historical replay above needs current authority, but does not rewrite the old roster.
 SELECT count(*) INTO n FROM ${t('enrollments')} e JOIN ${t('students')} s ON s.school_id=e.school_id AND s.id=e.student_id AND s.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sess.id AND e.status='active';
 IF n=0 OR n<>(SELECT count(*) FROM jsonb_object_keys(marks)) OR n<>(SELECT count(DISTINCT e.student_id) FROM ${t('enrollments')} e JOIN ${t('students')} s ON s.school_id=e.school_id AND s.id=e.student_id AND s.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sess.id AND e.status='active')
 OR EXISTS(SELECT 1 FROM ${t('enrollments')} e JOIN ${t('students')} s ON s.school_id=e.school_id AND s.id=e.student_id AND s.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sess.id AND e.status='active' AND (NOT marks ? e.student_id::text OR (SELECT count(*) FROM ${t('enrollments')} x WHERE x.school_id=e.school_id AND x.student_id=e.student_id AND x.session_id=e.session_id AND x.status='active')<>1)) THEN RETURN '{"ok":false,"code":"invalid"}'::jsonb; END IF;
 SELECT * INTO reg FROM ${t('attendance_registers')} WHERE school_id=actor.school_id AND class_id=klass.id AND session_id=sess.id AND register_date=day FOR UPDATE;
 IF (FOUND AND reg.version<>expected) OR (NOT FOUND AND expected<>0) THEN RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF;
 IF expected>0 AND (EXISTS(SELECT 1 FROM ${t('attendance_marks')} m WHERE m.school_id=actor.school_id AND m.register_id=reg.id AND NOT EXISTS(SELECT 1 FROM ${t('enrollments')} e WHERE e.school_id=m.school_id AND e.id=m.enrollment_id AND e.class_id=klass.id AND e.session_id=sess.id AND e.status='active' AND marks ? e.student_id::text)) OR (SELECT count(*) FROM ${t('attendance_marks')} WHERE school_id=actor.school_id AND register_id=reg.id)<>n) THEN RETURN '{"ok":false,"code":"conflict"}'::jsonb; END IF;
 register_uuid:=CASE WHEN expected=0 THEN gen_random_uuid() ELSE reg.id END;
 IF expected=0 THEN INSERT INTO ${t('attendance_registers')} VALUES(register_uuid,actor.school_id,klass.id,sess.id,day,1); ELSE UPDATE ${t('attendance_registers')} SET version=expected+1 WHERE id=register_uuid; END IF;
 INSERT INTO ${t('attendance_marks')}(school_id,register_id,student_id,enrollment_id,class_id,session_id,register_date,status)
 SELECT e.school_id,register_uuid,e.student_id,e.id,e.class_id,e.session_id,day,marks->>e.student_id::text FROM ${t('enrollments')} e JOIN ${t('students')} s ON s.school_id=e.school_id AND s.id=e.student_id AND s.status='active' WHERE e.school_id=actor.school_id AND e.class_id=klass.id AND e.session_id=sess.id AND e.status='active'
 ON CONFLICT(school_id,register_id,student_id) DO UPDATE SET status=EXCLUDED.status;
 audit_uuid:=gen_random_uuid();
 INSERT INTO ${t('attendance_audit')}(id,school_id,register_id,class_id,session_id,register_date,actor_id,version,reason,marks) VALUES(audit_uuid,actor.school_id,register_uuid,klass.id,sess.id,day,actor.id,expected+1,canonical->>'reason',marks);
 INSERT INTO ${t('attendance_receipts')} VALUES(actor.school_id,actor.id,cmd->>'operationKey',canonical,audit_uuid,expected+1);
 RETURN jsonb_build_object('ok',true,'kind','applied','version',expected+1);
END $f$`,
  ];
  const parents = ['schools','school_users','memberships','classes','academic_sessions','students','enrollments','teacher_class_assignments'];
  const guards = parents.flatMap(name => [
    `CREATE TRIGGER attendance_parent_gate BEFORE INSERT OR UPDATE OR DELETE ON ${t(name)} FOR EACH STATEMENT EXECUTE FUNCTION ${t('lock_attendance_parents')}()`,
    `CREATE TRIGGER attendance_parent_no_truncate BEFORE TRUNCATE ON ${t(name)} FOR EACH STATEMENT EXECUTE FUNCTION ${t('deny_attendance_history_change')}()`,
  ]);
  for (const name of ['attendance_audit','attendance_receipts']) guards.push(`CREATE TRIGGER attendance_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON ${t(name)} FOR EACH STATEMENT EXECUTE FUNCTION ${t('deny_attendance_history_change')}()`);
  for (const name of ['attendance_registers','attendance_marks']) guards.push(`CREATE TRIGGER attendance_no_delete BEFORE DELETE OR TRUNCATE ON ${t(name)} FOR EACH STATEMENT EXECUTE FUNCTION ${t('deny_attendance_history_change')}()`);
  const relations = ['authority_gate',...parents,'attendance_registers','attendance_marks','attendance_audit','attendance_receipts'];
  const security = [
    `REVOKE ALL ON ALL TABLES IN SCHEMA ${q} FROM PUBLIC`,
    `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${q} FROM PUBLIC`,
    ...relations.flatMap(name => [`ALTER TABLE ${t(name)} ENABLE ROW LEVEL SECURITY`,`ALTER TABLE ${t(name)} FORCE ROW LEVEL SECURITY`,`CREATE POLICY attendance_private_owner ON ${t(name)} TO "${names.owner}" USING(true) WITH CHECK(true)`]),
    `GRANT USAGE ON SCHEMA ${q} TO "${names.worker}"`,
    `GRANT EXECUTE ON FUNCTION ${t('save_attendance')}(uuid,jsonb) TO "${names.worker}"`,
  ];
  return { names, prerequisites, tables, functions, guards, security, relations, statements:[...prerequisites,...tables,...functions,...guards,...security] };
}
