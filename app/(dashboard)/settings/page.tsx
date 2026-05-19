'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const PROVIDERS = [
  { key: 'gemini',    name: 'Google Gemini',    placeholder: 'AIzaSy...',  info: 'Free tier — 500 req/day, no credit card', link: 'https://aistudio.google.com/app/apikey' },
  { key: 'openai',    name: 'OpenAI',           placeholder: 'sk-...',     info: 'Requires credits. gpt-4o-mini recommended', link: 'https://platform.openai.com/api-keys' },
  { key: 'anthropic', name: 'Anthropic Claude', placeholder: 'sk-ant-...', info: 'Requires credits. Haiku recommended', link: 'https://console.anthropic.com/settings/keys' },
  { key: 'groq',      name: 'Groq',             placeholder: 'gsk_...',    info: 'Free tier — very fast inference', link: 'https://console.groq.com/keys' },
]

interface StoredKey { provider: string; masked: string; created_at: string }

export default function SettingsPage() {
  const [keys,     setKeys]     = useState<StoredKey[]>([])
  const [inputs,   setInputs]   = useState<Record<string,string>>({})
  const [saving,   setSaving]   = useState<string|null>(null)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [success,  setSuccess]  = useState<string|null>(null)
  const [error,    setError]    = useState<string|null>(null)
  const [user,     setUser]     = useState<any>(null)
  const [profile,  setProfile]  = useState<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setUser(user)
    const { data: p } = await sb.from('profiles').select('*').eq('id', user.id).single()
    setProfile(p)
    // Load stored keys (masked — we only show last 4 chars)
    const { data } = await sb.from('user_api_keys').select('provider, api_key, created_at').eq('user_id', user.id)
    setKeys((data || []).map((k: any) => ({
      provider: k.provider,
      masked: k.api_key.substring(0, 8) + '••••••••' + k.api_key.slice(-4),
      created_at: k.created_at,
    })))
  }

  async function saveKey(provider: string) {
    const key = (inputs[provider] || '').trim()
    if (!key) return
    setSaving(provider); setError(null)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    const { error } = await sb.from('user_api_keys').upsert({
      user_id: user.id, provider, api_key: key,
    }, { onConflict: 'user_id,provider' })

    if (error) { setError(error.message); setSaving(null); return }
    setInputs(prev => ({ ...prev, [provider]: '' }))
    setSuccess(`${PROVIDERS.find(p=>p.key===provider)?.name} key saved`)
    setTimeout(() => setSuccess(null), 3000)
    setSaving(null)
    load()
  }

  async function deleteKey(provider: string) {
    if (!confirm(`Remove your ${provider} API key?`)) return
    setDeleting(provider)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    await sb.from('user_api_keys').delete().eq('user_id', user.id).eq('provider', provider)
    setDeleting(null)
    load()
  }

  async function updateProfile(e: React.FormEvent) {
    e.preventDefault()
    const sb = createClient()
    const name = (e.target as any).full_name?.value
    await sb.from('profiles').update({ full_name: name }).eq('id', user.id)
    setSuccess('Profile updated')
    setTimeout(() => setSuccess(null), 3000)
    load()
  }

  const inp: React.CSSProperties = { flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.8rem', outline:'none', fontFamily:'inherit' }
  const sBtn = (active: boolean): React.CSSProperties => ({ padding:'.45rem .9rem', borderRadius:7, border:'none', background: active ? '#f97316' : 'var(--muted2)', color:'#fff', fontSize:'.78rem', fontWeight:600, cursor: active ? 'pointer' : 'not-allowed', fontFamily:'inherit', flexShrink:0 })

  return (
    <div style={{ padding:'1.5rem', maxWidth:800, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}> Settings</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Manage your API keys and account preferences</p>
      </div>

      {(success || error) && (
        <div style={{ background: error ? 'var(--red-bg)' : 'var(--green-bg)', border:`1px solid ${error ? 'var(--red-bd)' : 'var(--green-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.8rem', color: error ? 'var(--red)' : 'var(--green)', marginBottom:'1.25rem' }}>
          {success || error}
        </div>
      )}

      {/* API Keys — BYOK */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', marginBottom:'1.25rem' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)', background:'rgba(249,115,22,.04)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)', marginBottom:'.2rem' }}> Your API Keys</div>
          <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.5 }}>
            Add your own API keys — rules are generated using your key so you control your own usage and costs.
            Keys are stored securely and only visible to you. Get at least one free key from Gemini to get started.
          </div>
        </div>

        {PROVIDERS.map(prov => {
          const stored = keys.find(k => k.provider === prov.key)
          return (
            <div key={prov.key} style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                <div style={{ flex:1, minWidth:200 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.25rem' }}>
                    <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>{prov.name}</span>
                    {stored && <span style={{ fontSize:'.6rem', padding:'.1rem .45rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', fontWeight:600 }}> Saved</span>}
                  </div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.5rem' }}>
                    {prov.info} · <a href={prov.link} target="_blank" rel="noopener" style={{ color:'#f97316', textDecoration:'none' }}>Get key</a>
                  </div>
                  {stored ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
                      <code style={{ fontSize:'.72rem', fontFamily:'var(--font-mono)', color:'var(--muted2)', background:'var(--bg)', padding:'.2rem .5rem', borderRadius:4, border:'1px solid var(--border)' }}>{stored.masked}</code>
                      <button onClick={() => deleteKey(prov.key)} disabled={deleting === prov.key}
                        style={{ fontSize:'.7rem', padding:'.2rem .55rem', borderRadius:5, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit' }}>
                        {deleting === prov.key ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:'.5rem' }}>
                      <input type="password" value={inputs[prov.key]||''} onChange={e => setInputs(prev=>({...prev,[prov.key]:e.target.value}))}
                        placeholder={prov.placeholder} style={inp}
                        onKeyDown={e => e.key === 'Enter' && saveKey(prov.key)}
                        onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                        onBlur={e => e.target.style.borderColor='var(--border2)'}/>
                      <button onClick={() => saveKey(prov.key)} disabled={saving === prov.key || !(inputs[prov.key]||'').trim()}
                        style={sBtn(!!(inputs[prov.key]||'').trim() && saving !== prov.key)}>
                        {saving === prov.key ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        <div style={{ padding:'.75rem 1.1rem', background:'rgba(99,102,241,.04)' }}>
          <div style={{ fontSize:'.72rem', color:'var(--muted)', lineHeight:1.55 }}>
             <strong style={{ color:'var(--text)' }}>No key saved?</strong> Rules will be generated using the platform key — shared with all users. Add your own key for dedicated usage and higher rate limits.
          </div>
        </div>
      </div>

      {/* Profile */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}> Profile</div>
        </div>
        <form onSubmit={updateProfile} style={{ padding:'1rem 1.1rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.3rem' }}>Email</div>
            <div style={{ fontSize:'.85rem', color:'var(--text2)', padding:'.5rem .8rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:7 }}>{user?.email}</div>
          </div>
          <div>
            <div style={{ fontSize:'.72rem', color:'var(--muted)', marginBottom:'.3rem' }}>Full name</div>
            <input name="full_name" defaultValue={profile?.full_name||''} placeholder="Your name" style={{ ...inp, width:'100%' }}
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
