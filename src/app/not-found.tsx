import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
export default function NotFound(){return <AppShell><div className="page-heading"><div><h1>Page not found</h1><p>The requested Greenfield page does not exist.</p></div></div><Link href="/" className="primary" style={{display:'inline-block'}}>Return to Dashboard</Link></AppShell>}
