'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PROVIDERS = [
  { key:'gemini',       name:'Google Gemini',    placeholder:'AIzaSy...', info:'Free tier — 500 req/day, no credit card', link:'https://aistudio.google.com/app/apikey' },
  { key:'openai',       name:'OpenAI',           placeholder:'sk-...',    info:'Requires credits. gpt-4o-mini recommended', link:'https://platform.openai.com/api-keys' },
  { key:'anthropic',    name:'Anthropic Claude', placeholder:'sk-ant-...',info:'Requires credits. Haiku recommended', link:'https://console.anthropic.com/settings/keys' },
  { key:'groq',         name:'Groq',             placeholder:'gsk_...',   info:'Free tier — very fast inference', link:'https://console.groq.com/keys' },
  { key:'virustotal',   name:'VirusTotal',        placeholder:'...',       info:'Free tier — 500 lookups/day. Enriches IPs and hashes in Log Analyser', link:'https://www.virustotal.com/gui/my-apikey' },
  { key:'github',       name:'GitHub (Gist export)', placeholder:'ghp_...',  info:'Personal Access Token with gist scope. Lets you export rules directly to GitHub Gist', link:'https://github.com/settings/tokens/new?scopes=gist&description=SentinelDetect' },
]

interface StoredKey { provider: string; masked: string; created_at: string }
interface Factor { id: string; friendly_name: string; factor_type: string; status: string }

