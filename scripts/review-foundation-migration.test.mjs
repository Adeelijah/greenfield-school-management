import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewFoundationSql } from './review-foundation-migration.mjs';

const journal = { entries: [{ tag: '0000_broad_slayback' }] };
test('detects composite FK before its unique backing index', () => {
  const sql = [
    'ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_school_student_fk" FOREIGN KEY ("school_id","student_id") REFERENCES "public"."students"("school_id","id");',
    'CREATE UNIQUE INDEX "sessions_school_id_id_unique" ON "academic_sessions" ("school_id","id");',
    'CREATE UNIQUE INDEX "classes_school_id_id_unique" ON "classes" ("school_id","id");',
    'CREATE UNIQUE INDEX "guardians_school_id_id_unique" ON "guardians" ("school_id","id");',
    'CREATE UNIQUE INDEX "students_school_id_id_unique" ON "students" ("school_id","id");',
  ].join('--> statement-breakpoint');
  const result = reviewFoundationSql(sql, journal);
  assert.equal(result.compositeFkBeforeUniqueIndexes, true);
  assert.equal(result.readyToApply, false);
});
test('reports missing indexes and journal entry', () => {
  const result = reviewFoundationSql('', { entries: [] });
  assert.equal(result.readyToApply, false);
  assert.equal(result.missingIndexes.length, 4);
  assert.equal(result.journalHasFoundation, false);
});
