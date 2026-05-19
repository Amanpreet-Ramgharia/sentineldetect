'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/home'); router.refresh() }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, background:'#f97316', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.9rem', margin:'0 auto .75rem', boxShadow:'0 4px 16px rgba(249,115,22,.35)' }}>SD</div>
          <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', margin:0 }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></h1>
          <p style={{ fontSize:'.82rem', color:'var(--muted)', marginTop:'.3rem' }}>Sign in to your account</p>
        </div>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem', boxShadow:'0 4px 24px rgba(0,0,0,.15)' }}>
          <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
            {(['Email','Password'] as const).map((label, i) => (
              <div key={label} style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                <label style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</label>
                <input type={i===0?'email':'password'} value={i===0?email:password}
                  onChange={e => i===0?setEmail(e.target.value):setPassword(e.target.value)}
                  required placeholder={i===0?'you@company.com':'••••••••'}
                  autoComplete={i===0?'email':'current-password'}
                  style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }}
                  onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                  onBlur={e => e.target.style.borderColor='var(--border2)'}/>
              </div>
            ))}
            {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
            <button type="submit" disabled={loading} style={{ background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', marginTop:'.25rem' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
          <div style={{ marginTop:'1rem', display:'flex', flexDirection:'column', gap:'.3rem', textAlign:'center' }}>
            <Link href="/forgot-password" style={{ fontSize:'.78rem', color:'var(--muted)', textDecoration:'none' }}>Forgot password?</Link>
            <p style={{ fontSize:'.78rem', color:'var(--muted)', margin:0 }}>No account? <Link href="/signup" style={{ color:'#f97316', textDecoration:'none', fontWeight:600 }}>Create one free</Link></p>
          </div>
        </div>
      </div>
    </div>
  )
}
