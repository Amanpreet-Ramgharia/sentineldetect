'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const TURNSTILE_SITE_KEY = '0x4AAAAAADWqjSibMwElOEvG'

declare global {
  interface Window {
    turnstile: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; 'error-callback': () => void; theme: string; size: string }) => string
      reset: (id: string) => void
    }
  }
}

export default function ForgotPasswordPage() {
  const [email,        setEmail]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [sent,         setSent]         = useState(false)
  const [error,        setError]        = useState('')
  const [captchaToken, setCaptchaToken] = useState('')
  const [captchaReady, setCaptchaReady] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetId     = useRef<string>('')

  useEffect(() => {
    const SCRIPT_ID = 'cf-turnstile-script'
    if (document.getElementById(SCRIPT_ID)) { renderWidget(); return }
    const script  = document.createElement('script')
    script.id     = SCRIPT_ID
    script.src    = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
    script.async  = true
    script.defer  = true
    script.onload = renderWidget
    document.head.appendChild(script)
  }, [])

  function renderWidget() {
    if (!turnstileRef.current || !window.turnstile) return
    widgetId.current = window.turnstile.render(turnstileRef.current, {
      sitekey:            TURNSTILE_SITE_KEY,
      callback:           (t) => { setCaptchaToken(t); setCaptchaReady(true) },
      'expired-callback': ()  => { setCaptchaToken(''); setCaptchaReady(false) },
      'error-callback':   ()  => { setCaptchaToken(''); setCaptchaReady(false) },
      theme: 'auto',
      size:  'normal',
    })
  }

  function resetCaptcha() {
    setCaptchaToken(''); setCaptchaReady(false)
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!captchaToken) { setError('Please complete the verification below'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo:   `${window.location.origin}/auth/confirm?type=recovery`,
      captchaToken,
    })
    if (error) { setError(error.message); setLoading(false); resetCaptcha() }
    else setSent(true)
  }

  const inpStyle: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, background:'#f97316', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.9rem', margin:'0 auto .75rem' }}>SD</div>
          <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', margin:0 }}>Reset password</h1>
        </div>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem' }}>
          {sent ? (
            <div style={{ textAlign:'center' }}>
              <p style={{ fontWeight:600, color:'var(--text)', marginBottom:'.4rem' }}>Check your email</p>
              <p style={{ fontSize:'.8rem', color:'var(--muted)', lineHeight:1.6 }}>We sent a reset link to <strong>{email}</strong>.</p>
              <Link href="/login" style={{ display:'inline-block', marginTop:'1rem', fontSize:'.8rem', color:'#f97316', textDecoration:'none' }}>Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <p style={{ fontSize:'.82rem', color:'var(--muted)', margin:0 }}>Enter your email and we will send you a reset link.</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com"
                style={inpStyle}
                onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                onBlur={e  => e.target.style.borderColor='var(--border2)'}/>

              {/* Turnstile widget */}
              <div>
                <div ref={turnstileRef} />
                {!captchaReady && <p style={{ fontSize:'.72rem', color:'var(--muted)', margin:'.3rem 0 0' }}>Loading verification…</p>}
              </div>

              {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
              <button type="submit" disabled={loading || !captchaReady}
                style={{ background:(loading||!captchaReady)?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:(loading||!captchaReady)?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {loading ? 'Sending...' : !captchaReady ? 'Loading verification...' : 'Send reset link'}
              </button>
              <Link href="/login" style={{ textAlign:'center', fontSize:'.78rem', color:'var(--muted)', textDecoration:'none' }}>Back to sign in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
