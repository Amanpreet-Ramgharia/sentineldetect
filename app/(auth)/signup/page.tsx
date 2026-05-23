'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google'|'github'|null>(null)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) { setError(error.message); setLoading(false) }
    else setDone(true)
  }

  async function signInWithProvider(provider: 'google' | 'github') {
    setOauthLoading(provider); setError('')
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) { setError(error.message); setOauthLoading(null) }
  }

  const inpStyle: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }
  const oauthBtn: React.CSSProperties = { width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'.6rem', padding:'.7rem', borderRadius:9, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:'.85rem', cursor:'pointer', fontFamily:'inherit', fontWeight:500, transition:'border-color .2s' }

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
            <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* ── OAuth buttons ── */}
              <div style={{ display:'flex', flexDirection:'column', gap:'.6rem' }}>
                <button type="button" onClick={() => signInWithProvider('google')} disabled={!!oauthLoading} style={oauthBtn}>
                  <svg width="17" height="17" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                  {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
                </button>
                <button type="button" onClick={() => signInWithProvider('github')} disabled={!!oauthLoading} style={oauthBtn}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                  </svg>
                  {oauthLoading === 'github' ? 'Redirecting...' : 'Continue with GitHub'}
                </button>
              </div>

              {/* ── Divider ── */}
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                <span style={{ fontSize:'.72rem', color:'var(--muted2)', whiteSpace:'nowrap' }}>or sign up with email</span>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
              </div>

              {/* ── Email/password form ── */}
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
                <button type="submit" disabled={loading || !!oauthLoading} style={{ background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', marginTop:'.25rem' }}>
                  {loading ? 'Creating account...' : 'Create account'}
                </button>
                <p style={{ textAlign:'center', fontSize:'.78rem', color:'var(--muted)', margin:0 }}>
                  Already have an account? <Link href="/login" style={{ color:'#f97316', textDecoration:'none', fontWeight:600 }}>Sign in</Link>
                </p>
              </form>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
