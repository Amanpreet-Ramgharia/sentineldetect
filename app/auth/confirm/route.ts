import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)

  const code         = searchParams.get('code')
  const token_hash   = searchParams.get('token_hash')
  const type         = searchParams.get('type') as EmailOtpType | null
  const next         = searchParams.get('next') ?? '/home'
  const error        = searchParams.get('error')
  const error_desc   = searchParams.get('error_description')

  // OAuth provider sent back an error (user denied access, etc.)
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error_desc || error)}`
    )
  }

  const supabase = await createClient()

  // ── PKCE flow: Google OAuth, GitHub OAuth, magic link ──────────────────────
  // Route Handlers (unlike Server Components) CAN set cookies, so
  // exchangeCodeForSession correctly writes the session here.
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
      )
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  // ── OTP / token_hash flow: email confirmation, older recovery links ─────────
  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type })

    if (otpError) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(otpError.message)}`
      )
    }

    if (type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    return NextResponse.redirect(`${origin}${next}`)
  }

  // No recognised params — malformed URL
  return NextResponse.redirect(`${origin}/login`)
}
