import type {AssessmentEditorView} from './staging-operations';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {parseAssessmentReviewCommand} from '../academics/assessment-review-command.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {stagingSelector} from '../academics/report-card-staging-ui.ts';
/** Presentation request construction only; the server derives current authority. */
export function buildAssessmentReview(editor:AssessmentEditorView,subject:AssessmentEditorView['subjects'][number],operationKey:string){
 const selected=stagingSelector(editor.classKey),status=subject.review;
 if(!editor.canReview||!selected||!editor.subjects.includes(subject)||!status||status.state==='finalized')return null;
 const common={...selected,rosterId:subject.id,expectedScopeRevision:editor.revision,operationKey};
 if(editor.reviewRole==='teacher'&&status.state==='unreviewed')return parseAssessmentReviewCommand({action:'review_subject',...common});
 if(editor.reviewRole==='admin'&&status.state==='reviewed'&&status.reviewId)return parseAssessmentReviewCommand({action:'finalize_subject',...common,teacherReviewId:status.reviewId});
 return null;
}
