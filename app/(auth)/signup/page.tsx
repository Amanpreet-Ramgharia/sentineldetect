'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/home` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  const inpStyle: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, background:'#f97316', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.9rem', margin:'0 auto .75rem', boxShadow:'0 4px 16px rgba(249,115,22,.35)' }}>SD</div>
          <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', margin:0 }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></h1>
          <p style={{ fontSize:'.82rem', color:'var(--muted)', marginTop:'.3rem' }}>Create your free account</p>
        </div>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem', boxShadow:'0 4px 24px rgba(0,0,0,.15)' }}>
          {done ? (
            <div style={{ textAlign:'center', padding:'1rem 0' }}>
              <p style={{ fontWeight:600, color:'var(--text)', marginBottom:'.4rem' }}>Check your email</p>
              <p style={{ fontSize:'.8rem', color:'var(--muted)', lineHeight:1.6 }}>
                We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then <Link href="/login" style={{ color:'#f97316' }}>sign in</Link>.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              {[['Full name','text',name,setName,'Your name'],['Email','email',email,setEmail,'you@company.com'],['Password','password',password,setPassword,'Min 6 characters']].map(([label, type, val, setter, ph]: any) => (
                <div key={label} style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                  <label style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>{label}</label>
                  <input type={type} value={val} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setter(e.target.value)} required placeholder={ph}
                    style={inpStyle}
                    onFocus={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor='rgba(249,115,22,.5)'}
                    onBlur={(e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor='var(--border2)'}/>
                  {type === 'password' && val && (() => {
                    const strength = [val.length >= 8, /[A-Z]/.test(val), /[0-9]/.test(val), /[^A-Za-z0-9]/.test(val)].filter(Boolean).length
                    const labels = ['Weak','Fair','Good','Strong']
                    const colors = ['var(--red)','#f97316','var(--blue)','var(--green)']
                    return (
                      <div style={{ marginTop:'.3rem' }}>
                        <div style={{ display:'flex', gap:3 }}>
                          {[1,2,3,4].map(i => <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=strength?colors[strength-1]:'var(--bg3)', transition:'all .2s' }}/>)}
                        </div>
                        <div style={{ fontSize:'.65rem', color:colors[strength-1], marginTop:'.2rem' }}>{labels[strength-1]} password{strength < 3 ? ' — add uppercase, numbers, or symbols' : ''}</div>
                      </div>
                    )
                  })()}
                </div>
              ))}
              {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', marginTop:'.25rem' }}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>
              <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--muted)', margin:0 }}>
                Already have an account? <Link href="/login" style={{ color:'#f97316', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
