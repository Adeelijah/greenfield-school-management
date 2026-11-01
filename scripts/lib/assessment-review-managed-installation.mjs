// Committed counterpart of the operator-proven, fixed-target rollback rehearsal.
import {assessmentReviewManagedRollbackReview} from './assessment-review-managed-review.mjs';
export function assessmentReviewManagedInstallation(){
 const rehearsal=assessmentReviewManagedRollbackReview(),boundary='\nROLLBACK;\n';
 if(rehearsal.sql.split(boundary).length!==2)throw Error('Expected one review rehearsal transaction boundary');
 const verified=rehearsal.sql.slice(0,rehearsal.sql.indexOf(boundary)),body=verified.slice(verified.indexOf('\nBEGIN;'));
 const sql='-- Greenfield STAGING '+rehearsal.target.projectRef+' ONLY. COMMITTED REVIEW ROLE INSTALLATION.\n-- Same verified rehearsal body; no canonical workload inserts or password configuration.\n'+body+"\nCOMMIT;\nSELECT jsonb_build_object('assessment_review_managed_installation','PASS','dedicated_roles',2,'existing_report_source_score_attendance_state_checked',true,'login_password_configured',false,'review_finalization_enabled',false) AS assessment_review_installation_result;\n";
 return{...rehearsal,sql};
}
