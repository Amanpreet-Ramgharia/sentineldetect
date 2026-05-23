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

  // If Supabase returned an error (e.g. expired link) show a helpful page
  if (error) {
    return <ConfirmError message={error_description || error} />
  }

  const supabase = await createClient()

  // PKCE flow — Google OAuth, GitHub OAuth, magic link, and newer email flows
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return <ConfirmError message={exchangeError.message} />
    }
  }

  // OTP / token_hash flow — older email confirmation and recovery links
  if (token_hash && type) {
    const { error: otpError } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as EmailOtpType,
    })
    if (otpError) {
      return <ConfirmError message={otpError.message} />
    }
  }

  // After exchange, check what we have and redirect accordingly
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Exchange failed silently — redirect to login with a message
    redirect('/login?error=confirmation_failed')
  }

  // Password recovery → go to reset-password (session is set, form will show)
  if (type === 'recovery') {
    redirect('/reset-password')
  }

  // Everything else (signup confirmation, OAuth, magic link) → go to app
  redirect(next ?? '/home')
}

// ── Error UI ─────────────────────────────────────────────────────────────────
function ConfirmError({ message }: { message: string }) {
  const isExpired =
    message.toLowerCase().includes('expired') ||
    message.toLowerCase().includes('invalid') ||
    message.toLowerCase().includes('already')

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 420,
        background: 'var(--bg4)',
        border: '1px solid var(--red-bd)',
        borderRadius: 16,
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
          {isExpired ? '⏰' : '⚠️'}
        </div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '.5rem' }}>
          {isExpired ? 'Link expired' : 'Confirmation failed'}
        </div>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {isExpired
            ? 'This link has expired or already been used. Please request a new one.'
            : message}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.65rem' }}>
          <a href="/forgot-password" style={{
            display: 'block',
            padding: '.65rem',
            borderRadius: 8,
            background: '#f97316',
            color: '#fff',
            fontSize: '.85rem',
            fontWeight: 600,
            textDecoration: 'none',
          }}>
            Request new link
          </a>
          <a href="/login" style={{
            display: 'block',
            padding: '.65rem',
            borderRadius: 8,
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            fontSize: '.85rem',
            textDecoration: 'none',
          }}>
            Back to login
          </a>
        </div>
      </div>
    </div>
  )
}
