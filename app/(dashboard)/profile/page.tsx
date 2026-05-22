'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Factor { id: string; friendly_name: string; status: string }

const Section = ({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) => (
  <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:'1.1rem' }}>
    <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
      <div style={{ fontSize:'.9rem', fontWeight:600, color:'var(--text)' }}>{title}</div>
      {desc && <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem' }}>{desc}</div>}
    </div>
    <div style={{ padding:'1.1rem' }}>{children}</div>
  </div>
)

export default function ProfilePage() {
  const router = useRouter()
  const [user,        setUser]        = useState<any>(null)
  const [profile,     setProfile]     = useState<any>(null)
  const [mfaFactors,  setMfaFactors]  = useState<Factor[]>([])
  const [loading,     setLoading]     = useState(true)
  const [msg,         setMsg]         = useState<{ text: string; type: 'ok'|'err' }|null>(null)

  // Name edit
  const [nameEdit,   setNameEdit]   = useState(false)
  const [nameVal,    setNameVal]    = useState('')
  const [savingName, setSavingName] = useState(false)

  // Password change
  const [pwForm,    setPwForm]    = useState({ current:'', next:'', confirm:'' })
  const [savingPw,  setSavingPw]  = useState(false)

  // MFA
  const [mfaStep,      setMfaStep]      = useState<'idle'|'scan'|'verify'>('idle')
  const [mfaQR,        setMfaQR]        = useState('')
  const [mfaSecret,    setMfaSecret]    = useState('')
  const [mfaFactorId,  setMfaFactorId]  = useState('')
  const [mfaCode,      setMfaCode]      = useState('')
  const [mfaLoading,   setMfaLoading]   = useState(false)

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting,      setDeleting]      = useState(false)

  const flash = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4500)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)
    setNameVal(user.user_metadata?.full_name || '')
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const { data: mfa } = await sb.auth.mfa.listFactors()
    setMfaFactors((mfa?.totp || []) as Factor[])
    setLoading(false)
  }

  async function saveName() {
    if (!nameVal.trim()) return
    setSavingName(true)
    const sb = createClient()
    await sb.auth.updateUser({ data: { full_name: nameVal.trim() } })
    await sb.from('profiles').update({ full_name: nameVal.trim() }).eq('id', user.id)
    flash('Name updated')
    setSavingName(false); setNameEdit(false); load()
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!pwForm.next || pwForm.next.length < 8) { flash('New password must be at least 8 characters', 'err'); return }
    if (pwForm.next !== pwForm.confirm) { flash('Passwords do not match', 'err'); return }
    setSavingPw(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password: pwForm.next })
    if (error) { flash(error.message, 'err'); setSavingPw(false); return }
    flash('Password updated successfully')
    setPwForm({ current:'', next:'', confirm:'' }); setSavingPw(false)
  }

  async function enrollMFA() {
    setMfaLoading(true)
    const sb = createClient()
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' })
    if (error || !data) { flash(error?.message || 'Setup failed', 'err'); setMfaLoading(false); return }
    setMfaQR(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaFactorId(data.id)
    setMfaStep('scan')
    setMfaLoading(false)
  }

  async function verifyMFA() {
    if (mfaCode.length !== 6) { flash('Enter the 6-digit code', 'err'); return }
    setMfaLoading(true)
    const sb = createClient()
    const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId: mfaFactorId })
    if (cErr) { flash(cErr.message, 'err'); setMfaLoading(false); return }
    const { error } = await sb.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode })
    if (error) { flash('Invalid code — check your authenticator app and try again', 'err'); setMfaLoading(false); return }
    flash('MFA enabled — your account is now protected')
    setMfaStep('idle'); setMfaCode(''); setMfaLoading(false); load()
  }

  async function disableMFA(factorId: string) {
    if (!confirm('Disable MFA? Your account will rely on password only.')) return
    setMfaLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.mfa.unenroll({ factorId })
    if (error) { flash(error.message, 'err'); setMfaLoading(false); return }
    flash('MFA disabled')
    setMfaLoading(false); load()
  }

  async function deleteAccount() {
    if (deleteConfirm !== user?.email) { flash('Type your email exactly to confirm', 'err'); return }
    setDeleting(true)
    // Note: actual deletion requires service role — this signs out and shows instructions
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login?deleted=1')
  }

  const inp: React.CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.6rem .85rem', color:'var(--text)', fontSize:'.83rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'rgba(249,115,22,.5)'
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'var(--border2)'
  const btn = (active: boolean, danger = false): React.CSSProperties => ({
    padding:'.55rem 1.1rem', border:'none', borderRadius:8,
    background: danger ? (active ? 'var(--red)' : 'var(--red-bg)') : (active ? '#f97316' : 'var(--muted2)'),
    color: danger ? (active ? '#fff' : 'var(--red)') : '#fff',
    fontSize:'.82rem', fontWeight:600, cursor: active ? 'pointer' : 'not-allowed', fontFamily:'inherit'
  })

  const mfaEnabled = mfaFactors.some(f => f.status === 'verified')

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--muted)', fontSize:'.85rem' }}>Loading profile...</div>
  )

  return (
    <div style={{ padding:'1.5rem', maxWidth:720, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Your Profile</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Manage your account details, security settings, and preferences</p>
      </div>

      {msg && (
        <div style={{ background: msg.type==='ok'?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${msg.type==='ok'?'var(--green-bd)':'var(--red-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.82rem', color: msg.type==='ok'?'var(--green)':'var(--red)', marginBottom:'1.25rem' }}>
          {msg.text}
        </div>
      )}

      {/* Personal Info */}
      <Section title="Personal Information" desc="Your name and email address">
        <div style={{ display:'flex', flexDirection:'column', gap:'.85rem' }}>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.35rem' }}>Full name</div>
            {nameEdit ? (
              <div style={{ display:'flex', gap:'.5rem' }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={inp}
                  onFocus={focus} onBlur={blur} autoFocus
                  onKeyDown={e => { if(e.key==='Enter') saveName(); if(e.key==='Escape') setNameEdit(false) }}/>
                <button onClick={saveName} disabled={savingName} style={btn(!savingName)}>
                  {savingName ? 'Saving...' : 'Save'}
                </button>
                <button onClick={() => { setNameEdit(false); setNameVal(user?.user_metadata?.full_name||'') }}
                  style={{ ...btn(true), background:'var(--bg)', color:'var(--muted)', border:'1px solid var(--border)' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
                <span style={{ fontSize:'.88rem', color:'var(--text)', flex:1 }}>{user?.user_metadata?.full_name || 'Not set'}</span>
                <button onClick={() => setNameEdit(true)} style={{ fontSize:'.72rem', padding:'.28rem .65rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>Edit</button>
              </div>
            )}
          </div>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.35rem' }}>Email address</div>
            <div style={{ display:'flex', alignItems:'center', gap:'.75rem' }}>
              <span style={{ fontSize:'.88rem', color:'var(--text2)', flex:1 }}>{user?.email}</span>
              <span style={{ fontSize:'.62rem', padding:'.12rem .45rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', fontWeight:600 }}>Verified</span>
            </div>
            <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:'.3rem' }}>Email cannot be changed. Contact support if needed.</div>
          </div>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.35rem' }}>Member since</div>
            <div style={{ fontSize:'.88rem', color:'var(--text2)' }}>{user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : '—'}</div>
          </div>
        </div>
      </Section>

      {/* Change Password */}
      <Section title="Change Password" desc="Must be at least 8 characters">
        <form onSubmit={changePassword} style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {[
            ['New password',     'next',    'Min 8 characters'],
            ['Confirm password', 'confirm', 'Repeat new password'],
          ].map(([label, field, ph]) => (
            <div key={field}>
              <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.35rem' }}>{label}</div>
              <input type="password" value={(pwForm as any)[field]}
                onChange={e => setPwForm(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder={ph} required style={inp} onFocus={focus} onBlur={blur}/>
            </div>
          ))}
          {/* Password strength */}
          {pwForm.next && (() => {
            const s = [pwForm.next.length>=8, /[A-Z]/.test(pwForm.next), /[0-9]/.test(pwForm.next), /[^A-Za-z0-9]/.test(pwForm.next)].filter(Boolean).length
            const colors = ['var(--red)','#f97316','var(--blue)','var(--green)']
            const labels = ['Weak','Fair','Good','Strong']
            return (
              <div>
                <div style={{ display:'flex', gap:3 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=s?colors[s-1]:'var(--bg3)' }}/>)}
                </div>
                <div style={{ fontSize:'.65rem', color:colors[s-1], marginTop:'.2rem' }}>{labels[s-1]} password</div>
              </div>
            )
          })()}
          <button type="submit" disabled={savingPw || !pwForm.next || !pwForm.confirm} style={btn(!savingPw && !!(pwForm.next && pwForm.confirm))}>
            {savingPw ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </Section>

      {/* MFA */}
      <Section
        title="Two-Factor Authentication"
        desc="Works with Google Authenticator, Microsoft Authenticator, Authy, or any TOTP app">
        {mfaEnabled ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1rem' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--green-bg)', border:'1px solid var(--green-bd)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.85rem' }}>✓</div>
              <div>
                <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>MFA is enabled</div>
                <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>Your account is protected with an authenticator app</div>
              </div>
            </div>
            <div style={{ background:'rgba(249,115,22,.04)', border:'1px solid rgba(249,115,22,.15)', borderRadius:8, padding:'.75rem', fontSize:'.75rem', color:'var(--muted)', marginBottom:'1rem', lineHeight:1.6 }}>
              To switch authenticator apps, disable MFA below and re-enroll. You will need your current authenticator code to sign in before disabling.
            </div>
            {mfaFactors.filter(f=>f.status==='verified').map(f => (
              <button key={f.id} onClick={() => disableMFA(f.id)} disabled={mfaLoading}
                style={{ padding:'.5rem 1rem', borderRadius:8, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', fontSize:'.78rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                {mfaLoading ? 'Processing...' : 'Disable MFA'}
              </button>
            ))}
          </div>
        ) : mfaStep === 'idle' ? (
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1rem' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>!</div>
              <div>
                <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>MFA not enabled</div>
                <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>Add an extra layer of protection to your account</div>
              </div>
            </div>
            <button onClick={enrollMFA} disabled={mfaLoading} style={btn(!mfaLoading)}>
              {mfaLoading ? 'Setting up...' : 'Enable two-factor authentication'}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', marginBottom:'.75rem' }}>
              Step 1 — Scan this QR code
            </div>
            <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:'1rem', lineHeight:1.6 }}>
              Open <strong>Microsoft Authenticator</strong>, <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
              Tap "Add account" → "Scan QR code".
            </div>
            <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start', flexWrap:'wrap', marginBottom:'1.25rem' }}>
              <img src={mfaQR} alt="MFA QR Code" style={{ width:160, height:160, borderRadius:8, border:'4px solid #fff', flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.4rem' }}>Or enter this code manually:</div>
                <code style={{ fontSize:'.7rem', fontFamily:'monospace', background:'var(--bg)', padding:'.45rem .75rem', borderRadius:6, border:'1px solid var(--border)', display:'block', wordBreak:'break-all', color:'var(--text)', letterSpacing:'.05em' }}>
                  {mfaSecret}
                </code>
              </div>
            </div>
            <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem' }}>
              Step 2 — Enter the 6-digit code from your app
            </div>
            <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
              <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                placeholder="000000" maxLength={6} autoFocus
                style={{ ...inp, width:140, textAlign:'center', fontSize:'1.15rem', letterSpacing:'.2em', fontFamily:'monospace' }}
                onFocus={focus} onBlur={blur}
                onKeyDown={e => e.key==='Enter' && mfaCode.length===6 && verifyMFA()}/>
              <button onClick={verifyMFA} disabled={mfaLoading || mfaCode.length!==6} style={btn(mfaCode.length===6 && !mfaLoading)}>
                {mfaLoading ? 'Verifying...' : 'Verify and enable'}
              </button>
              <button onClick={() => { setMfaStep('idle'); setMfaCode('') }}
                style={{ padding:'.55rem .9rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Sessions */}
      <Section title="Active Sessions" desc="Sign out of all devices">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
          <div>
            <div style={{ fontSize:'.85rem', color:'var(--text)', marginBottom:'.2rem' }}>Current session</div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)' }}>{user?.email} · Last sign-in: {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Unknown'}</div>
          </div>
          <button onClick={async () => { await createClient().auth.signOut(); router.push('/login') }}
            style={{ padding:'.48rem .9rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
            Sign out all devices
          </button>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Danger Zone" desc="Permanent actions that cannot be undone">
        <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:10, padding:'1rem' }}>
          <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--red)', marginBottom:'.3rem' }}>Delete account</div>
          <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6, marginBottom:'.85rem' }}>
            Permanently deletes your account, all rules, teams, and data. This cannot be undone.
            Type your email address to confirm.
          </div>
          <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
            <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={user?.email} style={{ ...inp, flex:1, minWidth:200 }}
              onFocus={focus} onBlur={blur}/>
            <button onClick={deleteAccount} disabled={deleting || deleteConfirm !== user?.email}
              style={btn(deleteConfirm === user?.email && !deleting, true)}>
              {deleting ? 'Deleting...' : 'Delete my account'}
            </button>
          </div>
        </div>
      </Section>
    </div>
  )
}
