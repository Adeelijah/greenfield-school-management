'use client';

import { useMemo, useState } from 'react';
import { ClipboardList, Printer, GraduationCap, LockKeyhole } from 'lucide-react';
import { initialAssessment, assessmentStudents, previewSchoolId } from '@/components/academics/calendar-assessment-fixtures';
import { prepareReportCard } from '@/lib/academics/report-cards';
import './report-card-workspace.css';

const roster = initialAssessment.enrollments.filter(e => !(e.studentId === 'student-early-years' && e.classId === 'class-primary-5-cedar'));
const demo = { ...initialAssessment, enrollments: roster };
const choices = [
  { id: 'student-amina', classId: 'class-primary-5-cedar', label: 'Amina Bello · Primary 5 Cedar' },
  { id: 'student-kofi', classId: 'class-primary-5-cedar', label: 'Kofi Mensah · Primary 5 Cedar' },
  { id: 'student-early-years', classId: 'class-creche-green', label: 'Early-years learner · Creche Green' },
];
const subjectNames: Record<string,string> = { 'subject-math': 'Mathematics', 'subject-literacy': 'Literacy', 'subject-discovery': 'Discovery & development' };
const attendance = { present: 56, total: 60 }; // Fictional illustration, not linked to attendance records.

export function ReportCardWorkspace() {
  const [studentId, setStudentId] = useState(choices[0]!.id);
  const [teacherRemark, setTeacherRemark] = useState('');
  const [headRemark, setHeadRemark] = useState('');
  const [showPrint, setShowPrint] = useState(false);
  const choice = choices.find(c => c.id === studentId) ?? choices[0]!;
  const student = assessmentStudents.find(s => s.id === studentId);
  const outcome = useMemo(() => prepareReportCard(demo, { schoolId: previewSchoolId, studentId, classId: choice.classId, sessionId: 'session-2026-27', termId: 'term-26-1' }), [studentId, choice.classId]);
  const card = outcome.ok ? outcome.card : null;
  const complete = card?.subjects.filter(s => s.complete).length ?? 0;
  return <main className="rc-workspace">
    <header className="rc-top">
      <div><div className="rc-eyebrow">ACADEMICS / STUDENT RESULTS</div><h1>Report cards</h1><p>Review term performance and prepare a clear, parent-friendly result sheet.</p></div>
      <span className="rc-demo"><LockKeyhole size={14}/> Fictional preview · not published</span>
    </header>
    <nav className="rc-tabs" aria-label="Report card sections"><span className="active">Student report</span><span>Approval & publishing · coming later</span></nav>
    <section className="rc-toolbar" aria-label="Report selection">
      <label>Student <select value={studentId} onChange={e => {setStudentId(e.target.value);setShowPrint(false);setTeacherRemark('');setHeadRemark('');}}>{choices.map(c=><option value={c.id} key={c.id}>{c.label}</option>)}</select></label>
      <div className="rc-context"><span>2026 / 2027</span><span>First term</span></div>
      <button type="button" className="rc-print" onClick={()=>setShowPrint(v=>!v)}><Printer size={16}/>{showPrint?'Back to workspace':'Print preview'}</button>
    </section>
    <div className={showPrint?'rc-layout print-view':'rc-layout'}>
      {!showPrint && <aside className="rc-summary">
        <div className="rc-panel"><div className="rc-panel-title"><GraduationCap size={18}/><h2>Student overview</h2></div><div className="rc-avatar">{student?.name.slice(0,1) ?? 'S'}</div><strong>{student?.name}</strong><p>{student?.admissionNumber}</p><div className="rc-detail"><span>Class</span><b>{choice.classId.includes('creche')?'Creche Green':'Primary 5 Cedar'}</b></div><div className="rc-detail"><span>Term</span><b>First term</b></div><div className="rc-detail"><span>Academic session</span><b>2026 / 2027</b></div></div>
        <div className="rc-panel"><div className="rc-panel-title"><ClipboardList size={18}/><h2>Completion</h2></div><div className="rc-stat"><strong>{complete} / {card?.subjects.length ?? 0}</strong><span>Subjects complete</span></div><div className="rc-progress"><span style={{width:`${card?.subjects.length ? complete/card.subjects.length*100 : 0}%`}}/></div><p className="rc-help">All subjects must be finalized before the card can be submitted for review.</p></div>
      </aside>}
      <section className="rc-paper" aria-label="Fictional report card">
        <div className="rc-paper-header"><div className="rc-school-icon"><GraduationCap size={23}/></div><div><div className="rc-school">GREENFIELD ACADEMY</div><small>Fictional school · student progress report</small></div><span className="rc-watermark">DRAFT</span></div>
        <div className="rc-paper-heading"><div><span className="rc-eyebrow">FIRST TERM · 2026 / 2027</span><h2>Student report card</h2><p>Learning progress and assessment summary</p></div><span className="rc-status">{card?.status === 'ready_for_review'?'Ready for review':'Incomplete'}</span></div>
        <div className="rc-info"><div><span>Student</span><strong>{student?.name}</strong></div><div><span>Admission number</span><strong>{student?.admissionNumber}</strong></div><div><span>Class</span><strong>{choice.classId.includes('creche')?'Creche Green':'Primary 5 Cedar'}</strong></div><div><span>Academic session</span><strong>2026 / 2027</strong></div></div>
        <div className="rc-section-heading"><h3>Academic performance</h3><span>{card?.subjects.length ?? 0} subjects</span></div>
        <div className="rc-table-wrap"><table className="rc-results"><thead><tr><th>Subject / area</th><th>Score</th><th>Grade / observation</th><th>Status</th></tr></thead><tbody>{card?.subjects.map(s=><tr key={s.subjectId}><td>{subjectNames[s.subjectId] ?? s.subjectId}</td><td>{s.result.total === null?'—':`${s.result.total}%`}</td><td>{s.result.grade ?? 'Awaiting results'}</td><td><span className={s.complete&&s.finalized?'rc-pill ready':'rc-pill'}>{s.complete?(s.finalized?'Finalized':'Draft'):'Incomplete'}</span></td></tr>)}</tbody></table></div>
        <div className="rc-section-heading"><h3>Attendance</h3><span>Fictional sample</span></div>
        <div className="rc-attendance"><div><strong>{attendance.total}</strong><span>School days</span></div><div><strong>{attendance.present}</strong><span>Days present</span></div><div><strong>{attendance.total-attendance.present}</strong><span>Days absent</span></div></div>
        <div className="rc-remarks"><div><h3>Class teacher&apos;s remark</h3>{showPrint?<p>{teacherRemark.trim() || 'Not entered'}</p>:<textarea aria-label="Class teacher remark" placeholder="Add a fictional draft remark…" value={teacherRemark} onChange={e=>setTeacherRemark(e.target.value)} rows={3}/>}</div><div><h3>Head teacher&apos;s remark</h3>{showPrint?<p>{headRemark.trim() || 'Not entered'}</p>:<textarea aria-label="Head teacher remark" placeholder="Add a fictional draft remark…" value={headRemark} onChange={e=>setHeadRemark(e.target.value)} rows={3}/>}</div></div>
        <footer className="rc-foot"><span>PREVIEW ONLY · NOT AN OFFICIAL RESULT</span><span>No approval, signature or publication recorded</span></footer>
      </section>
    </div>
    <p className="rc-disclaimer">This is a memory-only design preview. Attendance and remarks are fictional, are not saved, and must not be treated as verified records. Print preview does not approve or publish results.</p>
  </main>;
}
