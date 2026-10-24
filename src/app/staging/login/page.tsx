import { notFound } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { signInToStaging } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Staging sign in | Greenfield', robots: { index: false, follow: false } };

export default async function StagingLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!stagingUiEnabled(process.env)) notFound();
  const { error } = await searchParams;
  return <main className="auth-screen"><section className="auth-card" aria-labelledby="staging-login-title">
    <p className="auth-eyebrow">GREENFIELD STAGING</p>
    <h1 id="staging-login-title">Staff sign in</h1>
    <p className="auth-intro">Use your fictional staging staff account to test report cards.</p>
    {error && <p className="auth-error" role="alert">Unable to sign in. Check your staging account details and try again.</p>}
    <form action={signInToStaging} className="auth-form">
      <label htmlFor="staging-email">Email</label><div className="auth-input-wrap"><input id="staging-email" name="email" type="email" autoComplete="username" required maxLength={254} /></div>
      <label htmlFor="staging-password">Password</label><div className="auth-input-wrap"><input id="staging-password" name="password" type="password" autoComplete="current-password" required maxLength={4096} /></div>
      <button className="auth-submit" type="submit">Sign in to staging</button>
    </form>
    <p className="auth-footnote">Test environment only. This does not enable the school application.</p>
  </section></main>;
}
