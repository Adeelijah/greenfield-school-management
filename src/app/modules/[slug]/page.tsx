import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { findModule, moduleDescriptions, moduleNames, slugFor } from '@/lib/modules';
export function generateStaticParams(){return moduleNames.filter(name=>name!=='Dashboard').map(name=>({slug:slugFor(name)}))}
export default async function ModulePage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;const name=findModule(slug);if(!name||name==='Dashboard')notFound();
 return <AppShell><div className="page-heading"><div><h1>{name}</h1><p>{moduleDescriptions[name]}</p></div></div>
 <section className="card" style={{maxWidth:780}}>
 <h2>{name} workspace</h2>
 <p style={{fontSize:13,lineHeight:1.8,color:'var(--muted)'}}>The navigation route is ready. This module will be implemented using the approved Greenfield V26 design and connected to secure school records in a later milestone.</p>
 <p className="muted">No student, staff or payment records are stored or processed yet.</p>
 <Link className="primary" style={{display:'inline-block',marginTop:16}} href="/">Return to Dashboard</Link>
 </section></AppShell>
}
