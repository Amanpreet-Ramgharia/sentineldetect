import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

interface Props {
  searchParams: Promise<{
    code?: string
    token_hash?: string
    type?: string
    next?: string
    error?: string
    error_description?: string
  }>
}

export default async function AuthConfirmPage({ searchParams }: Props) {
  const params = await searchParams
  const { code, token_hash, type, next, error, error_description } = params

  // Provider returned an error (user denied access, etc.)
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error_description || error)}`)
  }

  const supabase = await createClient()

  // ── PKCE flow: Google OAuth, GitHub OAuth, magic link ────────────────────────
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (exchangeError) {
      // Code expired or already used
      redirect(`/login?error=${encodeURIComponent(exchangeError.message)}`)
    }

    // Exchange succeeded — session cookies are now set in the response.
    // DO NOT call getUser() here: the session was written to the response cookies,
    // not the request cookies, so getUser() would return null and wrongly redirect
    // to login. Just redirect — middleware will validate on the next request.
    if (type === 'recovery') redirect('/reset-password')
    redirect(next ?? '/home')
  }

  // ── OTP / token_hash flow: email confirmation, older recovery links ──────────
  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })

    if (otpError) {
      redirect(`/login?error=${encodeURIComponent(otpError.message)}`)
    }

    if (type === 'recovery') redirect('/reset-password')
    redirect(next ?? '/home')
  }

  // No code or token — malformed URL
  redirect('/login')
}
