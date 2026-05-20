'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent]       = useState(false)
  const [error, setError]     = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${"https://smartswingalerts.com"}/reset-password`,
    })
    if (error) { setError(error.message); setLoading(false) }
    else setSent(true)
  }

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
                style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit' }}
                onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                onBlur={e => e.target.style.borderColor='var(--border2)'}/>
              {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <Link href="/login" style={{ textAlign:'center', fontSize:'.78rem', color:'var(--muted)', textDecoration:'none' }}>Back to sign in</Link>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
