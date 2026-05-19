'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function ResetForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [ready, setReady]       = useState(false)
  const [done, setDone]         = useState(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) { setError('Invalid reset link.'); return }
    createClient().auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) setError('Reset link expired. Please request a new one.')
      else setReady(true)
    })
  }, [searchParams])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false) }
    else { setDone(true); setTimeout(() => router.push('/home'), 2000) }
  }

  if (done) return <div style={{ textAlign:'center', padding:'1rem' }}><p style={{ fontWeight:600, color:'var(--text)' }}>Password updated! Redirecting...</p></div>
  if (!ready && !error) return <div style={{ textAlign:'center', padding:'1rem', color:'var(--muted)' }}>Verifying...</div>

  return (
    <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
      {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
      {['New password','Confirm password'].map((label, i) => (
        <div key={label} style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
          <label style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</label>
          <input type="password" value={i===0?password:confirm} onChange={e => i===0?setPassword(e.target.value):setConfirm(e.target.value)}
            required placeholder="Min 6 characters" disabled={!ready}
            style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit' }}
            onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
            onBlur={e => e.target.style.borderColor='var(--border2)'}/>
        </div>
      ))}
      <button type="submit" disabled={loading||!ready} style={{ background:loading||!ready?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading||!ready?'not-allowed':'pointer', fontFamily:'inherit' }}>
        {loading ? 'Updating...' : 'Set new password'}
      </button>
      {error?.includes('expired') && <Link href="/forgot-password" style={{ textAlign:'center', fontSize:'.78rem', color:'#f97316', textDecoration:'none' }}>Request new link</Link>}
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, background:'#f97316', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.9rem', margin:'0 auto .75rem' }}>SD</div>
          <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', margin:0 }}>Set new password</h1>
        </div>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem' }}>
          <Suspense fallback={<div style={{ textAlign:'center', color:'var(--muted)' }}>Loading...</div>}>
            <ResetForm/>
          </Suspense>
        </div>
      </div>
    </div>
  )
}
