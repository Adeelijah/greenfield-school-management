-- REVIEW ONLY: fresh Greenfield staging foundation; not authorized for execution.
-- Intended isolated project: hweoqkbgmzycyznrbvng (user-confirmed greenfield staging).
-- SQL cannot attest the Supabase project reference: verify the dashboard target.
-- Source: 78acbde22d73a9358f69c213e91c40b6463f0bda.
-- Normalized historical baseline SHA256: d7a1a0d90c8b3ec5b809cc5ad9e209db26f23bcddd13fd5847760c909eefee02.
-- Reorders indexes before FKs; the original Drizzle migration/journal is unchanged.
-- Creates 12 empty foundation tables and four enums; no seed/account/role creation.
-- Entire public schema inspection, restore scope and installation need separate review.
-- Do not run against an existing installation, production or via Drizzle migrate.
-- Role/API grants are withheld. No report routes or application connection are enabled.

BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- Phase: fresh_preflight
DO $foundation_preflight$
BEGIN
 IF current_user IN ('anon','authenticated','service_role','greenfield_app','greenfield_report_card_runtime','greenfield_report_card_authority_owner') THEN
  RAISE EXCEPTION 'A separately authorized installation operator is required';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname='public') THEN
  RAISE EXCEPTION 'Expected public schema is absent';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','f','S')) THEN
  RAISE EXCEPTION 'Fresh foundation requires no existing public tables, views or sequences';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
           WHERE n.nspname='public' AND t.typname=ANY(ARRAY['admission_status','enrollment_status','membership_status','school_role'])) THEN
  RAISE EXCEPTION 'Existing foundation type requires catalog reconciliation';
 END IF;
 IF (SELECT count(*) FROM pg_catalog.pg_roles WHERE rolname IN ('anon','authenticated','service_role'))<>3 THEN
  RAISE EXCEPTION 'Expected Supabase API roles are absent';
 END IF;
END;
$foundation_preflight$;

-- Phase: enums
CREATE TYPE "public"."admission_status" AS ENUM('draft', 'submitted', 'reviewing', 'accepted', 'declined');

CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'graduated', 'withdrawn');

CREATE TYPE "public"."membership_status" AS ENUM('active', 'suspended');

CREATE TYPE "public"."school_role" AS ENUM('admin', 'teacher', 'bursar');

-- Phase: tables
CREATE TABLE "public"."academic_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"label" varchar(24) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "sessions_dates_valid" CHECK ("academic_sessions"."ends_on" >= "academic_sessions"."starts_on")
);

CREATE TABLE "public"."admissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"applicant_name" varchar(180) NOT NULL,
	"requested_class_id" uuid,
	"status" "public"."admission_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone
);

CREATE TABLE "public"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(80) NOT NULL,
	"entity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"section" varchar(40) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"status" "public"."enrollment_status" DEFAULT 'active' NOT NULL
);

CREATE TABLE "public"."guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"full_name" varchar(180) NOT NULL,
	"phone" varchar(32),
	"email" varchar(254)
);

CREATE TABLE "public"."memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "public"."school_role" NOT NULL,
	"status" "public"."membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."school_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_users_auth_user_id_unique" UNIQUE("auth_user_id")
);

CREATE TABLE "public"."schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(180) NOT NULL,
	"slug" varchar(80) NOT NULL,
	"email" varchar(254),
	"phone" varchar(32),
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);

CREATE TABLE "public"."student_guardians" (
	"school_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"relationship" varchar(50) NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL
);

CREATE TABLE "public"."students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"admission_number" varchar(50) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date,
	"status" "public"."enrollment_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "public"."terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"name" varchar(32) NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	CONSTRAINT "terms_dates_valid" CHECK ("terms"."ends_on" >= "terms"."starts_on")
);

-- Phase: indexes
CREATE UNIQUE INDEX "sessions_school_label_unique" ON "public"."academic_sessions" USING btree ("school_id","label");

CREATE UNIQUE INDEX "sessions_school_id_id_unique" ON "public"."academic_sessions" USING btree ("school_id","id");

CREATE UNIQUE INDEX "sessions_one_current_per_school" ON "public"."academic_sessions" USING btree ("school_id") WHERE "academic_sessions"."is_current" = true;

CREATE INDEX "admissions_school_status_idx" ON "public"."admissions" USING btree ("school_id","status");

CREATE INDEX "audit_events_school_created_idx" ON "public"."audit_events" USING btree ("school_id","created_at");

CREATE UNIQUE INDEX "classes_school_name_unique" ON "public"."classes" USING btree ("school_id","name");

CREATE UNIQUE INDEX "classes_school_id_id_unique" ON "public"."classes" USING btree ("school_id","id");

CREATE UNIQUE INDEX "enrollments_student_session_unique" ON "public"."enrollments" USING btree ("student_id","session_id");

CREATE INDEX "enrollments_class_session_idx" ON "public"."enrollments" USING btree ("class_id","session_id");

CREATE INDEX "guardians_school_idx" ON "public"."guardians" USING btree ("school_id");

CREATE UNIQUE INDEX "guardians_school_id_id_unique" ON "public"."guardians" USING btree ("school_id","id");

CREATE UNIQUE INDEX "memberships_school_user_unique" ON "public"."memberships" USING btree ("school_id","user_id");

CREATE INDEX "memberships_user_idx" ON "public"."memberships" USING btree ("user_id");

