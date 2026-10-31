import 'server-only';
import {randomUUID} from 'node:crypto';
import {assessmentScoreWritesEnabled} from '@/lib/academics/assessment-score-staging-policy';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { getLocalStagingDatabase, localStagingRuntimeConfig } from '@/server/academics/report-card-staging-connection';
import { createStagingReportRuntime } from '@/lib/academics/report-card-staging-runtime';
import { executeStagingReportBoundary } from '@/lib/academics/report-card-staging-command-boundary';
import { loadCompleteAssessmentInScope } from '@/lib/academics/assessment-postgres-canonical-reader';
import { stagingReportSqlScope } from '@/lib/academics/report-card-sql-scope';
import { stagingSelector, stagingUiEnabled, stagingSchoolId } from '@/lib/academics/report-card-staging-ui';
import { projectAssessmentEditor } from '@/lib/accounts/staging-operations';
import type { StagingDashboardData } from '@/lib/accounts/staging-dashboard';
import type { AssessmentEditorView } from '@/lib/accounts/staging-operations';
export async function readStagingAssessmentEditor(role:'admin'|'teacher'|'bursar',classKey:string,directory:StagingDashboardData):Promise<AssessmentEditorView|null>{
 if(!stagingUiEnabled(process.env)||role==='bursar'||!directory.classes.some(c=>c.key===classKey))return null;
 const selector=stagingSelector(classKey);if(!selector)return null;
 try{
  const identity=await resolveVerifiedReportCardIdentity();if(!identity||identity.schoolId!==stagingSchoolId||identity.role!==role)return null;
  const runtime=createStagingReportRuntime(getLocalStagingDatabase(),localStagingRuntimeConfig),scope=stagingReportSqlScope(localStagingRuntimeConfig);
  const result=await executeStagingReportBoundary(runtime,identity,(db,verified,authority)=>db.begin(async tx=>{
   if(authority.role!==role)return{ok:false,code:'forbidden'}as const;
   const loaded=await loadCompleteAssessmentInScope(tx,scope,selector,verified);
   if(!loaded.ok)return{ok:false,code:'unavailable'}as const;
   const view=projectAssessmentEditor(loaded.input,directory,classKey);
   return view?{ok:true,view}as const:{ok:false,code:'unavailable'}as const;
  }));return result.ok?{...result.view,canSave:assessmentScoreWritesEnabled(process.env),readToken:randomUUID()}:null;
 }catch{return null;}
}
