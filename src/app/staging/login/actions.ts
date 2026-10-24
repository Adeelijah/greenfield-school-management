'use server';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';

export async function signInToStaging(form: FormData) {
  if (!stagingUiEnabled(process.env)) notFound();
  const email = form.get('email'), password = form.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password || email.length > 254 || password.length > 4096) redirect('/staging/login?error=invalid');
  let accepted = false;
  try {
    const client = await createSupabaseServerClient();
    const login = await client.auth.signInWithPassword({ email: email.trim(), password });
    const verified = login.error ? null : await client.auth.getUser();
    accepted = !!verified && !verified.error && !!verified.data.user;
  } catch { accepted = false; }
  if (!accepted) redirect('/staging/login?error=invalid');
  redirect('/staging/report-cards');
}

export async function signOutOfStaging() {
  if (!stagingUiEnabled(process.env)) notFound();
  const client = await createSupabaseServerClient();
  const result = await client.auth.signOut({ scope: 'local' });
  if (result.error) throw Error('Unable to close the staging session. Try again.');
  redirect('/staging/login');
}
