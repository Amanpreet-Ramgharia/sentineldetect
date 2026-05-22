'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Tab = 'profile' | 'security' | 'activity' | 'data'
interface Factor { id: string; status: string }
interface Activity { id: string; action: string; provider: string | null; created_at: string; details: any }

const TABS: { id: Tab; label: string }[] = [
  { id:'profile',  label:'Profile'      },
  { id:'security', label:'Security'     },
  { id:'activity', label:'Activity'     },
  { id:'data',     label:'Data'         },
]

function Msg({ msg }: { msg: { text: string; type: 'ok'|'err' } | null }) {
  if (!msg) return null
  return (
    <div style={{ background: msg.type==='ok'?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${msg.type==='ok'?'var(--green-bd)':'var(--red-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.8rem', color: msg.type==='ok'?'var(--green)':'var(--red)', marginBottom:'1rem' }}>
      {msg.text}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [tab,       setTab]       = useState<Tab>('profile')
  const [user,      setUser]      = useState<any>(null)
  const [profile,   setProfile]   = useState<any>(null)
  const [factors,   setFactors]   = useState<Factor[]>([])
  const [activity,  setActivity]  = useState<Activity[]>([])
  const [rules,     setRules]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState<{ text:string; type:'ok'|'err' }|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const flash = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 5000)
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { router.push('/login'); return }
    setUser(user)

    const [profileRes, activityRes, rulesRes, mfaRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('usage_stats').select('*').eq('user_id', user.id).order('created_at', { ascending:false }).limit(20),
      sb.from('rules').select('id,title,platform,severity,created_at,mitre_id').eq('user_id', user.id).order('created_at', { ascending:false }),
      sb.auth.mfa.listFactors(),
    ])

    setProfile(profileRes.data)
    setActivity(activityRes.data || [])
    setRules(rulesRes.data || [])
    setFactors((mfaRes.data?.totp || []) as Factor[])
    setLoading(false)
  }

  // ── Avatar ──────────────────────────────────────────────
  async function uploadAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { flash('Avatar must be under 2MB', 'err'); return }
    const sb = createClient()
    const ext  = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await sb.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { flash(upErr.message, 'err'); return }
    const { data } = sb.storage.from('avatars').getPublicUrl(path)
    await sb.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', user.id)
    flash('Avatar updated')
    load()
  }

  async function removeAvatar() {
    const sb = createClient()
    await sb.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    flash('Avatar removed')
    load()
  }

  // ── Name ─────────────────────────────────────────────────
  const [nameVal,    setNameVal]    = useState('')
  const [editingName,setEditingName]= useState(false)
  useEffect(() => { if (user) setNameVal(user.user_metadata?.full_name || '') }, [user])

  async function saveName() {
    const sb = createClient()
    await Promise.all([
      sb.auth.updateUser({ data: { full_name: nameVal.trim() } }),
      sb.from('profiles').update({ full_name: nameVal.trim() }).eq('id', user.id),
    ])
    flash('Name updated')
    setEditingName(false); load()
  }

  // ── Email change ─────────────────────────────────────────
  const [newEmail,     setNewEmail]     = useState('')
  const [changingEmail,setChangingEmail]= useState(false)

  async function requestEmailChange() {
    if (!newEmail.includes('@')) { flash('Enter a valid email', 'err'); return }
    setChangingEmail(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${window.location.origin}/auth/confirm` }
    )
    if (error) { flash(error.message, 'err') }
    else { flash('Confirmation sent to both emails — click both links to complete the change') }
    setChangingEmail(false); setNewEmail('')
  }

  // ── Password ─────────────────────────────────────────────
  const [pw,      setPw]      = useState({ next:'', confirm:'' })
  const [savingPw,setSavingPw]= useState(false)

  async function changePassword(e: React.FormEvent) {
    e.preventDefault()
    if (pw.next.length < 8) { flash('Password must be at least 8 characters', 'err'); return }
    if (pw.next !== pw.confirm) { flash('Passwords do not match', 'err'); return }
    setSavingPw(true)
    const { error } = await createClient().auth.updateUser({ password: pw.next })
    if (error) flash(error.message, 'err')
    else { flash('Password updated'); setPw({ next:'', confirm:'' }) }
    setSavingPw(false)
  }

  // ── MFA ──────────────────────────────────────────────────
  const [mfaStep,    setMfaStep]    = useState<'idle'|'scan'>('idle')
  const [mfaQR,      setMfaQR]      = useState('')
  const [mfaSecret,  setMfaSecret]  = useState('')
  const [mfaId,      setMfaId]      = useState('')
  const [mfaCode,    setMfaCode]    = useState('')
  const [mfaBusy,    setMfaBusy]    = useState(false)

  async function enrollMFA() {
    setMfaBusy(true)
    const { data, error } = await createClient().auth.mfa.enroll({ factorType: 'totp' })
    if (error || !data) { flash(error?.message || 'Setup failed', 'err'); setMfaBusy(false); return }
    setMfaQR(data.totp.qr_code); setMfaSecret(data.totp.secret); setMfaId(data.id)
    setMfaStep('scan'); setMfaBusy(false)
  }

  async function verifyMFA() {
    if (mfaCode.length !== 6) return
    setMfaBusy(true)
    const sb = createClient()
    const { data: ch, error: ce } = await sb.auth.mfa.challenge({ factorId: mfaId })
    if (ce) { flash(ce.message, 'err'); setMfaBusy(false); return }
    const { error } = await sb.auth.mfa.verify({ factorId: mfaId, challengeId: ch.id, code: mfaCode })
    if (error) { flash('Invalid code — try again', 'err'); setMfaBusy(false); return }
    flash('MFA enabled'); setMfaStep('idle'); setMfaCode(''); setMfaBusy(false); load()
  }

  async function disableMFA(id: string) {
    if (!confirm('Disable MFA? Your account will rely on password only.')) return
    const { error } = await createClient().auth.mfa.unenroll({ factorId: id })
    if (error) { flash(error.message, 'err'); return }
    flash('MFA disabled'); load()
  }

  // ── Trusted devices ──────────────────────────────────────
  function getTrustedDevices(): { id: string; label: string; expiry: number }[] {
    try {
      const raw = localStorage.getItem(`sd_trusted_${user?.id}`)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function clearTrustedDevices() {
    localStorage.removeItem(`sd_trusted_${user?.id}`)
    flash('All trusted devices cleared — MFA will be required on next login')
    load()
  }

  const trustedDevices = user ? getTrustedDevices().filter(d => d.expiry > Date.now()) : []

  // ── Notifications ────────────────────────────────────────
  const prefs = profile?.notification_preferences || { weekly_digest: false, cisa_alerts: false }

  async function togglePref(key: string) {
    const sb = createClient()
    const updated = { ...prefs, [key]: !prefs[key] }
    await sb.from('profiles').update({ notification_preferences: updated }).eq('id', user.id)
    flash(`${key === 'weekly_digest' ? 'Weekly digest' : 'CISA KEV alerts'} ${!prefs[key] ? 'enabled' : 'disabled'}`)
    load()
  }

  // ── Export ───────────────────────────────────────────────
  function exportJSON() {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `sentineldetect-rules-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash(`Exported ${rules.length} rules as JSON`)
  }

  function exportCSV() {
    const headers = ['Title','MITRE ID','Platform','Severity','Created']
    const rows    = rules.map(r => [
      `"${(r.title||'').replace(/"/g,'""')}"`,
      r.mitre_id || '',
      r.platform || '',
      r.severity || '',
      new Date(r.created_at).toLocaleDateString(),
    ])
    const csv  = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `sentineldetect-rules-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    flash(`Exported ${rules.length} rules as CSV`)
  }

  // ── OAuth ────────────────────────────────────────────────
  async function signInWithProvider(provider: 'google' | 'github') {
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/confirm` },
    })
    if (error) flash(error.message, 'err')
  }

  // ── Usage stats ──────────────────────────────────────────
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0,0,0,0)
  const monthlyActivity = activity.filter(a => new Date(a.created_at) >= thisMonth)
  const byAction: Record<string,number>   = {}
  const byProvider: Record<string,number> = {}
  monthlyActivity.forEach(a => {
    byAction[a.action]               = (byAction[a.action]||0) + 1
    if (a.provider) byProvider[a.provider] = (byProvider[a.provider]||0) + 1
  })

  // ── Delete account ───────────────────────────────────────
  const [deleteVal, setDeleteVal] = useState('')
  async function deleteAccount() {
    if (deleteVal !== user?.email) { flash('Type your email to confirm', 'err'); return }
    await createClient().auth.signOut()
    router.push('/login?deleted=1')
  }

  // ── Initials fallback ────────────────────────────────────
  const name    = user?.user_metadata?.full_name || user?.email || 'U'
  const initials = name.split(' ').map((w: string) => w[0]).slice(0,2).join('').toUpperCase()

  const inp: React.CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.6rem .85rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }
  const fo  = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'rgba(249,115,22,.5)'
  const bl  = (e: React.FocusEvent<HTMLInputElement>) => e.target.style.borderColor = 'var(--border2)'
  const btn = (on: boolean, danger = false): React.CSSProperties => ({
    padding:'.52rem 1rem', border:'none', borderRadius:8, fontFamily:'inherit', fontSize:'.8rem', fontWeight:600,
    cursor: on?'pointer':'not-allowed',
    background: danger ? (on?'var(--red)':'var(--red-bg)') : (on?'#f97316':'var(--muted2)'),
    color: danger ? (on?'#fff':'var(--red)') : '#fff',
  })
  const oBtn: React.CSSProperties = { padding:'.52rem 1rem', border:'1px solid var(--border)', borderRadius:8, background:'var(--bg)', color:'var(--muted)', fontSize:'.8rem', cursor:'pointer', fontFamily:'inherit' }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--muted)', fontSize:'.85rem' }}>Loading...</div>

  return (
    <div style={{ padding:'1.5rem', maxWidth:740, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:'1.1rem', marginBottom:'1.75rem' }}>
        <div style={{ position:'relative' }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt={initials}
              style={{ width:60, height:60, borderRadius:'50%', objectFit:'cover', border:'2px solid var(--border)' }}/>
          ) : (
            <div style={{ width:60, height:60, borderRadius:'50%', background:'#f97316', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.1rem', fontWeight:700, color:'#fff', border:'2px solid var(--border)' }}>
              {initials}
            </div>
          )}
          <button onClick={() => fileRef.current?.click()}
            style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%', background:'var(--bg4)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.65rem' }}
            title="Change photo">
            +
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={uploadAvatar} style={{ display:'none' }}/>
        </div>
        <div>
          <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)' }}>{name}</div>
          <div style={{ fontSize:'.78rem', color:'var(--muted)' }}>{user?.email}</div>
          <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:'.15rem', fontFamily:'monospace' }}>
            {rules.length} rules · Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-GB',{month:'short',year:'numeric'}) : '—'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'1.25rem', gap:'.15rem' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding:'.55rem 1rem', background:'none', border:'none', borderBottom: tab===t.id ? '2px solid #f97316' : '2px solid transparent', color: tab===t.id ? '#f97316' : 'var(--muted)', fontSize:'.82rem', fontWeight: tab===t.id ? 600 : 400, cursor:'pointer', fontFamily:'inherit', marginBottom:-1 }}>
            {t.label}
          </button>
        ))}
      </div>

      <Msg msg={msg}/>

      {/* ── PROFILE TAB ── */}
      {tab === 'profile' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Avatar */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.65rem' }}>Profile photo</div>
            <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" style={{ width:52, height:52, borderRadius:'50%', objectFit:'cover' }}/>
              ) : (
                <div style={{ width:52, height:52, borderRadius:'50%', background:'#f97316', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'#fff', fontSize:'1rem' }}>{initials}</div>
              )}
              <div style={{ display:'flex', gap:'.5rem' }}>
                <button onClick={() => fileRef.current?.click()} style={oBtn}>Upload photo</button>
                {profile?.avatar_url && <button onClick={removeAvatar} style={{ ...oBtn, color:'var(--red)', borderColor:'var(--red-bd)' }}>Remove</button>}
              </div>
            </div>
            <div style={{ fontSize:'.68rem', color:'var(--muted2)', marginTop:'.5rem' }}>JPG, PNG or WebP. Max 2MB. Shows in the sidebar.</div>
          </div>

          {/* Name */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.65rem' }}>Display name</div>
            {editingName ? (
              <div style={{ display:'flex', gap:'.5rem' }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)} style={inp}
                  autoFocus onFocus={fo} onBlur={bl}
                  onKeyDown={e => { if(e.key==='Enter') saveName(); if(e.key==='Escape') setEditingName(false) }}/>
                <button onClick={saveName} style={btn(true)}>Save</button>
                <button onClick={() => setEditingName(false)} style={oBtn}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontSize:'.88rem', color:'var(--text)' }}>{user?.user_metadata?.full_name || 'Not set'}</span>
                <button onClick={() => setEditingName(true)} style={oBtn}>Edit</button>
              </div>
            )}
          </div>

          {/* Email change */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>Email address</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.75rem' }}>
              Current: <strong style={{ color:'var(--text)' }}>{user?.email}</strong>
            </div>
            <div style={{ display:'flex', gap:'.5rem' }}>
              <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="New email address"
                type="email" style={inp} onFocus={fo} onBlur={bl}
                onKeyDown={e => e.key==='Enter' && requestEmailChange()}/>
              <button onClick={requestEmailChange} disabled={changingEmail || !newEmail} style={btn(!changingEmail && !!newEmail)}>
                {changingEmail ? 'Sending...' : 'Change'}
              </button>
            </div>
            <div style={{ fontSize:'.68rem', color:'var(--muted2)', marginTop:'.4rem' }}>
              A confirmation link will be sent to both your current and new email address.
            </div>
          </div>

          {/* Connected accounts */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>Connected accounts</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.75rem' }}>
              Link a Google or GitHub account to sign in without a password.
              Enable the provider in Supabase → Authentication → Providers first.
            </div>
            <div style={{ display:'flex', gap:'.65rem', flexWrap:'wrap' }}>
              <button onClick={() => signInWithProvider('google')}
                style={{ ...oBtn, display:'flex', alignItems:'center', gap:'.45rem' }}>
                <span style={{ fontSize:'.85rem' }}>G</span> Connect Google
              </button>
              <button onClick={() => signInWithProvider('github')}
                style={{ ...oBtn, display:'flex', alignItems:'center', gap:'.45rem' }}>
                <span style={{ fontSize:'.85rem' }}>GH</span> Connect GitHub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {tab === 'security' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Password */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.65rem' }}>Change password</div>
            <form onSubmit={changePassword} style={{ display:'flex', flexDirection:'column', gap:'.65rem' }}>
              {[['New password','next','Min 8 characters'],['Confirm password','confirm','Repeat new password']].map(([label,field,ph]) => (
                <div key={field}>
                  <div style={{ fontSize:'.7rem', color:'var(--muted)', marginBottom:'.3rem' }}>{label}</div>
                  <input type="password" value={(pw as any)[field]}
                    onChange={e => setPw(p => ({ ...p, [field]: e.target.value }))}
                    placeholder={ph} style={inp} onFocus={fo} onBlur={bl}/>
                </div>
              ))}
              {pw.next && (() => {
                const s = [pw.next.length>=8,/[A-Z]/.test(pw.next),/[0-9]/.test(pw.next),/[^A-Za-z0-9]/.test(pw.next)].filter(Boolean).length
                const c = ['var(--red)','#f97316','var(--blue)','var(--green)'][s-1]
                const l = ['Weak','Fair','Good','Strong'][s-1]
                return <div><div style={{ display:'flex', gap:3 }}>{[1,2,3,4].map(i=><div key={i} style={{ flex:1, height:3, borderRadius:2, background:i<=s?c:'var(--bg3)' }}/>)}</div><div style={{ fontSize:'.65rem', color:c, marginTop:'.2rem' }}>{l}</div></div>
              })()}
              <button type="submit" disabled={savingPw || !pw.next || !pw.confirm} style={btn(!savingPw && !!(pw.next && pw.confirm))}>
                {savingPw ? 'Updating...' : 'Update password'}
              </button>
            </form>
          </div>

          {/* MFA */}
          <div style={{ background:'var(--bg4)', border:`1px solid ${factors.some(f=>f.status==='verified') ? 'var(--green-bd)' : 'var(--border)'}`, borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.65rem' }}>
              <div>
                <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Two-factor authentication</div>
                <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:'.15rem' }}>
                  Works with Microsoft Authenticator, Google Authenticator, Authy, or any TOTP app
                </div>
              </div>
              {factors.some(f=>f.status==='verified') && (
                <span style={{ fontSize:'.65rem', padding:'.15rem .5rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', fontWeight:600 }}>Enabled</span>
              )}
            </div>
            {factors.some(f=>f.status==='verified') ? (
              <div>
                <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.65rem', lineHeight:1.6 }}>
                  To switch apps, disable and re-enroll. Your authenticator app is active.
                </div>
                {factors.filter(f=>f.status==='verified').map(f => (
                  <button key={f.id} onClick={() => disableMFA(f.id)}
                    style={{ padding:'.45rem .9rem', borderRadius:7, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Disable MFA
                  </button>
                ))}
              </div>
            ) : mfaStep === 'idle' ? (
              <button onClick={enrollMFA} disabled={mfaBusy} style={btn(!mfaBusy)}>
                {mfaBusy ? 'Setting up...' : 'Enable two-factor authentication'}
              </button>
            ) : (
              <div>
                <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:'.75rem', lineHeight:1.6 }}>
                  Open your authenticator app, tap "Add account" → "Scan QR code":
                </div>
                <div style={{ display:'flex', gap:'1.25rem', flexWrap:'wrap', marginBottom:'1rem' }}>
                  <img src={mfaQR} alt="QR" style={{ width:150, height:150, borderRadius:8, border:'4px solid #fff' }}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.7rem', color:'var(--muted)', marginBottom:'.35rem' }}>Or enter manually:</div>
                    <code style={{ fontSize:'.68rem', fontFamily:'monospace', background:'var(--bg)', padding:'.45rem .7rem', borderRadius:6, border:'1px solid var(--border)', display:'block', wordBreak:'break-all', color:'var(--text)', letterSpacing:'.04em' }}>{mfaSecret}</code>
                  </div>
                </div>
                <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:'.4rem' }}>Enter the 6-digit code:</div>
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    placeholder="000000" maxLength={6} autoFocus
                    style={{ ...inp, width:130, textAlign:'center', fontSize:'1.1rem', letterSpacing:'.2em', fontFamily:'monospace' }}
                    onFocus={fo} onBlur={bl} onKeyDown={e => e.key==='Enter' && verifyMFA()}/>
                  <button onClick={verifyMFA} disabled={mfaBusy || mfaCode.length!==6} style={btn(!mfaBusy && mfaCode.length===6)}>
                    {mfaBusy ? 'Verifying...' : 'Verify'}
                  </button>
                  <button onClick={() => { setMfaStep('idle'); setMfaCode('') }} style={oBtn}>Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Trusted devices */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>Trusted devices</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6, marginBottom:'.75rem' }}>
              Devices that have completed MFA are trusted for 30 days. The MFA step is skipped on trusted devices.
            </div>
            {trustedDevices.length === 0 ? (
              <div style={{ fontSize:'.78rem', color:'var(--muted2)' }}>No trusted devices. Complete MFA on sign-in to trust a device.</div>
            ) : (
              <div>
                <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.5rem' }}>{trustedDevices.length} trusted device{trustedDevices.length>1?'s':''}</div>
                {trustedDevices.map(d => (
                  <div key={d.id} style={{ fontSize:'.75rem', color:'var(--text2)', padding:'.35rem 0', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
                    <span>{d.label || 'Device'}</span>
                    <span style={{ color:'var(--muted2)', fontFamily:'monospace' }}>Expires {new Date(d.expiry).toLocaleDateString()}</span>
                  </div>
                ))}
                <button onClick={clearTrustedDevices} style={{ marginTop:'.65rem', ...oBtn, color:'var(--red)', borderColor:'var(--red-bd)' }}>
                  Clear all trusted devices
                </button>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--red-bd)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--red)', marginBottom:'.3rem' }}>Delete account</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6, marginBottom:'.75rem' }}>
              Permanently deletes your account, rules, and all data. Type your email to confirm.
            </div>
            <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
              <input value={deleteVal} onChange={e => setDeleteVal(e.target.value)} placeholder={user?.email}
                style={{ ...inp, flex:1, minWidth:200 }} onFocus={fo} onBlur={bl}/>
              <button onClick={deleteAccount} disabled={deleteVal !== user?.email} style={btn(deleteVal===user?.email, true)}>
                Delete account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY TAB ── */}
      {tab === 'activity' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Usage stats this month */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.75rem' }}>
              This month — {new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'})}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'.65rem', marginBottom:'1rem' }}>
              {[
                { n: monthlyActivity.length,                      label:'Actions'     },
                { n: monthlyActivity.filter(a=>a.action==='generate').length, label:'Rules generated' },
                { n: monthlyActivity.filter(a=>a.action==='improve').length,  label:'Improvements' },
                { n: monthlyActivity.filter(a=>a.action==='analyse').length,  label:'Logs analysed' },
              ].map((s,i) => (
                <div key={i} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, padding:'.75rem', textAlign:'center' }}>
                  <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#f97316' }}>{s.n}</div>
                  <div style={{ fontSize:'.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginTop:'.1rem' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {Object.keys(byProvider).length > 0 && (
              <div>
                <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.4rem' }}>AI provider usage</div>
                <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                  {Object.entries(byProvider).map(([p,n]) => (
                    <span key={p} style={{ fontSize:'.72rem', padding:'.2rem .6rem', borderRadius:5, background:'var(--blue-bg)', color:'var(--blue)', border:'1px solid var(--blue-bd)' }}>
                      {p}: {n as number}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity log */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Recent activity</div>
              <span style={{ fontSize:'.68rem', color:'var(--muted2)' }}>Last {activity.length} actions</span>
            </div>
            {activity.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>No activity yet</div>
            ) : activity.map(a => {
              const ACTION_LABELS: Record<string,string> = {
                generate: 'Generated rule',
                improve:  'Improved rule',
                convert:  'Converted rule',
                explain:  'Explained rule',
                analyse:  'Analysed log',
                sigma:    'Imported Sigma',
                validate: 'Validated rule',
                playbook: 'Generated playbook',
              }
              return (
                <div key={a.id} style={{ padding:'.6rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                  <div>
                    <div style={{ fontSize:'.78rem', color:'var(--text)' }}>{ACTION_LABELS[a.action] || a.action}</div>
                    {a.provider && <div style={{ fontSize:'.65rem', color:'var(--muted2)', fontFamily:'monospace' }}>via {a.provider}</div>}
                  </div>
                  <div style={{ fontSize:'.65rem', color:'var(--muted2)', fontFamily:'monospace', flexShrink:0 }}>
                    {new Date(a.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── DATA TAB ── */}
      {tab === 'data' && (
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Export */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>Export your data</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6, marginBottom:'.85rem' }}>
              Download all {rules.length} of your detection rules. Your data belongs to you.
            </div>
            <div style={{ display:'flex', gap:'.65rem', flexWrap:'wrap' }}>
              <button onClick={exportJSON} style={{ ...oBtn, display:'flex', alignItems:'center', gap:'.4rem' }}>
                Download JSON ({rules.length} rules)
              </button>
              <button onClick={exportCSV} style={{ ...oBtn, display:'flex', alignItems:'center', gap:'.4rem' }}>
                Download CSV ({rules.length} rules)
              </button>
            </div>
            <div style={{ fontSize:'.68rem', color:'var(--muted2)', marginTop:'.5rem' }}>
              JSON includes full rule content, descriptions, false positives, and IR steps.
              CSV includes title, MITRE ID, platform, severity, and date.
            </div>
          </div>

          {/* Notifications */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.65rem' }}>Email notifications</div>
            {[
              { key:'weekly_digest', label:'Weekly digest', desc:'Summary of your rules, coverage, and new detections every Monday' },
              { key:'cisa_alerts',  label:'CISA KEV alerts', desc:'Email when a new vulnerability is added to the CISA Known Exploited Vulnerabilities catalogue' },
            ].map(item => (
              <div key={item.key} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'.65rem 0', borderBottom:'1px solid var(--border)', gap:'1rem' }}>
                <div>
                  <div style={{ fontSize:'.82rem', color:'var(--text)', marginBottom:'.18rem' }}>{item.label}</div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', lineHeight:1.5 }}>{item.desc}</div>
                </div>
                <button onClick={() => togglePref(item.key)}
                  style={{ width:44, height:24, borderRadius:999, border:'none', cursor:'pointer', flexShrink:0, position:'relative', background: prefs[item.key] ? '#f97316' : 'var(--bg3)', transition:'background .2s' }}>
                  <div style={{ position:'absolute', top:3, left: prefs[item.key] ? 23 : 3, width:18, height:18, borderRadius:'50%', background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'left .2s' }}/>
                </button>
              </div>
            ))}
          </div>

          {/* Rule stats */}
          {rules.length > 0 && (
            <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.1rem' }}>
              <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.65rem' }}>Your rule library</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                {['Critical','High','Medium','Low'].map(sev => {
                  const n = rules.filter(r => r.severity === sev).length
                  if (!n) return null
                  const c: Record<string,string> = { Critical:'var(--red)', High:'var(--red)', Medium:'#f97316', Low:'var(--blue)' }
                  return (
                    <div key={sev} style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:c[sev], flexShrink:0 }}/>
                      <span style={{ fontSize:'.78rem', color:'var(--muted)', flex:1 }}>{sev}</span>
                      <span style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)', fontFamily:'monospace' }}>{n}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
