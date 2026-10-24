import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { stagingUiEnabled, stagingProxyDestination } from '@/lib/academics/report-card-staging-ui';

/** Dedicated local staging route gate; does not change normal application auth. */
export async function stagingProxy(request: NextRequest) {
  if (!stagingUiEnabled(process.env)) return new NextResponse(null, { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return new NextResponse(null, { status: 404 });
  let response = NextResponse.next({ request });
  response.headers.set('Cache-Control', 'private, no-store');
  const client = createServerClient(url, key, { cookies: {
    getAll() { return request.cookies.getAll(); },
    setAll(items: { name: string; value: string; options?: CookieOptions }[]) {
      items.forEach(({ name, value }) => request.cookies.set(name, value));
      response = NextResponse.next({ request });
      response.headers.set('Cache-Control', 'private, no-store');
      items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
    },
  } });
  let authenticated = false;
  try { const result = await client.auth.getUser(); authenticated = !!result.data.user && !result.error; } catch { authenticated = false; }
  const destination = stagingProxyDestination(request.nextUrl.pathname, authenticated);
  if (!destination) return response;
  const target = request.nextUrl.clone(); target.pathname = destination; target.search = '';
  const redirected = NextResponse.redirect(target);
  response.cookies.getAll().forEach(cookie => redirected.cookies.set(cookie));
  redirected.headers.set('Cache-Control', 'private, no-store');
  return redirected;
}
