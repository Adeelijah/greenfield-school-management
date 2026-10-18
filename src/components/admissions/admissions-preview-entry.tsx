import { createRoot } from 'react-dom/client';
import { AdmissionsGuardiansWorkspace } from './admissions-guardians-workspace';

const mount = document.getElementById('greenfield-admissions-guardians');
if (!mount) throw new Error('Admissions and guardian preview mount is missing.');
createRoot(mount).render(<AdmissionsGuardiansWorkspace />);