CREATE UNIQUE INDEX "student_guardian_unique" ON "public"."student_guardians" USING btree ("student_id","guardian_id");

CREATE UNIQUE INDEX "students_school_admission_unique" ON "public"."students" USING btree ("school_id","admission_number");

CREATE UNIQUE INDEX "students_school_id_id_unique" ON "public"."students" USING btree ("school_id","id");

CREATE INDEX "students_school_name_idx" ON "public"."students" USING btree ("school_id","last_name");

CREATE UNIQUE INDEX "terms_session_name_unique" ON "public"."terms" USING btree ("session_id","name");

CREATE UNIQUE INDEX "terms_one_current_per_school" ON "public"."terms" USING btree ("school_id") WHERE "terms"."is_current" = true;

-- Phase: foreign_keys
ALTER TABLE "public"."academic_sessions" ADD CONSTRAINT "academic_sessions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."admissions" ADD CONSTRAINT "admissions_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."admissions" ADD CONSTRAINT "admissions_school_class_fk" FOREIGN KEY ("school_id","requested_class_id") REFERENCES "public"."classes"("school_id","id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."audit_events" ADD CONSTRAINT "audit_events_actor_user_id_school_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."school_users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "public"."classes" ADD CONSTRAINT "classes_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_school_class_fk" FOREIGN KEY ("school_id","class_id") REFERENCES "public"."classes"("school_id","id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."enrollments" ADD CONSTRAINT "enrollments_school_session_fk" FOREIGN KEY ("school_id","session_id") REFERENCES "public"."academic_sessions"("school_id","id") ON DELETE restrict ON UPDATE no action;

ALTER TABLE "public"."guardians" ADD CONSTRAINT "guardians_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."memberships" ADD CONSTRAINT "memberships_user_id_school_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."school_users"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."student_guardians" ADD CONSTRAINT "student_guardians_school_guardian_fk" FOREIGN KEY ("school_id","guardian_id") REFERENCES "public"."guardians"("school_id","id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."terms" ADD CONSTRAINT "terms_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."terms" ADD CONSTRAINT "terms_session_id_academic_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."academic_sessions"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "public"."terms" ADD CONSTRAINT "terms_school_session_fk" FOREIGN KEY ("school_id","session_id") REFERENCES "public"."academic_sessions"("school_id","id") ON DELETE cascade ON UPDATE no action;

-- Phase: protection
ALTER TABLE "public"."academic_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."academic_sessions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."academic_sessions" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."academic_sessions" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."admissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."admissions" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."admissions" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."admissions" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."audit_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."audit_events" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."audit_events" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."classes" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."classes" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."classes" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."enrollments" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."enrollments" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."enrollments" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."guardians" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."guardians" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."guardians" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."memberships" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."memberships" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."memberships" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."school_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."school_users" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."school_users" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."school_users" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."schools" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."schools" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."schools" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."schools" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."student_guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."student_guardians" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."student_guardians" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."student_guardians" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."students" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."students" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."students" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
ALTER TABLE "public"."terms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."terms" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "public"."terms" FROM PUBLIC,anon,authenticated,service_role;
CREATE POLICY foundation_setup_operator ON "public"."terms" FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

-- Remove direct default grants to known existing app roles, without creating
-- roles, changing memberships/default ACLs or touching other schema objects.
DO $foundation_access$
DECLARE selected_table text; selected_role text; selected_relation oid;
BEGIN
 FOREACH selected_table IN ARRAY ARRAY['academic_sessions','admissions','audit_events','classes','enrollments','guardians','memberships','school_users','schools','student_guardians','students','terms']
 LOOP
  FOR selected_role IN SELECT rolname FROM pg_catalog.pg_roles
    WHERE rolname=ANY(ARRAY['greenfield_app','greenfield_report_card_runtime','greenfield_report_card_authority_owner'])
  LOOP
   EXECUTE pg_catalog.format('REVOKE ALL ON TABLE public.%I FROM %I',selected_table,selected_role);
  END LOOP;
  SELECT c.oid INTO STRICT selected_relation FROM pg_catalog.pg_class c
   JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=selected_table;
  FOR selected_role IN SELECT rolname FROM pg_catalog.pg_roles WHERE rolname=ANY(ARRAY['anon','authenticated','service_role','greenfield_app','greenfield_report_card_runtime','greenfield_report_card_authority_owner'])
  LOOP
   IF pg_catalog.has_table_privilege(selected_role,selected_relation,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
      OR pg_catalog.has_any_column_privilege(selected_role,selected_relation,'SELECT,INSERT,UPDATE,REFERENCES') THEN
    RAISE EXCEPTION 'Unexpected effective access for role % on %; reconcile grants/memberships before retry',selected_role,selected_table;
   END IF;
  END LOOP;
 END LOOP;
 IF (SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=ANY(ARRAY['academic_sessions','admissions','audit_events','classes','enrollments','guardians','memberships','school_users','schools','student_guardians','students','terms']) AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity)<>12 THEN
  RAISE EXCEPTION 'Expected twelve protected foundation tables';
 END IF;
END;
$foundation_access$;

COMMIT;

-- Read-only result after successful commit. Expected: 12 / 12.
SELECT count(*) AS foundation_tables,
       count(*) FILTER (WHERE c.relrowsecurity AND c.relforcerowsecurity) AS protected_tables
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname=ANY(ARRAY['academic_sessions','admissions','audit_events','classes','enrollments','guardians','memberships','school_users','schools','student_guardians','students','terms']);
