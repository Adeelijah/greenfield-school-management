// Pure local-staging policy. The SQL routines remain the current-authority boundary.
// @ts-expect-error Explicit source extension for the offline Node runner.
import { stagingUiEnabled } from './report-card-staging-ui.ts';
export function validAssessmentReviewDatabaseUrl(value:unknown):value is string{
 if(typeof value!=='string')return false;
 try{const u=new URL(value);return u.protocol==='postgresql:'&&u.hostname==='aws-0-eu-west-1.pooler.supabase.com'&&u.port==='5432'&&u.pathname==='/postgres'&&u.username==='greenfield_assessment_review_app.hweoqkbgmzycyznrbvng'&&!!u.password&&!u.search&&!u.hash;}catch{return false;}
}
export function assessmentReviewWritesEnabled(env:Readonly<Record<string,string|undefined>>):boolean{return stagingUiEnabled(env)&&env.GREENFIELD_STAGING_ASSESSMENT_REVIEW==='FICTIONAL_STAGING_REVIEW_WRITES_ONLY';}
