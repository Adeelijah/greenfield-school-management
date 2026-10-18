import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function proxy(request: NextRequest) {
  if (
    process.env.NODE_ENV === 'development' &&
    request.nextUrl.pathname === '/dev-preview/students'
  ) {
    return NextResponse.next({ request });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase public URL and anon key must be configured');

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items: { name: string; value: string; options?: CookieOptions }[]) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user }, error } = await supabase.auth.getUser();
  const authenticated = Boolean(user && !error);
  const path = request.nextUrl.pathname;
  if (!authenticated && path !== '/login') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/login';
    destination.search = '';
    return NextResponse.redirect(destination);
  }
  if (authenticated && path === '/login') {
    const destination = request.nextUrl.clone();
    destination.pathname = '/';
    destination.search = '';
    return NextResponse.redirect(destination);
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico)$).*)'],
};
