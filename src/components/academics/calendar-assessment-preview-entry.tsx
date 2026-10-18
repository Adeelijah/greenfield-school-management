import { createRoot } from 'react-dom/client';
import { CalendarAssessmentWorkspace } from './calendar-assessment-workspace';

const mount=document.getElementById('greenfield-calendar-assessments');
if(!mount)throw new Error('Calendar and assessment preview mount is missing.');
createRoot(mount).render(<CalendarAssessmentWorkspace/>);
