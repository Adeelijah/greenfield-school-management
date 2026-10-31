// Sanitized operator-supplied staging catalog evidence; no records or credentials.
const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
export const reviewedScoreTarget=freeze({
  "projectRef": "hweoqkbgmzycyznrbvng",
  "schoolId": "0c594571-74c5-46fe-a835-a9b217a3a199",
  "primary5ClassId": "1dbfa5e7-99b8-5094-b1f9-c872477d4bf6",
  "crecheClassId": "fe6e5a74-b93a-5d00-8115-53b6952153be",
  "sessionId": "8a9350ca-95cb-50ca-b750-2d8d5a192044",
  "termId": "f7742f7c-ffe4-58ee-8dce-c687ec623330",
  "columns": {
    "assessment_audit": {
      "id": [
        "uuid",
        true
      ],
      "action": [
        "character varying(64)",
        true
      ],
      "scope_id": [
        "uuid",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "occurred_at": [
        "timestamp with time zone",
        true
      ],
      "after_revision": [
        "integer",
        true
      ],
      "before_revision": [
        "integer",
        true
      ],
      "actor_membership_id": [
        "uuid",
        true
      ]
    },
    "assessment_scopes": {
      "id": [
        "uuid",
        true
      ],
      "term_id": [
        "uuid",
        true
      ],
      "class_id": [
        "uuid",
        true
      ],
      "revision": [
        "integer",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "session_id": [
        "uuid",
        true
      ]
    },
    "assessment_scores": {
      "id": [
        "uuid",
        true
      ],
      "version": [
        "integer",
        true
      ],
      "roster_id": [
        "uuid",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "student_id": [
        "uuid",
        true
      ],
      "updated_by": [
        "uuid",
        true
      ],
      "component_key": [
        "character varying(128)",
        true
      ],
      "enrollment_id": [
        "uuid",
        true
      ],
      "numeric_score": [
        "numeric(12,4)",
        false
      ],
      "observation_key": [
        "character varying(128)",
        false
      ],
      "config_version_id": [
        "uuid",
        true
      ]
    },
    "assessment_subject_roster": {
      "id": [
        "uuid",
        true
      ],
      "scope_id": [
        "uuid",
        true
      ],
      "is_active": [
        "boolean",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "subject_id": [
        "uuid",
        true
      ],
      "roster_version": [
        "integer",
        true
      ],
      "config_version_id": [
        "uuid",
        true
      ]
    },
    "assessment_config_versions": {
      "id": [
        "uuid",
        true
      ],
      "mode": [
        "assessment_mode",
        true
      ],
      "state": [
        "assessment_config_state",
        true
      ],
      "grading": [
        "jsonb",
        true
      ],
      "term_id": [
        "uuid",
        true
      ],
      "level_id": [
        "uuid",
        true
      ],
      "revision": [
        "integer",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "components": [
        "jsonb",
        true
      ],
      "config_key": [
        "uuid",
        true
      ],
      "session_id": [
        "uuid",
        true
      ],
      "subject_id": [
        "uuid",
        false
      ]
    },
    "assessment_source_write_gate": {
      "id": [
        "integer",
        true
      ]
    },
    "assessment_operation_receipts": {
      "id": [
        "uuid",
        true
      ],
      "outcome": [
        "jsonb",
        true
      ],
      "scope_id": [
        "uuid",
        true
      ],
      "school_id": [
        "uuid",
        true
      ],
      "fingerprint": [
        "character varying(64)",
        true
      ],
      "operation_key": [
        "character varying(128)",
        true
      ],
      "resulting_revision": [
        "integer",
        true
      ],
      "actor_membership_id": [
        "uuid",
        true
      ]
    },
    "assessment_source_write_claims": {
      "scope_id": [
        "uuid",
        true
      ],
      "transaction_id": [
        "text",
        true
      ]
    }
  },
  "keys": [
    {
      "relation": "academic_sessions",
      "columns": [
        "school_id",
        "id"
      ]
    },
    {
      "relation": "assessment_config_versions",
      "columns": [
        "school_id",
        "id"
      ]
    },
    {
      "relation": "assessment_operation_receipts",
      "columns": [
        "school_id",
        "actor_membership_id",
        "operation_key"
      ]
    },
    {
      "relation": "assessment_scopes",
      "columns": [
        "school_id",
        "class_id",
        "session_id",
        "term_id"
      ]
    },
    {
      "relation": "assessment_scores",
      "columns": [
        "school_id",
        "roster_id",
        "enrollment_id",
        "component_key"
      ]
    },
    {
      "relation": "assessment_source_write_claims",
      "columns": [
        "transaction_id",
        "scope_id"
      ]
    },
    {
      "relation": "assessment_subject_roster",
      "columns": [
        "school_id",
        "id",
        "config_version_id"
      ]
    },
    {
      "relation": "classes",
      "columns": [
        "school_id",
        "id"
      ]
    },
    {
      "relation": "enrollments",
      "columns": [
        "school_id",
        "id",
        "student_id",
        "class_id",
        "session_id"
      ]
    },
    {
      "relation": "enrollments",
      "columns": [
        "school_id",
        "id",
        "student_id"
      ]
    },
    {
      "relation": "memberships",
      "columns": [
        "school_id",
        "id"
      ]
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
        "postgres=X/postgres"
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
        "postgres=X/postgres"
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
        "postgres=X/postgres"
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
      "rows": 4,
      "relation": "enrollments",
      "change_marker": "9444981f65c0f50c8eeac4d0902f215a"
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
    }
  ],
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
    }
  ],
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
  "inspectionSearchPath": "\"\\$user\", public, extensions",
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
      "count": 5,
      "marker": "4d8a5a451f03eaf53110136cbe7ef536"
    },
    "classes": {
      "count": 6,
      "marker": "ead4984b209a56681b547ff72653828c"
    },
    "schools": {
      "count": 8,
      "marker": "e7c03036930ab9a1b322c626a9530ebc"
    },
    "students": {
      "count": 6,
      "marker": "1e075868f04819480d5bd9aa6f2eebbd"
    },
    "enrollments": {
      "count": 6,
      "marker": "6287ab5d4fb87c1e717e33b67f6bc1d7"
    },
    "memberships": {
      "count": 8,
      "marker": "025ee00599bbcc9dc0d8b291ecd503aa"
    },
    "report_cards": {
      "count": 6,
      "marker": "bf52c22a1dad5c9af71f4c5c28e07d33"
    },
    "school_users": {
      "count": 8,
      "marker": "bd8861c680922155761f5d471e75ade3"
    },
    "academic_levels": {
      "count": 5,
      "marker": "73726dc2a4b95416ffaf391c3f935409"
    },
    "assessment_audit": {
      "count": 4,
      "marker": "18f08b06f99d27a5615f43eb7551688d"
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
      "count": 5,
      "marker": "65e4f487bda18df53cf1b831eadff8f4"
    },
    "academic_sessions": {
      "count": 6,
      "marker": "cf7875b74e5c8d6373c0864c5d665d12"
    },
    "assessment_scopes": {
      "count": 4,
      "marker": "6701a20b53eb51cd2a04829af7a9f515"
    },
    "assessment_scores": {
      "count": 4,
      "marker": "90c5951fdbcef410fb9ce7b951338148"
    },
    "report_card_audit": {
      "count": 5,
      "marker": "d0c2438ce716c0530d4cc8c3264f530d"
    },
    "assessment_subjects": {
      "count": 4,
      "marker": "4d240407958b68b157d6137652e0f45b"
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
      "count": 4,
      "marker": "e125a23a7b2c06554e2e37cf1295edfb"
    },
    "teacher_class_assignments": {
      "count": 5,
      "marker": "771db22434e9156c160ab47350fd84e3"
    },
    "assessment_config_versions": {
      "count": 4,
      "marker": "b9a3e5bdddad260dc19befe662405d7b"
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
      "count": 4,
      "marker": "6f661c2238e3fa0b1f2c71288f9a8d44"
    },
    "assessment_source_write_gate": {
      "count": 7,
      "marker": "a38488b7993c65c97f3486264cbbc5f8"
    },
    "assessment_operation_receipts": {
      "count": 4,
      "marker": "e5bd057e9b42fe85d05a41a5eca7204e"
    },
    "assessment_source_write_claims": {
      "count": 1,
      "marker": "133d4f57ea2f4f6631afb5428a9b398f"
    },
    "report_card_operation_receipts": {
      "count": 5,
      "marker": "3e29ceb0d5553a40c3dcd3ba158fb8a2"
    }
  }
});
