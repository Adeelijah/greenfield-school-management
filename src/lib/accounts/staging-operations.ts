import type { CompleteAssessmentSource } from '../academics/assessment-canonical-source';
import type { StagingDashboardData } from './staging-dashboard';
export type AssessmentEditorView = {
  classKey: string; classLabel: string; revision: number; canSave?: boolean; readToken?: string;
  subjects: { id: string; name: string; mode: 'numeric' | 'observational'; configVersion: number; configVersionId: string; rosterVersion: number; components: { id: string; label: string; maximum: number; weight: number; required: boolean }[]; observations: { value: string; label: string }[]; bands: { min: number; max: number; label: string }[];
    pupils: { id: string; enrollmentId: string; name: string; versions: Record<string,number>; values: Record<string,string> }[] }[];
};
/** Source has already passed complete relational materialization in the server
 * transaction; refuse stale directory/enrollment bindings rather than guess. */
export function projectAssessmentEditor(input: CompleteAssessmentSource, directory: StagingDashboardData, classKey: string): AssessmentEditorView | null {
  const klass = directory.classes.find(c=>c.key===classKey);
  const pupils = directory.records.filter(r=>r.classKey===classKey);
  if (!klass || pupils.length !== input.enrollments.length || pupils.some(p=>!input.enrollments.some(e=>e.id===p.enrollmentId && e.studentId===p.id))) return null;
  const subjects: AssessmentEditorView['subjects'] = [];
  for (const roster of input.roster) {
    const catalog = input.catalog.find(c=>c.id===roster.subjectId);
    const config = input.configs.find(c=>c.config.id===roster.configVersionId)?.config;
    if (!catalog || !config) return null;
    const rows = pupils.map(p=>({id:p.id,enrollmentId:p.enrollmentId,name:p.name,versions:Object.fromEntries(config.components.map(c=>[c.id,input.scores.find(s=>s.rosterId===roster.id && s.enrollmentId===p.enrollmentId && s.studentId===p.id && s.componentKey===c.id)?.version??0])),values:Object.fromEntries(config.components.map(c=>{
      const score=input.scores.find(s=>s.rosterId===roster.id && s.studentId===p.id && s.componentKey===c.id);
      return [c.id,score?.numericScore ?? score?.observationKey ?? ''];
    }))}));
    subjects.push({id:roster.id,name:catalog.name,mode:config.grading.mode,configVersion:config.version,configVersionId:config.id,rosterVersion:roster.rosterVersion,
      components:config.components.map(c=>({id:c.id,label:c.label,maximum:c.maximumScore,weight:c.weight,required:c.required})),
      observations:config.grading.mode==='observational'?config.grading.levels.map(l=>({value:l.id,label:l.label})):[],bands:config.grading.mode==='numeric'?config.grading.bands.map(b=>({min:b.min,max:b.max,label:b.label})):[],pupils:rows});
  }
  return {classKey,classLabel:klass.label,revision:input.scope.revision,subjects};
}
export function validateScoreEditorDraft(subject: AssessmentEditorView['subjects'][number], values: Record<string,string>): {ok:true}|{ok:false;message:string} {
  const expected = new Set(subject.pupils.flatMap(p=>subject.components.map(c=>p.id+':'+c.id)));
  if (Object.keys(values).some(k=>!expected.has(k))) return {ok:false,message:'Draft contains an unknown pupil or component.'};
  for(const p of subject.pupils)for(const c of subject.components){
    const raw=values[p.id+':'+c.id]??'';
    if(!raw.trim()){if(c.required)return{ok:false,message:`Enter ${c.label} for ${p.name}.`};continue;}
    if(subject.mode==='observational'){if(!subject.observations.some(o=>o.value===raw))return{ok:false,message:'Choose a configured observation.'};}
    else if(!/^\d+(?:\.\d{1,4})?$/.test(raw)||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>c.maximum)return{ok:false,message:`${c.label} must be between 0 and ${c.maximum}, with at most four decimal places.`};
  }
  return {ok:true};
}
export function validateAttendanceDraft(date:string, studentIds:readonly string[], marks:Record<string,string>, today:string):{ok:true}|{ok:false;message:string}{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date||date>today)return{ok:false,message:'Choose a valid date that is not in the future.'};
  if(!studentIds.length||new Set(studentIds).size!==studentIds.length||Object.keys(marks).length!==studentIds.length||Object.keys(marks).some(id=>!studentIds.includes(id)))return{ok:false,message:'Every active pupil needs exactly one mark.'};
  if(studentIds.some(id=>!['present','absent','late','excused'].includes(marks[id]??'')))return{ok:false,message:'Mark every pupil as present, absent, late or excused.'};
  return{ok:true};
}
