'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

function getDeviceId(): string {
  let id = localStorage.getItem('sd_device_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('sd_device_id', id) }
  return id
}

function isTrusted(userId: string): boolean {
  try {
    const raw = localStorage.getItem(`sd_trusted_${userId}`)
    if (!raw) return false
    const devices: { id: string; expiry: number }[] = JSON.parse(raw)
    const deviceId = getDeviceId()
    return devices.some(d => d.id === deviceId && d.expiry > Date.now())
  } catch { return false }
}

function trustDevice(userId: string) {
  try {
    const deviceId = getDeviceId()
    const raw = localStorage.getItem(`sd_trusted_${userId}`)
    const devices: { id: string; label: string; expiry: number }[] = raw ? JSON.parse(raw) : []
    const filtered = devices.filter(d => d.id !== deviceId && d.expiry > Date.now())
    filtered.push({ id: deviceId, label: navigator.userAgent.split('(')[1]?.split(')')[0]?.substring(0,40) || 'Browser', expiry: Date.now() + 30*24*60*60*1000 })
    localStorage.setItem(`sd_trusted_${userId}`, JSON.stringify(filtered))
  } catch { /* ignore */ }
}

export default function LoginPage() {
  const router = useRouter()
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode,     setMfaCode]     = useState('')
  const [mfaLoading,  setMfaLoading]  = useState(false)
  const [factorId,    setFactorId]    = useState('')
  const [userId,      setUserId]      = useState('')
  const [shouldTrust, setShouldTrust] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError('')
    const sb = createClient()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    const uid = data.user?.id || ''
    setUserId(uid)

    // Check MFA
    const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      // Check if this device is trusted
      if (isTrusted(uid)) {
        // Skip MFA — device is trusted
        router.push('/home'); router.refresh(); return
      }
      const { data: factors } = await sb.auth.mfa.listFactors()
      const totp = factors?.totp?.[0]
      if (totp) { setFactorId(totp.id); setMfaRequired(true); setLoading(false); return }
    }
    router.push('/home'); router.refresh()
  }

  async function verifyMFA(e: React.FormEvent) {
    e.preventDefault()
    if (mfaCode.length !== 6) return
    setMfaLoading(true); setError('')
    const sb = createClient()
    const { error } = await sb.auth.mfa.challengeAndVerify({ factorId, code: mfaCode })
    if (error) { setError('Invalid code — try again'); setMfaLoading(false); return }
    if (shouldTrust) trustDevice(userId)
    router.push('/home'); router.refresh()
  }

  const inp: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.65rem .9rem', color:'var(--text)', fontSize:'.85rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s', width:'100%' }
  const fo = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'rgba(249,115,22,.5)'
  const bl = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'var(--border2)'

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)', padding:'1rem' }}>
      <div style={{ width:'100%', maxWidth:400 }}>
        <div style={{ textAlign:'center', marginBottom:'2rem' }}>
          <div style={{ width:44, height:44, background:'#f97316', borderRadius:11, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.9rem', margin:'0 auto .75rem', boxShadow:'0 4px 16px rgba(249,115,22,.35)' }}>SD</div>
          <h1 style={{ fontSize:'1.35rem', fontWeight:700, color:'var(--text)', margin:0 }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></h1>
          <p style={{ fontSize:'.82rem', color:'var(--muted)', marginTop:'.3rem' }}>{mfaRequired ? 'Enter your authenticator code' : 'Sign in to your account'}</p>
        </div>

        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.75rem', boxShadow:'0 4px 24px rgba(0,0,0,.15)' }}>
          {!mfaRequired ? (
            <form onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                <label style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email" style={inp} onFocus={fo} onBlur={bl}/>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'.35rem' }}>
                <label style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" autoComplete="current-password" style={inp} onFocus={fo} onBlur={bl}/>
              </div>
              {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
              <button type="submit" disabled={loading} style={{ background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
              <div style={{ display:'flex', flexDirection:'column', gap:'.3rem', textAlign:'center' }}>
                <Link href="/forgot-password" style={{ fontSize:'.78rem', color:'var(--muted)', textDecoration:'none' }}>Forgot password?</Link>
                <p style={{ fontSize:'.78rem', color:'var(--muted)', margin:0 }}>No account? <Link href="/signup" style={{ color:'#f97316', textDecoration:'none', fontWeight:600 }}>Create one free</Link></p>
              </div>
            </form>
          ) : (
            <form onSubmit={verifyMFA} style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
              <div style={{ textAlign:'center', padding:'.25rem 0', fontSize:'.82rem', color:'var(--muted)', lineHeight:1.6 }}>
                Open your authenticator app and enter the 6-digit code for SentinelDetect.
              </div>
              <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000" maxLength={6} autoFocus
                style={{ ...inp, textAlign:'center', fontSize:'1.5rem', letterSpacing:'.35em', fontFamily:'monospace' }}
                onFocus={fo} onBlur={bl}/>
              {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)', textAlign:'center' }}>{error}</div>}
              <label style={{ display:'flex', alignItems:'center', gap:'.5rem', cursor:'pointer', fontSize:'.78rem', color:'var(--muted)' }}>
                <input type="checkbox" checked={shouldTrust} onChange={e => setShouldTrust(e.target.checked)}
                  style={{ width:14, height:14, accentColor:'#f97316' }}/>
                Trust this device for 30 days
              </label>
              <button type="submit" disabled={mfaLoading || mfaCode.length!==6}
                style={{ background:mfaCode.length===6&&!mfaLoading?'#f97316':'var(--muted2)', border:'none', borderRadius:9, padding:'.8rem', color:'#fff', fontWeight:700, fontSize:'.9rem', cursor:mfaCode.length===6&&!mfaLoading?'pointer':'not-allowed', fontFamily:'inherit' }}>
                {mfaLoading ? 'Verifying...' : 'Verify'}
              </button>
              <button type="button" onClick={() => { setMfaRequired(false); setMfaCode(''); setError('') }}
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.78rem', color:'var(--muted)', fontFamily:'inherit' }}>
                Back to sign in
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
