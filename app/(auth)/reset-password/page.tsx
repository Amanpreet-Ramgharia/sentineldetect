'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/supabase/client'

type Stage = 'checking' | 'ready' | 'expired' | 'success'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [stage, setStage] = useState<Stage>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [strength, setStrength] = useState(0)

  useEffect(() => {
    // Strategy 1: PKCE flow — middleware already exchanged the ?code= token.
    // By the time this runs, the session cookie should already be set.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStage('ready')
        return
      }
      // If no session yet, fall through to Strategy 2
    })

    // Strategy 2: Hash-based flow — Supabase fires PASSWORD_RECOVERY event
    // when it detects #access_token in the URL fragment (client-side only).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        setStage('ready')
      } else if (event === 'SIGNED_IN' && session && stage === 'checking') {
        // Covers PKCE flow firing async
        setStage('ready')
      }
    })

    // Give the above ~1.5s to resolve before declaring link expired
    const timeout = setTimeout(() => {
      setStage((prev) => (prev === 'checking' ? 'expired' : prev))
    }, 1500)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const checkStrength = (pwd: string) => {
    let score = 0
    if (pwd.length >= 8) score++
    if (pwd.length >= 12) score++
    if (/[A-Z]/.test(pwd)) score++
    if (/[0-9]/.test(pwd)) score++
    if (/[^A-Za-z0-9]/.test(pwd)) score++
    setStrength(score)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)

    // Route through /api/change-password so password history is checked
    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, isReset: true }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Failed to update password. Please try again.')
      setLoading(false)
      return
    }

    setStage('success')
    await supabase.auth.signOut()
    setTimeout(() => router.push('/login'), 3000)
  }

  const strengthLabel = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][strength]
  const strengthColor = ['', 'bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-blue-500', 'bg-green-500'][strength]

  // ── CHECKING ────────────────────────────────────────────────────────────────
  if (stage === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Verifying reset link…</p>
        </div>
      </div>
    )
  }

  // ── EXPIRED ──────────────────────────────────────────────────────────────────
  if (stage === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">⏰</div>
          <h1 className="text-xl font-semibold text-foreground">Reset link expired</h1>
          <p className="text-sm text-muted-foreground">
            Password reset links expire after 1 hour and can only be used once.
            Please request a fresh link.
          </p>
          <button
            onClick={() => router.push('/forgot-password')}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Request new reset link
          </button>
          <button
            onClick={() => router.push('/login')}
            className="w-full py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted transition-colors"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  // ── SUCCESS ──────────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center space-y-4">
          <div className="text-4xl">✅</div>
          <h1 className="text-xl font-semibold text-foreground">Password updated!</h1>
          <p className="text-sm text-muted-foreground">
            Your password has been changed successfully. Redirecting you to login…
          </p>
        </div>
      </div>
    )
  }

  // ── READY — show form ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">Set new password</h1>
          <p className="text-sm text-muted-foreground">
            Choose a strong password you haven&apos;t used before.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              New password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                checkStrength(e.target.value)
              }}
              placeholder="At least 8 characters"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {/* Strength bar */}
            {password.length > 0 && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i <= strength ? strengthColor : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strengthLabel}</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <label htmlFor="confirm" className="text-sm font-medium text-foreground">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your new password"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </div>
    </div>
  )
}
