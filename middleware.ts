import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // CRITICAL: Must create response first, then mutate cookies on it
  let supabaseResponse = NextResponse.next({ request })

  // CRITICAL: Create Supabase client BEFORE any early returns.
  // This is what exchanges the ?code= token from password-reset / email-confirm emails.
  // If you early-return before this, reset links will always appear "expired".
  // Add inside middleware(), as the FIRST thing after the function opens:
const host = request.headers.get('host') ?? ''
if (host.includes('vercel.app')) {
  const url = request.nextUrl.clone()
  url.host     = 'smartswingalerts.com'
  url.protocol = 'https'
  return NextResponse.redirect(url, 301)
}
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Always call getUser() — this triggers code exchange for ?code= params.
  // Do NOT remove this or add any early returns before it.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes that do NOT require authentication
  const publicRoutes = [
    '/login',
    '/signup',
    '/forgot-password',
    '/reset-password',
    '/auth',       // covers /auth/confirm and all /auth/* callbacks
    '/share',      // covers /share/[ruleId]
    '/community',
  ]

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(route + '/') ||
      pathname.startsWith(route + '?')
  )

  // Redirect unauthenticated users trying to access protected routes
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Optional: redirect already-logged-in users away from login/signup
  if (user && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  // CRITICAL: return supabaseResponse (not NextResponse.next()) so cookies are set
  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
