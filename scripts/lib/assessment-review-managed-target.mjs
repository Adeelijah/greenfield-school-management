// Sanitized operator-provided fixed staging metadata; no account/pupil rows or credentials.
const target={
 "projectRef": "hweoqkbgmzycyznrbvng",
 "schoolId": "0c594571-74c5-46fe-a835-a9b217a3a199",
 "inspectionSearchPath": "\"\\$user\", public, extensions",
 "relations": [
  {
   "name": "academic_levels",
   "owner": "postgres"
  },
  {
   "name": "academic_sections",
   "owner": "postgres"
  },
  {
   "name": "academic_sessions",
   "owner": "postgres"
  },
  {
   "name": "assessment_audit",
   "owner": "postgres"
  },
  {
   "name": "assessment_config_versions",
   "owner": "postgres"
  },
  {
   "name": "assessment_finalizations",
   "owner": "postgres"
  },
  {
   "name": "assessment_operation_receipts",
   "owner": "postgres"
  },
  {
   "name": "assessment_scopes",
   "owner": "postgres"
  },
  {
   "name": "assessment_scores",
   "owner": "postgres"
  },
  {
   "name": "assessment_source_versions",
   "owner": "postgres"
  },
  {
   "name": "assessment_source_write_claims",
   "owner": "postgres"
  },
  {
   "name": "assessment_source_write_gate",
   "owner": "postgres"
  },
  {
   "name": "assessment_subject_roster",
   "owner": "postgres"
  },
  {
   "name": "assessment_subjects",
   "owner": "postgres"
  },
  {
   "name": "assessment_teacher_reviews",
   "owner": "postgres"
  },
  {
   "name": "assessment_teacher_subjects",
   "owner": "postgres"
  },
  {
   "name": "attendance_audit",
   "owner": "greenfield_attendance_owner"
  },
  {
   "name": "attendance_marks",
   "owner": "greenfield_attendance_owner"
  },
  {
   "name": "attendance_receipts",
   "owner": "greenfield_attendance_owner"
  },
  {
   "name": "attendance_registers",
   "owner": "greenfield_attendance_owner"
  },
  {
   "name": "classes",
   "owner": "postgres"
  },
  {
   "name": "enrollments",
   "owner": "postgres"
  },
  {
   "name": "memberships",
   "owner": "postgres"
  },
  {
   "name": "report_card_audit",
   "owner": "postgres"
  },
  {
   "name": "report_card_operation_receipts",
   "owner": "postgres"
  },
  {
   "name": "report_card_releases",
   "owner": "postgres"
  },
  {
   "name": "report_card_snapshots",
   "owner": "postgres"
  },
  {
   "name": "report_cards",
   "owner": "postgres"
  },
  {
   "name": "school_users",
   "owner": "postgres"
  },
  {
   "name": "schools",
   "owner": "postgres"
  },
  {
   "name": "students",
   "owner": "postgres"
  },
  {
   "name": "teacher_class_assignments",
   "owner": "postgres"
  },
  {
   "name": "terms",
   "owner": "postgres"
  }
 ],
 "helpers": [
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.assessment_invalidate_parent_rows()",
   "explicit_acl": [
    "postgres=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "9f9c9f4a098d50fdf7ea943457e939ca"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.assessment_invalidate_source_rows()",
   "explicit_acl": [
    "postgres=X/postgres",
    "greenfield_assessment_owner=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "fda8087300e0cb73b9ac19974669a0db"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.assessment_lock_source_write()",
   "explicit_acl": [
    "postgres=X/postgres",
    "greenfield_assessment_owner=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "f474d67cc137221a8ea6d2e55b4b75dc"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.assessment_mark_source_scope(uuid)",
   "explicit_acl": [
    "postgres=X/postgres",
    "greenfield_assessment_owner=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "aee02104c72620a877ef0dbfb327b8d3"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.assessment_reject_source_truncate()",
   "explicit_acl": [
    "postgres=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "521ce770f6372906b0ab1066ac42719e"
  },
  {
   "owner": "greenfield_attendance_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.deny_attendance_history_change()",
   "explicit_acl": [
    "greenfield_attendance_owner=X/greenfield_attendance_owner"
   ],
   "security_definer": false,
   "definition_change_marker": "ed629cb9c9c7ae3a6b6598107ed20ffb"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.lock_report_card_actor(uuid)",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner",
    "greenfield_report_card_runtime=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "8352578ccca06a7d0a39f448d5489d1c"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.lock_report_card_authority_write_gate()",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "b389844f5d1b040db8e12603ed8e2a93"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.lock_report_card_membership_actor_anchor()",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "a83eac04a771b4979e5a9983574dba3b"
  },
  {
   "owner": "greenfield_attendance_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.read_attendance(uuid,text,date)",
   "explicit_acl": [
    "greenfield_attendance_owner=X/greenfield_attendance_owner",
    "greenfield_attendance_runtime=X/greenfield_attendance_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "d631db19c84f5b455fde4b360dc23337"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.report_card_guard_release_history()",
   "explicit_acl": [
    "postgres=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "7c92dc3615dd730426481669ca8e72ff"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.report_card_reject_history()",
   "explicit_acl": [
    "postgres=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "e99e2ed786a746afba1c772d4c4dab80"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.report_card_request_auth_uid()",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": false,
   "definition_change_marker": "46d583b7ea30b81fa33b33b8c2833eb7"
  },
  {
   "owner": "postgres",
   "present": true,
   "settings": [
    "search_path=pg_catalog"
   ],
   "signature": "public.report_card_restrict_runtime_writes()",
   "explicit_acl": [
    "postgres=X/postgres"
   ],
   "security_definer": false,
   "definition_change_marker": "728ee1bab93b96d63d9f73637522d8a0"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.resolve_report_card_actor()",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner",
    "authenticated=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "9ec1ada02e0087dea08257d738ca986c"
  },
  {
   "owner": "greenfield_report_card_authority_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.resolve_staging_staff_account()",
   "explicit_acl": [
    "greenfield_report_card_authority_owner=X/greenfield_report_card_authority_owner",
    "authenticated=X/greenfield_report_card_authority_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "c2976268d2a3ae29413e0702eedcfed2"
  },
  {
   "owner": "greenfield_assessment_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.save_assessment_subject_scores(uuid,jsonb)",
   "explicit_acl": [
    "greenfield_assessment_owner=X/greenfield_assessment_owner",
    "greenfield_assessment_runtime=X/greenfield_assessment_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "cc38d7ad3286312f633f706e6fdb8cb5"
  },
  {
   "owner": "greenfield_attendance_owner",
   "present": true,
   "settings": [
    "search_path=pg_catalog",
    "row_security=on"
   ],
   "signature": "public.save_attendance(uuid,jsonb)",
   "explicit_acl": [
    "greenfield_attendance_owner=X/greenfield_attendance_owner",
    "greenfield_attendance_runtime=X/greenfield_attendance_owner"
   ],
   "security_definer": true,
   "definition_change_marker": "e812ffe6d7b7488a2c8c43ef1b678ae9"
  }
 ],
 "data": [
  {
   "rows": 8,
   "relation": "academic_levels",
   "change_marker": "45aca39b982b64844c33e7dd394dce2b"
  },
  {
   "rows": 8,
   "relation": "academic_sections",
   "change_marker": "fe9645c82d3f016f3a07ab13bc34a24f"
  },
  {
   "rows": 1,
   "relation": "academic_sessions",
   "change_marker": "55d96d8aae0fbe340d655d42bff7fb00"
  },
  {
   "rows": 0,
   "relation": "assessment_audit",
   "change_marker": "d41d8cd98f00b204e9800998ecf8427e"
  },
  {
   "rows": 2,
   "relation": "assessment_config_versions",
   "change_marker": "680add3aa207a7ec9aa65cb19a2d30ae"
  },
  {
   "rows": 3,
   "relation": "assessment_finalizations",
   "change_marker": "ebd14216e48d22eebabab54728d198ae"
  },
  {
   "rows": 0,
   "relation": "assessment_operation_receipts",
   "change_marker": "d41d8cd98f00b204e9800998ecf8427e"
  },
  {
   "rows": 2,
   "relation": "assessment_scopes",
   "change_marker": "c8b7822fde5fe5a25cfa4ee8683b5cd7"
  },
  {
   "rows": 13,
   "relation": "assessment_scores",
   "change_marker": "7962bd8f3e9e73e3f501e61b7158cf0d"
  },
  {
   "rows": 2,
   "relation": "assessment_source_versions",
   "change_marker": "d170308f485942f27d2d42bf90889141"
  },
  {
   "rows": 2,
   "relation": "assessment_source_write_claims",
   "change_marker": "acf08957b91940669921c65ca0907316"
  },
  {
   "rows": 3,
   "relation": "assessment_subject_roster",
   "change_marker": "8a0e5619a26d67c62647554d59333396"
  },
  {
   "rows": 3,
   "relation": "assessment_subjects",
   "change_marker": "1afe0bc269470f451300b75e10f136ee"
  },
  {
   "rows": 3,
   "relation": "assessment_teacher_reviews",
   "change_marker": "ca8f15ece4ad8b677ddf7ef9e25f491f"
  },
  {
   "rows": 3,
   "relation": "assessment_teacher_subjects",
   "change_marker": "df83493537df785324f28778572b2ea6"
  },
  {
   "rows": 8,
   "relation": "classes",
   "change_marker": "56cdc96adbb3cf0c93c5cc0875af3b3f"
  },
  {
   "rows": 4,
   "relation": "enrollments",
   "change_marker": "9444981f65c0f50c8eeac4d0902f215a"
  },
  {
   "rows": 3,
   "relation": "memberships",
   "change_marker": "ff53e7c7c52b4463fecd6fe497d5ea57"
  },
  {
   "rows": 8,
   "relation": "report_card_audit",
   "change_marker": "a1b938d2fe8648b3910ab0ac9bac7e75"
  },
  {
   "rows": 8,
   "relation": "report_card_operation_receipts",
   "change_marker": "1b1c36c791ba57d270f439880f6c952f"
  },
  {
   "rows": 2,
   "relation": "report_card_releases",
   "change_marker": "fbec029778a72f5263ef4e501a138605"
  },
  {
   "rows": 2,
   "relation": "report_card_snapshots",
   "change_marker": "bdd28859415206e44dd73b799a9c3827"
  },
  {
   "rows": 1,
   "relation": "report_cards",
   "change_marker": "3f03b91f0050e92e8c0a7474f5352eed"
  },
  {
   "rows": 3,
   "relation": "school_users",
   "change_marker": "4b74aa65b26f30bf4831dd4596b8c91b"
  },
  {
   "rows": 1,
   "relation": "schools",
   "change_marker": "57884edc8fdaaf0692d15d034bdf9dbb"
  },
  {
   "rows": 4,
   "relation": "students",
   "change_marker": "4961e1515dda3d965c66fd35e714de7c"
  },
  {
   "rows": 2,
   "relation": "teacher_class_assignments",
   "change_marker": "6ffc173be5166722f18b77e16ec67e20"
  },
  {
   "rows": 3,
   "relation": "terms",
   "change_marker": "12ab5da5baf823f48875991105e622dd"
  }
 ],
 "keys": [
  {
   "columns": [
    "school_id",
    "id"
   ],
   "present": true,
   "relation": "academic_sessions"
  },
  {
   "columns": [
    "school_id",
    "id"
   ],
   "present": true,
   "relation": "assessment_config_versions"
  },
  {
   "columns": [
    "school_id",
    "source_version_id",
    "roster_id"
   ],
   "present": true,
   "relation": "assessment_finalizations"
  },
  {
   "columns": [
    "school_id",
    "actor_membership_id",
    "operation_key"
   ],
   "present": true,
   "relation": "assessment_operation_receipts"
  },
  {
   "columns": [
    "school_id",
    "class_id",
    "session_id",
    "term_id"
   ],
   "present": true,
   "relation": "assessment_scopes"
  },
  {
   "columns": [
    "school_id",
    "roster_id",
    "enrollment_id",
    "component_key"
   ],
   "present": true,
   "relation": "assessment_scores"
  },
  {
   "columns": [
    "school_id",
    "id",
    "scope_id"
   ],
   "present": true,
   "relation": "assessment_source_versions"
  },
  {
   "columns": [
    "school_id",
    "scope_id",
    "revision"
   ],
   "present": true,
   "relation": "assessment_source_versions"
  },
  {
   "columns": [
    "transaction_id",
    "scope_id"
   ],
   "present": true,
   "relation": "assessment_source_write_claims"
  },
  {
   "columns": [
    "school_id",
    "id",
    "scope_id"
   ],
   "present": true,
   "relation": "assessment_subject_roster"
  },
  {
   "columns": [
    "school_id",
    "id",
    "config_version_id"
   ],
   "present": true,
   "relation": "assessment_subject_roster"
  },
  {
   "columns": [
    "school_id",
    "id",
    "scope_id",
    "roster_id",
    "source_version_id"
   ],
   "present": true,
   "relation": "assessment_teacher_reviews"
  },
  {
   "columns": [
    "school_id",
    "roster_id",
    "source_version_id",
    "reviewer_membership_id"
   ],
   "present": true,
   "relation": "assessment_teacher_reviews"
  },
  {
   "columns": [
    "school_id",
    "id"
   ],
   "present": true,
   "relation": "classes"
  },
  {
   "columns": [
    "school_id",
    "id",
    "student_id",
    "class_id",
    "session_id"
   ],
   "present": true,
   "relation": "enrollments"
  },
  {
   "columns": [
    "school_id",
    "id",
    "student_id"
   ],
   "present": true,
   "relation": "enrollments"
  },
  {
   "columns": [
    "school_id",
    "id"
   ],
   "present": true,
   "relation": "memberships"
  }
 ],
 "constraints": [
  {
   "conname": "as_audit_actor_fk",
   "contype": "f",
   "relation": "assessment_audit",
   "definition": "FOREIGN KEY (school_id, actor_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_audit_revision_step",
   "contype": "c",
   "relation": "assessment_audit",
   "definition": "CHECK (((before_revision > 0) AND ((after_revision = before_revision) OR (after_revision = (before_revision + 1))) AND (btrim((action)::text) <> ''::text)))",
   "convalidated": true
  },
  {
   "conname": "as_audit_scope_fk",
   "contype": "f",
   "relation": "assessment_audit",
   "definition": "FOREIGN KEY (school_id, scope_id) REFERENCES assessment_scopes(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_audit_pkey",
   "contype": "p",
   "relation": "assessment_audit",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_config_level_fk",
   "contype": "f",
   "relation": "assessment_config_versions",
   "definition": "FOREIGN KEY (school_id, level_id) REFERENCES academic_levels(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_config_payload_valid",
   "contype": "c",
   "relation": "assessment_config_versions",
   "definition": "CHECK (((revision > 0) AND (jsonb_typeof(components) = 'array'::text) AND (jsonb_array_length(components) > 0) AND (jsonb_typeof(grading) = 'object'::text)))",
   "convalidated": true
  },
  {
   "conname": "as_config_subject_fk",
   "contype": "f",
   "relation": "assessment_config_versions",
   "definition": "FOREIGN KEY (school_id, subject_id) REFERENCES assessment_subjects(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_config_term_fk",
   "contype": "f",
   "relation": "assessment_config_versions",
   "definition": "FOREIGN KEY (school_id, session_id, term_id) REFERENCES terms(school_id, session_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_config_versions_pkey",
   "contype": "p",
   "relation": "assessment_config_versions",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_finalization_actor_fk",
   "contype": "f",
   "relation": "assessment_finalizations",
   "definition": "FOREIGN KEY (school_id, finalized_by) REFERENCES memberships(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_finalization_exact_review_fk",
   "contype": "f",
   "relation": "assessment_finalizations",
   "definition": "FOREIGN KEY (school_id, teacher_review_id, scope_id, roster_id, source_version_id) REFERENCES assessment_teacher_reviews(school_id, id, scope_id, roster_id, source_version_id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_finalization_payload_valid",
   "contype": "c",
   "relation": "assessment_finalizations",
   "definition": "CHECK (((jsonb_typeof(results) = 'object'::text) AND ((content_hash)::text ~ '^[a-f0-9]{64}$'::text)))",
   "convalidated": true
  },
  {
   "conname": "assessment_finalizations_pkey",
   "contype": "p",
   "relation": "assessment_finalizations",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_receipt_actor_fk",
   "contype": "f",
   "relation": "assessment_operation_receipts",
   "definition": "FOREIGN KEY (school_id, actor_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_receipt_fields_valid",
   "contype": "c",
   "relation": "assessment_operation_receipts",
   "definition": "CHECK (((resulting_revision > 0) AND (btrim((operation_key)::text) <> ''::text) AND ((fingerprint)::text ~ '^[a-f0-9]{64}$'::text) AND (jsonb_typeof(outcome) = 'object'::text)))",
   "convalidated": true
  },
  {
   "conname": "as_receipt_scope_fk",
   "contype": "f",
   "relation": "assessment_operation_receipts",
   "definition": "FOREIGN KEY (school_id, scope_id) REFERENCES assessment_scopes(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_operation_receipts_pkey",
   "contype": "p",
   "relation": "assessment_operation_receipts",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_scope_class_fk",
   "contype": "f",
   "relation": "assessment_scopes",
   "definition": "FOREIGN KEY (school_id, class_id) REFERENCES classes(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_scope_revision_positive",
   "contype": "c",
   "relation": "assessment_scopes",
   "definition": "CHECK ((revision > 0))",
   "convalidated": true
  },
  {
   "conname": "as_scope_session_fk",
   "contype": "f",
   "relation": "assessment_scopes",
   "definition": "FOREIGN KEY (school_id, session_id) REFERENCES academic_sessions(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_scope_term_fk",
   "contype": "f",
   "relation": "assessment_scopes",
   "definition": "FOREIGN KEY (school_id, session_id, term_id) REFERENCES terms(school_id, session_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_scopes_pkey",
   "contype": "p",
   "relation": "assessment_scopes",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_score_actor_fk",
   "contype": "f",
   "relation": "assessment_scores",
   "definition": "FOREIGN KEY (school_id, updated_by) REFERENCES memberships(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_score_enrollment_student_fk",
   "contype": "f",
   "relation": "assessment_scores",
   "definition": "FOREIGN KEY (school_id, enrollment_id, student_id) REFERENCES enrollments(school_id, id, student_id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_score_roster_config_fk",
   "contype": "f",
   "relation": "assessment_scores",
   "definition": "FOREIGN KEY (school_id, roster_id, config_version_id) REFERENCES assessment_subject_roster(school_id, id, config_version_id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_score_value_valid",
   "contype": "c",
   "relation": "assessment_scores",
   "definition": "CHECK (((version > 0) AND (btrim((component_key)::text) <> ''::text) AND (((numeric_score IS NOT NULL) AND (numeric_score >= (0)::numeric) AND (numeric_score <> 'NaN'::numeric) AND (observation_key IS NULL)) OR ((numeric_score IS NULL) AND (observation_key IS NOT NULL) AND (btrim((observation_key)::text) <> ''::text)))))",
   "convalidated": true
  },
  {
   "conname": "assessment_scores_pkey",
   "contype": "p",
   "relation": "assessment_scores",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_source_payload_valid",
   "contype": "c",
   "relation": "assessment_source_versions",
   "definition": "CHECK (((revision > 0) AND (jsonb_typeof(source_manifest) = 'object'::text) AND ((content_hash)::text ~ '^[a-f0-9]{64}$'::text)))",
   "convalidated": true
  },
  {
   "conname": "as_source_scope_fk",
   "contype": "f",
   "relation": "assessment_source_versions",
   "definition": "FOREIGN KEY (school_id, scope_id) REFERENCES assessment_scopes(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_source_versions_pkey",
   "contype": "p",
   "relation": "assessment_source_versions",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "assessment_source_write_claims_pkey",
   "contype": "p",
   "relation": "assessment_source_write_claims",
   "definition": "PRIMARY KEY (transaction_id, scope_id)",
   "convalidated": true
  },
  {
   "conname": "assessment_source_write_gate_id_check",
   "contype": "c",
   "relation": "assessment_source_write_gate",
   "definition": "CHECK ((id = 1))",
   "convalidated": true
  },
  {
   "conname": "assessment_source_write_gate_pkey",
   "contype": "p",
   "relation": "assessment_source_write_gate",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_roster_config_fk",
   "contype": "f",
   "relation": "assessment_subject_roster",
   "definition": "FOREIGN KEY (school_id, config_version_id) REFERENCES assessment_config_versions(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_roster_scope_fk",
   "contype": "f",
   "relation": "assessment_subject_roster",
   "definition": "FOREIGN KEY (school_id, scope_id) REFERENCES assessment_scopes(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_roster_subject_fk",
   "contype": "f",
   "relation": "assessment_subject_roster",
   "definition": "FOREIGN KEY (school_id, subject_id) REFERENCES assessment_subjects(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_roster_version_positive",
   "contype": "c",
   "relation": "assessment_subject_roster",
   "definition": "CHECK ((roster_version > 0))",
   "convalidated": true
  },
  {
   "conname": "assessment_subject_roster_pkey",
   "contype": "p",
   "relation": "assessment_subject_roster",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  },
  {
   "conname": "as_review_actor_fk",
   "contype": "f",
   "relation": "assessment_teacher_reviews",
   "definition": "FOREIGN KEY (school_id, reviewer_membership_id) REFERENCES memberships(school_id, id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_review_roster_scope_fk",
   "contype": "f",
   "relation": "assessment_teacher_reviews",
   "definition": "FOREIGN KEY (school_id, roster_id, scope_id) REFERENCES assessment_subject_roster(school_id, id, scope_id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "as_review_source_scope_fk",
   "contype": "f",
   "relation": "assessment_teacher_reviews",
   "definition": "FOREIGN KEY (school_id, source_version_id, scope_id) REFERENCES assessment_source_versions(school_id, id, scope_id) ON DELETE RESTRICT",
   "convalidated": true
  },
  {
   "conname": "assessment_teacher_reviews_pkey",
   "contype": "p",
   "relation": "assessment_teacher_reviews",
   "definition": "PRIMARY KEY (id)",
   "convalidated": true
  }
 ],
 "selectedColumns": [
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "name",
   "type": "character varying(80)",
   "default": null,
   "ordinal": 3,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "stage",
   "type": "academic_stage",
   "default": null,
   "ordinal": 4,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "primary_year",
   "type": "integer",
   "default": null,
   "ordinal": 5,
   "relation": "academic_levels",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "progression_order",
   "type": "integer",
   "default": null,
   "ordinal": 6,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_active",
   "type": "boolean",
   "default": "true",
   "ordinal": 7,
   "relation": "academic_levels",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "level_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "name",
   "type": "character varying(40)",
   "default": null,
   "ordinal": 4,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "display_order",
   "type": "integer",
   "default": null,
   "ordinal": 5,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_active",
   "type": "boolean",
   "default": "true",
   "ordinal": 6,
   "relation": "academic_sections",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "label",
   "type": "character varying(24)",
   "default": null,
   "ordinal": 3,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "starts_on",
   "type": "date",
   "default": null,
   "ordinal": 4,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "ends_on",
   "type": "date",
   "default": null,
   "ordinal": 5,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_current",
   "type": "boolean",
   "default": "false",
   "ordinal": 6,
   "relation": "academic_sessions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "action",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "before_revision",
   "type": "integer",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "after_revision",
   "type": "integer",
   "default": null,
   "ordinal": 7,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "occurred_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 8,
   "relation": "assessment_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "config_key",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "revision",
   "type": "integer",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "level_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "term_id",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "subject_id",
   "type": "uuid",
   "default": null,
   "ordinal": 8,
   "relation": "assessment_config_versions",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "mode",
   "type": "assessment_mode",
   "default": null,
   "ordinal": 9,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "state",
   "type": "assessment_config_state",
   "default": "'draft'::assessment_config_state",
   "ordinal": 10,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "components",
   "type": "jsonb",
   "default": null,
   "ordinal": 11,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "grading",
   "type": "jsonb",
   "default": null,
   "ordinal": 12,
   "relation": "assessment_config_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "roster_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "source_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "teacher_review_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "finalized_by",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "results",
   "type": "jsonb",
   "default": null,
   "ordinal": 8,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "content_hash",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 9,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "finalized_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 10,
   "relation": "assessment_finalizations",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "operation_key",
   "type": "character varying(128)",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "fingerprint",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "resulting_revision",
   "type": "integer",
   "default": null,
   "ordinal": 7,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "outcome",
   "type": "jsonb",
   "default": null,
   "ordinal": 8,
   "relation": "assessment_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "term_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "revision",
   "type": "integer",
   "default": "1",
   "ordinal": 6,
   "relation": "assessment_scopes",
   "required": true,
   "explicit_acl": [
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "roster_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "config_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "enrollment_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "student_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "component_key",
   "type": "character varying(128)",
   "default": null,
   "ordinal": 7,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "numeric_score",
   "type": "numeric(12,4)",
   "default": null,
   "ordinal": 8,
   "relation": "assessment_scores",
   "required": false,
   "explicit_acl": [
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "observation_key",
   "type": "character varying(128)",
   "default": null,
   "ordinal": 9,
   "relation": "assessment_scores",
   "required": false,
   "explicit_acl": [
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "version",
   "type": "integer",
   "default": "1",
   "ordinal": 10,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": [
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "updated_by",
   "type": "uuid",
   "default": null,
   "ordinal": 11,
   "relation": "assessment_scores",
   "required": true,
   "explicit_acl": [
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "revision",
   "type": "integer",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "source_manifest",
   "type": "jsonb",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "content_hash",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 7,
   "relation": "assessment_source_versions",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "transaction_id",
   "type": "text",
   "default": null,
   "ordinal": 1,
   "relation": "assessment_source_write_claims",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_source_write_claims",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "integer",
   "default": null,
   "ordinal": 1,
   "relation": "assessment_source_write_gate",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_authority_owner=w/postgres",
    "greenfield_report_card_runtime=w/postgres",
    "greenfield_attendance_owner=w/postgres",
    "greenfield_assessment_owner=w/postgres"
   ]
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "subject_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "roster_version",
   "type": "integer",
   "default": "1",
   "ordinal": 5,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "config_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_active",
   "type": "boolean",
   "default": "true",
   "ordinal": 7,
   "relation": "assessment_subject_roster",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "code",
   "type": "character varying(40)",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "name",
   "type": "character varying(160)",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_active",
   "type": "boolean",
   "default": "true",
   "ordinal": 5,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "version",
   "type": "integer",
   "default": "1",
   "ordinal": 6,
   "relation": "assessment_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "roster_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "source_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "reviewer_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "reviewed_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 7,
   "relation": "assessment_teacher_reviews",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "assessment_teacher_subjects",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "assessment_teacher_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "roster_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "assessment_teacher_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_assignment_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "assessment_teacher_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_active",
   "type": "boolean",
   "default": "true",
   "ordinal": 5,
   "relation": "assessment_teacher_subjects",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": null,
   "ordinal": 1,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "register_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "register_date",
   "type": "date",
   "default": null,
   "ordinal": 6,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_id",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "version",
   "type": "integer",
   "default": null,
   "ordinal": 8,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "reason",
   "type": "text",
   "default": null,
   "ordinal": 9,
   "relation": "attendance_audit",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "marks",
   "type": "jsonb",
   "default": null,
   "ordinal": 10,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "clock_timestamp()",
   "ordinal": 11,
   "relation": "attendance_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 1,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "register_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "student_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "enrollment_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "register_date",
   "type": "date",
   "default": null,
   "ordinal": 7,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "status",
   "type": "text",
   "default": null,
   "ordinal": 8,
   "relation": "attendance_marks",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 1,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "operation_key",
   "type": "text",
   "default": null,
   "ordinal": 3,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "command",
   "type": "jsonb",
   "default": null,
   "ordinal": 4,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "audit_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "version",
   "type": "integer",
   "default": null,
   "ordinal": 6,
   "relation": "attendance_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": null,
   "ordinal": 1,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "register_date",
   "type": "date",
   "default": null,
   "ordinal": 5,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "version",
   "type": "integer",
   "default": null,
   "ordinal": 6,
   "relation": "attendance_registers",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "classes",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "classes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "name",
   "type": "character varying(80)",
   "default": null,
   "ordinal": 3,
   "relation": "classes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "section",
   "type": "character varying(40)",
   "default": null,
   "ordinal": 4,
   "relation": "classes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 5,
   "relation": "classes",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "level_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "classes",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "section_id",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "classes",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "student_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "status",
   "type": "enrollment_status",
   "default": "'active'::enrollment_status",
   "ordinal": 6,
   "relation": "enrollments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "memberships",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_authority_owner=w/postgres",
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "memberships",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "user_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "memberships",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "role",
   "type": "school_role",
   "default": null,
   "ordinal": 4,
   "relation": "memberships",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "status",
   "type": "membership_status",
   "default": "'active'::membership_status",
   "ordinal": 5,
   "relation": "memberships",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 6,
   "relation": "memberships",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "action",
   "type": "report_card_action",
   "default": null,
   "ordinal": 5,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "reason",
   "type": "text",
   "default": null,
   "ordinal": 6,
   "relation": "report_card_audit",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "before_stage",
   "type": "report_card_stage",
   "default": null,
   "ordinal": 7,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "after_stage",
   "type": "report_card_stage",
   "default": null,
   "ordinal": 8,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "before_version",
   "type": "integer",
   "default": null,
   "ordinal": 9,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "after_version",
   "type": "integer",
   "default": null,
   "ordinal": 10,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "snapshot_id",
   "type": "uuid",
   "default": null,
   "ordinal": 11,
   "relation": "report_card_audit",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "snapshot_report_version",
   "type": "integer",
   "default": null,
   "ordinal": 12,
   "relation": "report_card_audit",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "release_id",
   "type": "uuid",
   "default": null,
   "ordinal": 13,
   "relation": "report_card_audit",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "occurred_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 14,
   "relation": "report_card_audit",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "actor_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "operation_key",
   "type": "character varying(128)",
   "default": null,
   "ordinal": 5,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "fingerprint",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 6,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "resulting_version",
   "type": "integer",
   "default": null,
   "ordinal": 7,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "outcome",
   "type": "jsonb",
   "default": null,
   "ordinal": 8,
   "relation": "report_card_operation_receipts",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_version",
   "type": "integer",
   "default": null,
   "ordinal": 4,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "snapshot_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "snapshot_report_version",
   "type": "integer",
   "default": null,
   "ordinal": 6,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "published_by",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "released_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 8,
   "relation": "report_card_releases",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "revoked_at",
   "type": "timestamp with time zone",
   "default": null,
   "ordinal": 9,
   "relation": "report_card_releases",
   "required": false,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "report_version",
   "type": "integer",
   "default": null,
   "ordinal": 4,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "enrollment_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "assessment_scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "assessment_source_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "assessment_revision",
   "type": "integer",
   "default": null,
   "ordinal": 8,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "source_versions",
   "type": "jsonb",
   "default": null,
   "ordinal": 9,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "content_hash",
   "type": "character varying(64)",
   "default": null,
   "ordinal": 10,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "canonical_payload",
   "type": "jsonb",
   "default": null,
   "ordinal": 11,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 12,
   "relation": "report_card_snapshots",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "enrollment_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "student_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 6,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "term_id",
   "type": "uuid",
   "default": null,
   "ordinal": 7,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "stage",
   "type": "report_card_stage",
   "default": "'draft'::report_card_stage",
   "ordinal": 8,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "version",
   "type": "integer",
   "default": "1",
   "ordinal": 9,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "assessment_scope_id",
   "type": "uuid",
   "default": null,
   "ordinal": 10,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "assessment_source_version_id",
   "type": "uuid",
   "default": null,
   "ordinal": 11,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "assessment_revision",
   "type": "integer",
   "default": null,
   "ordinal": 12,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "submitted_by",
   "type": "uuid",
   "default": null,
   "ordinal": 13,
   "relation": "report_cards",
   "required": false,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "approved_by",
   "type": "uuid",
   "default": null,
   "ordinal": 14,
   "relation": "report_cards",
   "required": false,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "published_at",
   "type": "timestamp with time zone",
   "default": null,
   "ordinal": 15,
   "relation": "report_cards",
   "required": false,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "return_reason",
   "type": "text",
   "default": null,
   "ordinal": 16,
   "relation": "report_cards",
   "required": false,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 17,
   "relation": "report_cards",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "school_users",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_authority_owner=w/postgres",
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "auth_user_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "school_users",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "display_name",
   "type": "character varying(160)",
   "default": null,
   "ordinal": 3,
   "relation": "school_users",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 4,
   "relation": "school_users",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "schools",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_authority_owner=w/postgres",
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "name",
   "type": "character varying(180)",
   "default": null,
   "ordinal": 2,
   "relation": "schools",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "slug",
   "type": "character varying(80)",
   "default": null,
   "ordinal": 3,
   "relation": "schools",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "email",
   "type": "character varying(254)",
   "default": null,
   "ordinal": 4,
   "relation": "schools",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "phone",
   "type": "character varying(32)",
   "default": null,
   "ordinal": 5,
   "relation": "schools",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "address",
   "type": "text",
   "default": null,
   "ordinal": 6,
   "relation": "schools",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 7,
   "relation": "schools",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "final_primary_year",
   "type": "integer",
   "default": null,
   "ordinal": 8,
   "relation": "schools",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "structure_version",
   "type": "integer",
   "default": "0",
   "ordinal": 9,
   "relation": "schools",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "students",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "admission_number",
   "type": "character varying(50)",
   "default": null,
   "ordinal": 3,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "first_name",
   "type": "character varying(100)",
   "default": null,
   "ordinal": 4,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "last_name",
   "type": "character varying(100)",
   "default": null,
   "ordinal": 5,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "date_of_birth",
   "type": "date",
   "default": null,
   "ordinal": 6,
   "relation": "students",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "status",
   "type": "enrollment_status",
   "default": "'active'::enrollment_status",
   "ordinal": 7,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "created_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 8,
   "relation": "students",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "teacher_membership_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "class_id",
   "type": "uuid",
   "default": null,
   "ordinal": 4,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 5,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "assigned_at",
   "type": "timestamp with time zone",
   "default": "now()",
   "ordinal": 6,
   "relation": "teacher_class_assignments",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "ended_at",
   "type": "timestamp with time zone",
   "default": null,
   "ordinal": 7,
   "relation": "teacher_class_assignments",
   "required": false,
   "explicit_acl": null
  },
  {
   "name": "id",
   "type": "uuid",
   "default": "gen_random_uuid()",
   "ordinal": 1,
   "relation": "terms",
   "required": true,
   "explicit_acl": [
    "greenfield_report_card_runtime=w/postgres"
   ]
  },
  {
   "name": "school_id",
   "type": "uuid",
   "default": null,
   "ordinal": 2,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "session_id",
   "type": "uuid",
   "default": null,
   "ordinal": 3,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "name",
   "type": "character varying(32)",
   "default": null,
   "ordinal": 4,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "starts_on",
   "type": "date",
   "default": null,
   "ordinal": 5,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "ends_on",
   "type": "date",
   "default": null,
   "ordinal": 6,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  },
  {
   "name": "is_current",
   "type": "boolean",
   "default": "false",
   "ordinal": 7,
   "relation": "terms",
   "required": true,
   "explicit_acl": null
  }
 ],
 "triggerBaseline": {
  "terms": {
   "count": 5,
   "marker": "94d21f21de18f8e46d81080e99262d8f"
  },
  "classes": {
   "count": 5,
   "marker": "e7cfdf99bc53b5e108366196345bb134"
  },
  "schools": {
   "count": 6,
   "marker": "b602f760361d64623de6a49b6c12f46c"
  },
  "students": {
   "count": 5,
   "marker": "cfef240b5bc64fdda9b1657762a31da8"
  },
  "enrollments": {
   "count": 5,
   "marker": "9adac0fa3fe9bfcbba2cd8ca83098908"
  },
  "memberships": {
   "count": 6,
   "marker": "92dc87a1347adf2ba1494fde88dc1508"
  },
  "report_cards": {
   "count": 2,
   "marker": "b9532ceb104fcd39cb7387db1781a9f1"
  },
  "school_users": {
   "count": 5,
   "marker": "8047058172e48cfb60202c7ca3b9aa01"
  },
  "academic_levels": {
   "count": 5,
   "marker": "0e7e41ef44a8a70c1e73d1b56ae4a3f4"
  },
  "assessment_audit": {
   "count": 4,
   "marker": "710ea91205a331b33c340c1e8cdaf16c"
  },
  "attendance_audit": {
   "count": 1,
   "marker": "71d5ed5ee65d5b16967dc92aaf0070bb"
  },
  "attendance_marks": {
   "count": 1,
   "marker": "5aeb3bbe246369427bc93f61dad76bfa"
  },
  "academic_sections": {
   "count": 5,
   "marker": "43d34c3e52858706d0b5969283105fa4"
  },
  "academic_sessions": {
   "count": 5,
   "marker": "e1ca0777ffa8a41fc98fda1a81b6d4a2"
  },
  "assessment_scopes": {
   "count": 6,
   "marker": "e20ee61b0d5b332643f79ce57801db80"
  },
  "assessment_scores": {
   "count": 5,
   "marker": "fb1b964756e9ba2551c791958c0ac63f"
  },
  "report_card_audit": {
   "count": 4,
   "marker": "8947fdc9afd354767ca2292fd0150b91"
  },
  "assessment_subjects": {
   "count": 5,
   "marker": "06b5bf3bf4fec45c414ccf5ab578a299"
  },
  "attendance_receipts": {
   "count": 1,
   "marker": "b4c92191c772a91da0b596daa995179d"
  },
  "attendance_registers": {
   "count": 1,
   "marker": "294767210bde52560a66da50fe5ad6ea"
  },
  "report_card_releases": {
   "count": 5,
   "marker": "a1a13dfc0be515345752faee723a8acc"
  },
  "report_card_snapshots": {
   "count": 4,
   "marker": "bfdd1209880a4c65443841d63f72f003"
  },
  "assessment_finalizations": {
   "count": 4,
   "marker": "31510dd1353617fb4f6cd001920e5940"
  },
  "assessment_subject_roster": {
   "count": 5,
   "marker": "ded6d6b7a7e086cbc483935a3cedac9f"
  },
  "teacher_class_assignments": {
   "count": 5,
   "marker": "57986a8c9f72eecba980f80b0dd4d160"
  },
  "assessment_config_versions": {
   "count": 6,
   "marker": "4ebfbdf56b8f13e7dd34fcd28dcf709f"
  },
  "assessment_source_versions": {
   "count": 4,
   "marker": "fe90a5c711ad98dbccb57e8b1e4b3e99"
  },
  "assessment_teacher_reviews": {
   "count": 4,
   "marker": "e125e5ea1d681e075a51df820f08d31b"
  },
  "assessment_teacher_subjects": {
   "count": 4,
   "marker": "cee2a555c4e7fd1e3b21fc2f9967b34f"
  },
  "assessment_source_write_gate": {
   "count": 2,
   "marker": "306933ad0db7f23c5b760eeabd289f85"
  },
  "assessment_operation_receipts": {
   "count": 4,
   "marker": "edacfbc771542ebab80a13925928c588"
  },
  "report_card_operation_receipts": {
   "count": 4,
   "marker": "dace166fabb175648a9ac3245d1bd28b"
  }
 },
 "policyBaseline": {
  "terms": {
   "count": 6,
   "marker": "85980d9f3f6f0fc7c9effa0b444bfa08"
  },
  "classes": {
   "count": 7,
   "marker": "314cf321b42759b1d1cdce2d2e355b7b"
  },
  "schools": {
   "count": 9,
   "marker": "5741d824f14533d0dd7c9cf954e3b437"
  },
  "students": {
   "count": 7,
   "marker": "15fd33ac689906f92ca3ca95edabd14e"
  },
  "enrollments": {
   "count": 7,
   "marker": "9fcbbe0d065894caa0086d1e5a3634d9"
  },
  "memberships": {
   "count": 9,
   "marker": "085477b682592b64bf497f4e889685ab"
  },
  "report_cards": {
   "count": 6,
   "marker": "bf52c22a1dad5c9af71f4c5c28e07d33"
  },
  "school_users": {
   "count": 9,
   "marker": "e263eded66f0b6308cf305e8b099ccc7"
  },
  "academic_levels": {
   "count": 6,
   "marker": "8e62f107054416fc88d1d9da3e2dc3a7"
  },
  "assessment_audit": {
   "count": 6,
   "marker": "886ea3d42fdb2635025f746f2d381810"
  },
  "attendance_audit": {
   "count": 1,
   "marker": "4a23d7a206c809cf96b1ea6d9cf1b89d"
  },
  "attendance_marks": {
   "count": 1,
   "marker": "08757b5b2e28f82fafd000e2324604a4"
  },
  "academic_sections": {
   "count": 6,
   "marker": "8c11d175a8e3814c2d8d6a665d375b5e"
  },
  "academic_sessions": {
   "count": 7,
   "marker": "d87dac5c351e83cc9b75200467647f37"
  },
  "assessment_scopes": {
   "count": 6,
   "marker": "6bbbfe33d20d302d6251cfaeeeaae933"
  },
  "assessment_scores": {
   "count": 6,
   "marker": "f1247a95fd17b8f5d15ef28295a2ed84"
  },
  "report_card_audit": {
   "count": 5,
   "marker": "d0c2438ce716c0530d4cc8c3264f530d"
  },
  "assessment_subjects": {
   "count": 5,
   "marker": "79fbdde0ae9e6ba36e34b3c9ecb134c8"
  },
  "attendance_receipts": {
   "count": 1,
   "marker": "de8a68535a87149599357a1656eb876d"
  },
  "attendance_registers": {
   "count": 1,
   "marker": "7061f1e3802dd5f261a559ffae528c6c"
  },
  "report_card_releases": {
   "count": 6,
   "marker": "eeca1f0029002268677d4cdcbd1cdd46"
  },
  "report_card_snapshots": {
   "count": 5,
   "marker": "3c5a464fa3b0e9d72fc510dfe9c83e62"
  },
  "assessment_finalizations": {
   "count": 4,
   "marker": "bddd2acf85bd5b0b1411d10ea19f1628"
  },
  "assessment_subject_roster": {
   "count": 5,
   "marker": "32afbb65173dd5fc1ac74df2256d132f"
  },
  "teacher_class_assignments": {
   "count": 6,
   "marker": "4fa6f4d29e669a60c749a55f82440187"
  },
  "assessment_config_versions": {
   "count": 5,
   "marker": "dcdbfe9bd65d5b10f4296f131888e78b"
  },
  "assessment_source_versions": {
   "count": 4,
   "marker": "927f50bee34b992209a3081787c9b686"
  },
  "assessment_teacher_reviews": {
   "count": 4,
   "marker": "5f87f9f584aba25958fbbd1345d391d5"
  },
  "assessment_teacher_subjects": {
   "count": 5,
   "marker": "92ba84525c2f28545ae00d2448ddbe5f"
  },
  "assessment_source_write_gate": {
   "count": 8,
   "marker": "213a24723b88d2dbc9bcaef04b0dc464"
  },
  "assessment_operation_receipts": {
   "count": 6,
   "marker": "bb54ecb357b205d1ce1a00eba11200e8"
  },
  "assessment_source_write_claims": {
   "count": 2,
   "marker": "2f10cbd4a54a67f934457005d8e148b1"
  },
  "report_card_operation_receipts": {
   "count": 5,
   "marker": "3e29ceb0d5553a40c3dcd3ba158fb8a2"
  }
 },
 "partialIndexes": [
  {
   "partial": true,
   "relation": "assessment_config_versions",
   "definition": "CREATE UNIQUE INDEX as_config_default_revision_uq ON public.assessment_config_versions USING btree (school_id, level_id, session_id, term_id, revision) WHERE (subject_id IS NULL)",
   "index_name": "as_config_default_revision_uq",
   "indisready": true,
   "indisvalid": true,
   "indisunique": true
  },
  {
   "partial": true,
   "relation": "assessment_config_versions",
   "definition": "CREATE UNIQUE INDEX as_config_subject_revision_uq ON public.assessment_config_versions USING btree (school_id, level_id, session_id, term_id, subject_id, revision) WHERE (subject_id IS NOT NULL)",
   "index_name": "as_config_subject_revision_uq",
   "indisready": true,
   "indisvalid": true,
   "indisunique": true
  },
  {
   "partial": true,
   "relation": "assessment_subject_roster",
   "definition": "CREATE UNIQUE INDEX as_roster_active_subject_uq ON public.assessment_subject_roster USING btree (school_id, scope_id, subject_id) WHERE (is_active = true)",
   "index_name": "as_roster_active_subject_uq",
   "indisready": true,
   "indisvalid": true,
   "indisunique": true
  }
 ],
 "edges": [
  {
   "member": "greenfield_app",
   "grantor": "postgres",
   "set_option": true,
   "admin_option": false,
   "granted_role": "greenfield_report_card_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": false,
   "member_bypass_rls": false,
   "member_create_role": false
  },
  {
   "member": "greenfield_assessment_app",
   "grantor": "postgres",
   "set_option": true,
   "admin_option": false,
   "granted_role": "greenfield_assessment_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": false,
   "member_bypass_rls": false,
   "member_create_role": false
  },
  {
   "member": "greenfield_attendance_app",
   "grantor": "postgres",
   "set_option": true,
   "admin_option": false,
   "granted_role": "greenfield_attendance_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": false,
   "member_bypass_rls": false,
   "member_create_role": false
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_app",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_assessment_app",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_assessment_owner",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_assessment_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_attendance_app",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_attendance_owner",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_attendance_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_report_card_authority_owner",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  },
  {
   "member": "postgres",
   "grantor": "supabase_admin",
   "set_option": false,
   "admin_option": true,
   "granted_role": "greenfield_report_card_runtime",
   "inherit_option": false,
   "member_superuser": false,
   "grantor_superuser": true,
   "member_bypass_rls": true,
   "member_create_role": true
  }
 ],
 "roleData": [
  {
   "name": "greenfield_app",
   "login": true,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  },
  {
   "name": "greenfield_assessment_app",
   "login": true,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  },
  {
   "name": "greenfield_assessment_owner",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": true
  },
  {
   "name": "greenfield_assessment_runtime",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  },
  {
   "name": "greenfield_attendance_app",
   "login": true,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  },
  {
   "name": "greenfield_attendance_owner",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": true
  },
  {
   "name": "greenfield_attendance_runtime",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  },
  {
   "name": "greenfield_report_card_authority_owner",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": true
  },
  {
   "name": "greenfield_report_card_runtime",
   "login": false,
   "inherit": false,
   "superuser": false,
   "bypass_rls": false,
   "create_role": false,
   "create_database": false,
   "replication": false,
   "owns_objects": false
  }
 ]
};
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const reviewedAssessmentReviewTarget=freeze(target);
