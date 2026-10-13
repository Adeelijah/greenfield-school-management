import { redirect } from 'next/navigation';
import { GraduationCap, ShieldAlert } from 'lucide-react';
import { getVerifiedAuthUser } from '@/server/auth/identity';
import { getSchoolAccess } from '@/server/auth/authorization';
import { signOut } from '@/app/login/actions';

export const metadata = { title: 'Access pending | Greenfield Academy' };
export default async function AccessPending() {
  const user = await getVerifiedAuthUser();
  if (!user) redirect('/login');
  if (await getSchoolAccess()) redirect('/');
  return <main className="auth-screen"><section className="auth-card">
    <div className="auth-mark"><GraduationCap size={27}/></div>
    <p className="auth-eyebrow">GREENFIELD ACADEMY</p>
    <h1>Access pending</h1>
    <p className="auth-intro">Your sign-in is verified, but your account does not yet have one active school membership. Ask your school administrator to assign your account, or wait for initial school setup.</p>
    <div className="auth-error" role="status"><ShieldAlert size={17} style={{display:'inline',verticalAlign:'middle',marginRight:8}}/>No school workspace access has been granted.</div>
    <form action={signOut}><button className="auth-submit" style={{width:'100%'}} type="submit">Sign out</button></form>
  </section></main>;
}