export default function SettingsPage() {
  const [keys,      setKeys]      = useState<StoredKey[]>([])
  const [inputs,    setInputs]    = useState<Record<string,string>>({})
  const [saving,    setSaving]    = useState<string|null>(null)
  const [deleting,  setDeleting]  = useState<string|null>(null)
  const [user,      setUser]      = useState<any>(null)
  const [profile,   setProfile]   = useState<any>(null)
  const [msg,       setMsg]       = useState<{ text:string; type:'ok'|'err' }|null>(null)

  // MFA state
  const [mfaFactors,   setMfaFactors]   = useState<Factor[]>([])
  const [mfaEnrolling, setMfaEnrolling] = useState(false)
  const [mfaStep,      setMfaStep]      = useState<'idle'|'scan'|'verify'>('idle')
  const [mfaQR,        setMfaQR]        = useState('')
  const [mfaSecret,    setMfaSecret]    = useState('')
  const [mfaFactorId,  setMfaFactorId]  = useState('')
  const [mfaCode,      setMfaCode]      = useState('')
  const [mfaVerifying, setMfaVerifying] = useState(false)

  const flash = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUser(user)
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    const { data } = await sb.from('user_api_keys').select('provider,api_key,created_at').eq('user_id', user.id)
    setKeys((data || []).map((k: any) => ({
      provider: k.provider,
      masked: k.api_key.substring(0, 8) + '••••••••' + k.api_key.slice(-4),
      created_at: k.created_at,
    })))
    // Load MFA factors
    const { data: mfa } = await sb.auth.mfa.listFactors()
    setMfaFactors((mfa?.totp || []) as Factor[])
  }

  async function saveKey(provider: string) {
    const key = (inputs[provider] || '').trim()
    if (!key) return
    setSaving(provider)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    const { error } = await sb.from('user_api_keys').upsert({ user_id: user.id, provider, api_key: key }, { onConflict: 'user_id,provider' })
    if (error) { flash(error.message, 'err'); setSaving(null); return }
    setInputs(prev => ({ ...prev, [provider]: '' }))
    flash(`${PROVIDERS.find(p => p.key === provider)?.name} key saved`)
    setSaving(null); load()
  }

  async function deleteKey(provider: string) {
    if (!confirm(`Remove your ${provider} API key?`)) return
    setDeleting(provider)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    await sb.from('user_api_keys').delete().eq('user_id', user.id).eq('provider', provider)
    setDeleting(null); load()
  }

  async function enrollMFA() {
    setMfaEnrolling(true)
    const sb = createClient()
    const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp' })
    if (error || !data) { flash(error?.message || 'MFA enroll failed', 'err'); setMfaEnrolling(false); return }
    setMfaQR(data.totp.qr_code)
    setMfaSecret(data.totp.secret)
    setMfaFactorId(data.id)
    setMfaStep('scan')
    setMfaEnrolling(false)
  }

  async function verifyMFA() {
    if (!mfaCode || mfaCode.length !== 6) { flash('Enter the 6-digit code from your authenticator app', 'err'); return }
    setMfaVerifying(true)
    const sb = createClient()
    const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId: mfaFactorId })
    if (cErr) { flash(cErr.message, 'err'); setMfaVerifying(false); return }
    const { error } = await sb.auth.mfa.verify({ factorId: mfaFactorId, challengeId: challenge.id, code: mfaCode })
    if (error) { flash('Invalid code — check your authenticator app', 'err'); setMfaVerifying(false); return }
    flash('MFA enabled successfully')
    setMfaStep('idle'); setMfaCode(''); setMfaVerifying(false); load()
  }

  async function disableMFA(factorId: string) {
    if (!confirm('Disable MFA? Your account will be less secure.')) return
    const sb = createClient()
    const { error } = await sb.auth.mfa.unenroll({ factorId })
    if (error) { flash(error.message, 'err'); return }
    flash('MFA disabled')
    load()
  }

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const name = (e.target as any).full_name?.value
    await sb.from('profiles').update({ full_name: name }).eq('id', user.id)
    flash('Profile updated')
    load()
  }

  const inp: React.CSSProperties = { flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit' }
  const sBtn = (active: boolean): React.CSSProperties => ({ padding:'.45rem .9rem', borderRadius:7, border:'none', background:active?'#f97316':'var(--muted2)', color:'#fff', fontSize:'.78rem', fontWeight:600, cursor:active?'pointer':'not-allowed', fontFamily:'inherit', flexShrink:0 })

  const mfaEnabled = mfaFactors.some(f => f.status === 'verified')

  return (
    <div style={{ padding:'1.5rem', maxWidth:800, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Settings</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Manage your API keys, security, and account preferences</p>
      </div>

      {msg && (
        <div style={{ background:msg.type==='ok'?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${msg.type==='ok'?'var(--green-bd)':'var(--red-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.8rem', color:msg.type==='ok'?'var(--green)':'var(--red)', marginBottom:'1.25rem' }}>
          {msg.text}
        </div>
      )}

      {/* MFA */}
      <div style={{ background:'var(--bg4)', border:`1px solid ${mfaEnabled ? 'var(--green-bd)' : 'var(--border)'}`, borderRadius:14, overflow:'hidden', marginBottom:'1.25rem' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'.5rem' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.2rem' }}>
              <span style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>Multi-Factor Authentication</span>
              {mfaEnabled && <span style={{ fontSize:'.62rem', padding:'.1rem .45rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', fontWeight:600 }}>Enabled</span>}
            </div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)' }}>
              {mfaEnabled ? 'Your account is protected with TOTP authentication.' : 'Add an extra layer of security using Google Authenticator or similar.'}
            </div>
          </div>
          {!mfaEnabled && mfaStep === 'idle' && (
            <button onClick={enrollMFA} disabled={mfaEnrolling} style={sBtn(!mfaEnrolling)}>
              {mfaEnrolling ? 'Setting up...' : 'Enable MFA'}
            </button>
          )}
        </div>

        {mfaEnabled && mfaFactors.map(f => (
          <div key={f.id} style={{ padding:'.75rem 1.1rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <div style={{ fontSize:'.82rem', fontWeight:500, color:'var(--text)' }}>Authenticator app (TOTP)</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted2)' }}>Active</div>
            </div>
            <button onClick={() => disableMFA(f.id)}
              style={{ padding:'.35rem .8rem', borderRadius:7, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>
              Disable
            </button>
          </div>
        ))}

        {mfaStep === 'scan' && (
          <div style={{ padding:'1.1rem', borderTop:'1px solid var(--border)' }}>
            <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.75rem' }}>Step 1 — Scan this QR code with your authenticator app</div>
            <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start', flexWrap:'wrap' }}>
              <img src={mfaQR} alt="MFA QR Code" style={{ width:160, height:160, borderRadius:8, border:'4px solid #fff' }}/>
              <div style={{ flex:1, minWidth:200 }}>
                <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.5rem' }}>
                  Scan with Google Authenticator, Authy, or any TOTP app. Or enter the secret manually:
                </div>
                <code style={{ fontSize:'.72rem', fontFamily:'monospace', background:'var(--bg)', padding:'.45rem .75rem', borderRadius:6, border:'1px solid var(--border)', display:'block', wordBreak:'break-all', color:'var(--text)', marginBottom:'1rem' }}>
                  {mfaSecret}
                </code>
                <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.4rem' }}>Step 2 — Enter the 6-digit code from your app</div>
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <input value={mfaCode} onChange={e => setMfaCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    placeholder="000000" maxLength={6} style={{ ...inp, flex:'none', width:130, textAlign:'center', fontSize:'1.1rem', letterSpacing:'.2em', fontFamily:'monospace' }}
                    onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                    onBlur={e => e.target.style.borderColor='var(--border2)'}
                    onKeyDown={e => e.key==='Enter' && verifyMFA()}/>
                  <button onClick={verifyMFA} disabled={mfaVerifying || mfaCode.length !== 6} style={sBtn(mfaCode.length === 6 && !mfaVerifying)}>
                    {mfaVerifying ? 'Verifying...' : 'Verify and enable'}
                  </button>
                  <button onClick={() => { setMfaStep('idle'); setMfaQR(''); setMfaCode('') }}
                    style={{ padding:'.45rem .9rem', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* API Keys */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:'1.25rem' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)', background:'rgba(249,115,22,.04)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)', marginBottom:'.2rem' }}>Your API Keys</div>
          <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.5 }}>
            Add your own API keys — rules use your key so you control usage and costs.
            Get a free Gemini key to get started.
          </div>
        </div>
        {PROVIDERS.map(prov => {
          const stored = keys.find(k => k.provider === prov.key)
          return (
            <div key={prov.key} style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem' }}>
                <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>{prov.name}</span>
                {stored && <span style={{ fontSize:'.6rem', padding:'.1rem .45rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', fontWeight:600 }}>Saved</span>}
              </div>
              <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.5rem' }}>
                {prov.info} · <a href={prov.link} target="_blank" rel="noopener" style={{ color:'#f97316', textDecoration:'none' }}>Get key</a>
              </div>
              {stored ? (
                <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
                  <code style={{ fontSize:'.72rem', fontFamily:'monospace', color:'var(--muted2)', background:'var(--bg)', padding:'.2rem .5rem', borderRadius:4, border:'1px solid var(--border)' }}>{stored.masked}</code>
                  <button onClick={() => deleteKey(prov.key)} disabled={deleting===prov.key}
                    style={{ fontSize:'.7rem', padding:'.2rem .55rem', borderRadius:5, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit' }}>
                    {deleting===prov.key ? '...' : 'Remove'}
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', gap:'.5rem' }}>
                  <input type="password" value={inputs[prov.key]||''} onChange={e => setInputs(prev => ({ ...prev, [prov.key]: e.target.value }))}
                    placeholder={prov.placeholder} style={inp}
                    onKeyDown={e => e.key==='Enter' && saveKey(prov.key)}
                    onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                    onBlur={e => e.target.style.borderColor='var(--border2)'}/>
                  <button onClick={() => saveKey(prov.key)} disabled={saving===prov.key || !(inputs[prov.key]||'').trim()} style={sBtn(!!(inputs[prov.key]||'').trim() && saving!==prov.key)}>
                    {saving===prov.key ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
        <div style={{ padding:'.75rem 1.1rem', background:'rgba(99,102,241,.04)' }}>
          <div style={{ fontSize:'.72rem', color:'var(--muted)', lineHeight:1.55 }}>
            No key saved? Rules use the platform key shared with all users. Add your own for dedicated, higher rate limits.
          </div>
        </div>
      </div>

      {/* Profile */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>Profile</div>
        </div>
        <form onSubmit={updateProfile} style={{ padding:'1rem 1.1rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.3rem' }}>Email</div>
            <div style={{ fontSize:'.85rem', color:'var(--text2)', padding:'.5rem .8rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:7, opacity:.7 }}>{user?.email}</div>
          </div>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.3rem' }}>Full name</div>
            <input name="full_name" defaultValue={profile?.full_name||''} placeholder="Your name"
              style={{ ...inp, width:'100%' }}
              onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
              onBlur={e => e.target.style.borderColor='var(--border2)'}/>
          </div>
          <button type="submit" style={{ alignSelf:'flex-start', padding:'.5rem 1.1rem', background:'#f97316', border:'none', borderRadius:8, color:'#fff', fontSize:'.82rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Save changes
          </button>
        </form>
      </div>
    </div>
  )
}
