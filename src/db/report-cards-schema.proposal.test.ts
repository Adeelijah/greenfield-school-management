import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableConfig, PgDialect } from 'drizzle-orm/pg-core';
// @ts-expect-error Node type stripping requires explicit source extension.
import * as proposal from './report-cards-schema.proposal.ts';
const cfg=(t:Parameters<typeof getTableConfig>[0])=>getTableConfig(t);
const fks=(t:Parameters<typeof getTableConfig>[0])=>cfg(t).foreignKeys.map(f=>f.getName());
const indexes=(t:Parameters<typeof getTableConfig>[0])=>cfg(t).indexes.map(i=>i.config.name);
const checks=(t:Parameters<typeof getTableConfig>[0])=>cfg(t).checks.map(c=>c.name);
test('report identity is unique and student, class, session are school scoped',()=>{
 const t=proposal.proposedReportCards;
 assert.ok(indexes(t).includes('report_cards_school_identity_unique'));
 for(const name of ['report_cards_school_student_fk','report_cards_school_class_fk','report_cards_school_session_fk','report_cards_school_submitter_fk','report_cards_school_approver_fk']) assert.ok(fks(t).includes(name));
 assert.ok(checks(t).includes('report_cards_version_positive'));
});
test('term FK binds school, session and term together to the reviewed composite target',()=>{
 const termFk=cfg(proposal.proposedReportCards).foreignKeys.find(f=>f.getName()==='report_cards_school_session_term_fk');
 assert.ok(termFk);
 const reference=termFk.reference();
 assert.deepEqual(reference.columns.map(c=>c.name),['school_id','session_id','term_id']);
 assert.deepEqual(reference.foreignColumns.map(c=>c.name),['school_id','session_id','id']);
 assert.ok(indexes(proposal.proposedTermsCompositeTarget).includes('terms_school_session_id_unique'));
 assert.equal(fks(proposal.proposedReportCards).includes('report_cards_term_fk'),false);
});
test('snapshots and audit use school-scoped report, actor and snapshot references',()=>{
 assert.ok(fks(proposal.proposedReportSnapshots).includes('report_snapshots_school_report_fk'));
 for(const name of ['report_audit_school_report_fk','report_audit_school_actor_fk','report_audit_school_snapshot_fk']) assert.ok(fks(proposal.proposedReportAudit).includes(name));
 assert.ok(checks(proposal.proposedReportAudit).includes('report_audit_version_step'));
});
test('idempotency receipt uniqueness is school and actor scoped',()=>{
 assert.ok(indexes(proposal.proposedReportReceipts).includes('report_receipts_school_actor_key_unique'));
 assert.ok(fks(proposal.proposedReportReceipts).includes('report_receipts_school_actor_fk'));
 assert.ok(fks(proposal.proposedReportReceipts).includes('report_receipts_school_report_fk'));
});
test('releases are version unique and revocation order is constrained',()=>{
 assert.ok(indexes(proposal.proposedReportReleases).includes('report_releases_school_report_version_unique'));
 assert.ok(fks(proposal.proposedReportReleases).includes('report_releases_school_report_fk'));
 assert.ok(checks(proposal.proposedReportReleases).includes('report_releases_revocation_order'));
});
test('proposal is not part of the production schema export',async()=>{
 // Node runtime import is only for offline inspection, not a migration.
 // @ts-expect-error Node type stripping requires explicit source extension.
 const production=await import('./schema.ts');
 assert.equal(Object.hasOwn(production,'proposedReportCards'),false);
});
const reference=(table:Parameters<typeof getTableConfig>[0],name:string)=>{
 const fk=cfg(table).foreignKeys.find(f=>f.getName()===name);assert.ok(fk,name);return fk.reference();
};
test('report pins the exact enrollment student class and session tuple',()=>{
 const ref=reference(proposal.proposedReportCards,'report_cards_enrollment_binding_fk');
 assert.deepEqual(ref.columns.map(c=>c.name),['school_id','enrollment_id','student_id','class_id','session_id']);
 assert.deepEqual(ref.foreignColumns.map(c=>c.name),['school_id','id','student_id','class_id','session_id']);
 assert.ok(indexes(proposal.proposedEnrollmentCompositeTarget).includes('enrollments_report_binding_unique'));
});
test('report scope and source revision bind actual assessment composite targets',()=>{
 const scope=reference(proposal.proposedReportCards,'report_cards_assessment_scope_fk');
 assert.deepEqual(scope.columns.map(c=>c.name),['school_id','assessment_scope_id','class_id','session_id','term_id']);
 const source=reference(proposal.proposedReportCards,'report_cards_assessment_source_fk');
 assert.deepEqual(source.foreignColumns.map(c=>c.name),['school_id','id','scope_id','revision']);
 assert.ok(checks(proposal.proposedReportCards).includes('report_cards_assessment_revision_positive'));
});
test('snapshot binds stable report enrollment scope and independent immutable source revision',()=>{
 const report=reference(proposal.proposedReportSnapshots,'report_snapshots_report_binding_fk');
 assert.deepEqual(report.columns.map(c=>c.name),['school_id','report_id','enrollment_id','assessment_scope_id']);
 const source=reference(proposal.proposedReportSnapshots,'report_snapshots_assessment_source_fk');
 assert.deepEqual(source.columns.map(c=>c.name),['school_id','assessment_source_version_id','assessment_scope_id','assessment_revision']);
 assert.ok(indexes(proposal.proposedReportSnapshots).includes('report_snapshots_report_version_unique'));
 assert.ok(checks(proposal.proposedReportSnapshots).includes('report_snapshots_payload_valid'));
});
test('audit snapshot identity includes report and exact approved version',()=>{
 const ref=reference(proposal.proposedReportAudit,'report_audit_school_snapshot_fk');
 assert.deepEqual(ref.columns.map(c=>c.name),['school_id','report_id','snapshot_id','snapshot_report_version']);
 assert.ok(checks(proposal.proposedReportAudit).includes('report_audit_snapshot_binding_valid'));
 assert.ok(checks(proposal.proposedReportAudit).includes('report_audit_stage_transition_valid'));
});
test('release pins the exact report snapshot version and a school-scoped publisher',()=>{
 const ref=reference(proposal.proposedReportReleases,'report_releases_exact_snapshot_fk');
 assert.deepEqual(ref.foreignColumns.map(c=>c.name),['school_id','report_id','id','report_version']);
 assert.ok(fks(proposal.proposedReportReleases).includes('report_releases_school_publisher_fk'));
 assert.ok(indexes(proposal.proposedReportReleases).includes('report_releases_one_active_unique'));
});
test('stage checks require independent approval and publication timestamps',()=>{
 assert.ok(checks(proposal.proposedReportCards).includes('report_cards_stage_fields_valid'));
 const columns=cfg(proposal.proposedReportCards).columns;
 for(const name of ['enrollment_id','assessment_scope_id','assessment_source_version_id'])assert.equal(columns.find(c=>c.name===name)?.notNull,true);
});
test('snapshot and release pin fields cannot be omitted',()=>{
 for(const [table,names] of [[proposal.proposedReportSnapshots,['report_version','enrollment_id','assessment_scope_id','assessment_source_version_id']], [proposal.proposedReportReleases,['snapshot_id','snapshot_report_version','published_by']]] as const){
  for(const name of names)assert.equal(cfg(table).columns.find(c=>c.name===name)?.notNull,true);
 }
});
test('receipt payload validation retains actor-key uniqueness and canonical hash format',()=>{
 assert.ok(checks(proposal.proposedReportReceipts).includes('report_receipts_payload_valid'));
 assert.ok(checks(proposal.proposedReportReceipts).includes('report_receipts_hash_length'));
 assert.ok(indexes(proposal.proposedReportReceipts).includes('report_receipts_school_actor_key_unique'));
});

test('creation audit is explicitly version zero to one and separate from later transitions',()=>{
 assert.ok(proposal.proposedReportAction.enumValues.includes('create'));
 const check=cfg(proposal.proposedReportAudit).checks.find(c=>c.name==='report_audit_version_step');assert.ok(check);
 const expression=new PgDialect().sqlToQuery(check.value).sql;
 assert.ok(expression.includes("= 'create'"));assert.ok(expression.includes('"before_version" = 0'));assert.ok(expression.includes('"after_version" = 1'));
 assert.ok(expression.includes("<> 'create'"));assert.ok(expression.includes('"before_version" > 0'));
});
test('return reason is persisted in audit and constrained independently of mutable report state',()=>{
 assert.ok(cfg(proposal.proposedReportAudit).columns.some(c=>c.name==='reason'));
 const check=cfg(proposal.proposedReportAudit).checks.find(c=>c.name==='report_audit_reason_valid');assert.ok(check);
 const expression=new PgDialect().sqlToQuery(check.value).sql;
 assert.ok(expression.includes("= 'return'"));assert.ok(expression.includes('IS NOT NULL'));assert.ok(expression.includes("<> 'return'"));
});
