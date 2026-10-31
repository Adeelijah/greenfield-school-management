import type {AssessmentEditorView} from './staging-operations';
import type {SubjectScoreCommand} from '../academics/assessment-score-command';
// @ts-expect-error Explicit source extension for the offline Node runner.
import {parseSubjectScoreCommand} from '../academics/assessment-score-command.ts';
export function buildScoreSave(editor:AssessmentEditorView,subject:AssessmentEditorView['subjects'][number],values:Record<string,string>,reason:string,operationKey:string):SubjectScoreCommand|null{
 if(!editor.subjects.includes(subject)||!reason.trim())return null;
 const keys=new Set(subject.pupils.flatMap(p=>subject.components.map(c=>p.id+':'+c.id)));
 if(Object.keys(values).length!==keys.size||Object.keys(values).some(k=>!keys.has(k)))return null;
 return parseSubjectScoreCommand({action:'save_subject_scores',classKey:editor.classKey,rosterId:subject.id,configVersionId:subject.configVersionId,expectedConfigRevision:subject.configVersion,expectedRosterVersion:subject.rosterVersion,expectedScopeRevision:editor.revision,operationKey,reason,scores:subject.pupils.flatMap(p=>subject.components.map(c=>{const value=values[p.id+':'+c.id]??'';return{studentId:p.id,enrollmentId:p.enrollmentId,componentKey:c.id,expectedVersion:p.versions[c.id],numericScore:subject.mode==='numeric'&&value!==''?value:null,observationKey:subject.mode==='observational'&&value!==''?value:null};}))});
}
