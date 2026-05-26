import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Redirect vercel.app preview URLs to the real domain
  const host = request.headers.get('host') ?? ''
  if (host.includes('vercel.app')) {
    const url = request.nextUrl.clone()
    url.host     = 'smartswingalerts.com'
    url.protocol = 'https'
    return NextResponse.redirect(url, 301)
  }

  // CRITICAL: Create Supabase client BEFORE any early returns.
  // This exchanges ?code= tokens (OAuth, email confirm) into session cookies.
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
            supabaseResponse.cookies.set(name, value, options as any)
          )
        },
      },
    }
  )

  // Always call getUser() — refreshes session and exchanges ?code= tokens
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes — no authentication required
  const publicPrefixes = [
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
    publicPrefixes.some(p =>
      pathname === p ||
      pathname.startsWith(p + '/') ||
      pathname.startsWith(p + '?')
    )

  // Send unauthenticated users to login (except on public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Send logged-in users away from login/signup to the app
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
