import test from 'node:test';
import assert from 'node:assert/strict';
import { getTableConfig } from 'drizzle-orm/pg-core';
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
