import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export default async function proxy(request: NextRequest) {
  // Redirect vercel.app preview URLs to the real domain
  const host = request.headers.get('host') ?? ''
  if (host.includes('vercel.app')) {
    const url = request.nextUrl.clone()
    url.host     = 'smartswingalerts.com'
    url.protocol = 'https'
    return NextResponse.redirect(url, 301)
  }

  // CRITICAL: Must create Supabase client BEFORE any early returns so that
  // ?code= tokens (OAuth, email confirm) are exchanged via cookie.
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Always call getUser() — refreshes session and exchanges ?code= tokens
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes accessible without authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth',
    '/share',
    '/community',
  ]

  const isPublicRoute =
    pathname === '/' ||
    publicRoutes.some(route =>
      pathname === route ||
      pathname.startsWith(route + '/') ||
      pathname.startsWith(route + '?')
    )

  // Redirect unauthenticated users away from protected routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from login/signup
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
