import { createRoot } from 'react-dom/client';
import { AcademicOperationsWorkspace } from './academic-operations-workspace';

const mount = document.getElementById('greenfield-academic-operations');
if (!mount) throw new Error('Academic operations preview mount is missing.');
createRoot(mount).render(<AcademicOperationsWorkspace />);
