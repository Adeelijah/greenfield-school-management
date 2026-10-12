import { GraduationCap, LockKeyhole, Mail } from 'lucide-react';
import { signIn } from './actions';

export const metadata = { title: 'Staff sign in | Greenfield Academy' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="auth-screen"><section className="auth-card" aria-labelledby="login-title">
    <div className="auth-mark"><GraduationCap size={27}/></div>
    <p className="auth-eyebrow">GREENFIELD ACADEMY</p>
    <h1 id="login-title">Welcome back</h1>
    <p className="auth-intro">Sign in to your school workspace with your staff account.</p>
    {error && <p className="auth-error" role="alert">{error === 'missing' ? 'Enter your email and password.' : 'Unable to sign in. Check your credentials and try again.'}</p>}
    <form action={signIn} className="auth-form">
      <label htmlFor="email">Work email</label>
      <div className="auth-input-wrap"><Mail size={18}/><input id="email" name="email" type="email" autoComplete="username" placeholder="you@school.edu.ng" required/></div>
      <label htmlFor="password">Password</label>
      <div className="auth-input-wrap"><LockKeyhole size={18}/><input id="password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required/></div>
      <button className="auth-submit" type="submit">Sign in to workspace</button>
    </form>
    <p className="auth-footnote">Accounts are provided by your school administrator. Contact your administrator if you need access.</p>
  </section></main>;
}
