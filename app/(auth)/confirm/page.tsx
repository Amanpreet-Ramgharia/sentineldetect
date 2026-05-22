'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function ConfirmContent() {
  const router      = useRouter()
  const params      = useSearchParams()
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function confirm() {
      const sb = createClient()
      const tokenHash = params.get('token_hash')
      const type      = params.get('type') as 'email' | 'recovery' | 'invite' | null
      const code      = params.get('code')

      try {
        if (code) {
          // PKCE flow
          const { error } = await sb.auth.exchangeCodeForSession(code)
          if (error) throw error
        } else if (tokenHash && type) {
          // OTP flow
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type })
          if (error) throw error
        } else {
          throw new Error('Invalid confirmation link')
        }

        setStatus('success')
        setMessage(type === 'recovery' ? 'password reset' : 'email confirmation')
        setTimeout(() => router.push('/home'), 3000)
      } catch (err: unknown) {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : 'Confirmation failed')
      }
    }
    confirm()
  }, [params, router])

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:420, textAlign:'center' }}>
        <div style={{ width:48, height:48, background:'#f97316', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'1rem', margin:'0 auto 1.5rem', boxShadow:'0 4px 16px rgba(249,115,22,.35)' }}>SD</div>

        {status === 'loading' && (
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'2.5rem 1.75rem' }}>
            <div style={{ width:36, height:36, border:'3px solid var(--border2)', borderTopColor:'#f97316', borderRadius:'50%', margin:'0 auto 1rem', animation:'spin .8s linear infinite' }}/>
            <div style={{ fontSize:'.95rem', fontWeight:600, color:'var(--text)' }}>Confirming your account...</div>
          </div>
        )}

        {status === 'success' && (
          <div style={{ background:'var(--bg4)', border:'1px solid var(--green-bd)', borderRadius:14, padding:'2.5rem 1.75rem' }}>
            <div style={{ width:52, height:52, background:'var(--green-bg)', border:'2px solid var(--green-bd)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', margin:'0 auto 1.25rem' }}>✓</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', marginBottom:'.5rem' }}>
              {message === 'password reset' ? 'Ready to reset' : 'Email confirmed!'}
            </div>
            <div style={{ fontSize:'.82rem', color:'var(--muted)', lineHeight:1.65, marginBottom:'1.5rem' }}>
              {message === 'password reset'
                ? 'You can now set your new password.'
                : 'Your account is verified and ready. Redirecting you to the dashboard...'}
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', fontSize:'.72rem', color:'var(--muted2)' }}>
              <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)' }}/>
              Redirecting in 3 seconds
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ background:'var(--bg4)', border:'1px solid var(--red-bd)', borderRadius:14, padding:'2.5rem 1.75rem' }}>
            <div style={{ width:52, height:52, background:'var(--red-bg)', border:'2px solid var(--red-bd)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.5rem', margin:'0 auto 1.25rem' }}>✕</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', marginBottom:'.5rem' }}>Link expired or invalid</div>
            <div style={{ fontSize:'.82rem', color:'var(--muted)', lineHeight:1.65, marginBottom:'1.5rem' }}>{message}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
              <Link href="/signup" style={{ padding:'.65rem', background:'#f97316', borderRadius:9, color:'#fff', textDecoration:'none', fontWeight:600, fontSize:'.88rem' }}>Create new account</Link>
              <Link href="/forgot-password" style={{ padding:'.65rem', border:'1px solid var(--border)', borderRadius:9, color:'var(--muted)', textDecoration:'none', fontSize:'.85rem' }}>Resend confirmation email</Link>
            </div>
          </div>
        )}

        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', color:'var(--muted)', fontSize:'.85rem' }}>
        Verifying...
      </div>
    }>
      <ConfirmContent/>
    </Suspense>
  )
}
