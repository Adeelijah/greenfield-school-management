import { renderStagingStaffPage } from '@/server/accounts/staging-staff-page';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Attendance | Greenfield staging', robots: { index: false, follow: false } };
export default async function Page({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
 const query = await searchParams;
 return renderStagingStaffPage('attendance', query.class ?? 'all');
}
