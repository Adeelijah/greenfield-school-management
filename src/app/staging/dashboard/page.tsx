import { renderStagingStaffPage } from '@/server/accounts/staging-staff-page';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Staff dashboard | Greenfield staging', robots: { index: false, follow: false } };
export default async function Page() { return renderStagingStaffPage(); }
