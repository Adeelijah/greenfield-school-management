// Pure committed counterpart of the operator-proven fixed staging rehearsal.
import {assessmentScoreManagedRollbackReview} from './assessment-score-managed-review.mjs';
export function assessmentScoreManagedInstallation() {
 const rehearsal=assessmentScoreManagedRollbackReview();
 const boundary='\nROLLBACK;\n';
 if(rehearsal.sql.split(boundary).length!==2)throw new Error('Expected exactly one rehearsal transaction boundary');
 const verified=rehearsal.sql.slice(0,rehearsal.sql.indexOf(boundary));
 const header='-- Greenfield STAGING '+rehearsal.target.projectRef+' ONLY. COMMITTED INSTALLATION.\n-- Fictional score/replay probes roll back before preservation checks; no committed data changes.';
 const body=verified.slice(verified.indexOf('\nBEGIN;'));
 const sql=header+body+"\nCOMMIT;\nSELECT jsonb_build_object('assessment_score_managed_installation','PASS','dedicated_roles',3,'existing_report_source_attendance_state_checked',true,'login_password_configured',false,'assessment_save_enabled',false) AS assessment_score_installation_result;\n";
 return {...rehearsal,sql};
}
