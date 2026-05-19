'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Template { id: string; label: string; text: string; created_at: string }

const BUILTIN = [
  { label:'LSASS Dump',       text:'Detect non-system processes accessing LSASS memory to steal credentials' },
  { label:'Kerberoasting',    text:'Detect Kerberoasting — RC4 encrypted TGS ticket requests for service accounts' },
  { label:'Password Spray',   text:'Detect password spray — single IP attempting auth against 20+ accounts in 5 minutes' },
  { label:'Ransomware',       text:'Detect ransomware — 50+ file renames per minute with shadow copy deletion' },
  { label:'PowerShell C2',    text:'Detect PowerShell using EncodedCommand or IEX to download and execute remote payloads' },
  { label:'DNS Tunnelling',   text:'Detect DNS tunnelling using unusually long queries to rare domains' },
]

export default function TemplatesPage() {
  const [custom,    setCustom]    = useState<Template[]>([])
  const [loading,   setLoading]   = useState(true)
  const [newLabel,  setNewLabel]  = useState('')
  const [newText,   setNewText]   = useState('')
  const [saving,    setSaving]    = useState(false)
  const [success,   setSuccess]   = useState('')
  const router = useRouter()

  useEffect(() => { load() }, [])

  async function load() {
    const sb = createClient()
    const { data } = await sb.from('custom_templates').select('*').order('created_at', { ascending: false })
    setCustom(data || [])
    setLoading(false)
  }

  async function saveTemplate() {
    if (!newLabel.trim() || !newText.trim()) return
    setSaving(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    await sb.from('custom_templates').insert({ user_id: user.id, label: newLabel.trim(), text: newText.trim() })
    setNewLabel(''); setNewText('')
    setSuccess('Template saved!')
    setTimeout(() => setSuccess(''), 2500)
    setSaving(false)
    load()
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Delete this template?')) return
    const sb = createClient()
    await sb.from('custom_templates').delete().eq('id', id)
    setCustom(prev => prev.filter(t => t.id !== id))
  }

  function useTemplate(text: string) {
    router.push('/generate?prefill=' + encodeURIComponent(text))
  }

  const inp: React.CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .8rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit' }
  const btn: React.CSSProperties = { padding:'.3rem .7rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.25rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}> Detection Templates</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Save your own templates alongside the built-in ones. Click any template to pre-fill the generator.</p>
      </div>

      {/* Create template */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.1rem', marginBottom:'1.5rem', display:'flex', flexDirection:'column', gap:'.65rem' }}>
        <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Save a custom template</div>
        {success && <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:7, padding:'.5rem .8rem', fontSize:'.78rem', color:'var(--green)' }}>{success}</div>}
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Template name (e.g. Pass the Ticket)" style={inp}/>
        <textarea value={newText} onChange={e => setNewText(e.target.value)} rows={3} placeholder="Detection scenario text to pre-fill..."
          style={{ ...inp, resize:'none', lineHeight:1.65 }}/>
        <button onClick={saveTemplate} disabled={saving || !newLabel.trim() || !newText.trim()}
          style={{ alignSelf:'flex-start', padding:'.5rem 1.1rem', background: (newLabel.trim() && newText.trim()) ? '#f97316' : 'var(--muted2)', border:'none', borderRadius:8, color:'#fff', fontSize:'.82rem', fontWeight:600, cursor:(newLabel.trim() && newText.trim()) ? 'pointer' : 'not-allowed', fontFamily:'inherit' }}>
          {saving ? 'Saving...' : '+ Save template'}
        </button>
      </div>

      {/* Custom templates */}
      {custom.length > 0 && (
        <div style={{ marginBottom:'1.5rem' }}>
          <div style={{ fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:'.65rem' }}>Your templates ({custom.length})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
            {custom.map(t => (
              <div key={t.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10, padding:'.8rem 1rem', display:'flex', alignItems:'flex-start', gap:'1rem' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.25rem' }}>{t.label}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6 }}>{t.text}</div>
                </div>
                <div style={{ display:'flex', gap:'.35rem', flexShrink:0 }}>
                  <button onClick={() => useTemplate(t.text)} style={{ ...btn, color:'#f97316', borderColor:'rgba(249,115,22,.3)', background:'rgba(249,115,22,.07)' }}>Use </button>
                  <button onClick={() => deleteTemplate(t.id)} style={{ ...btn, color:'var(--red)', borderColor:'var(--red-bd)', background:'var(--red-bg)' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Built-in templates */}
      <div>
        <div style={{ fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:'.65rem' }}>Built-in templates</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'.5rem' }}>
          {BUILTIN.map(t => (
            <div key={t.label} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10, padding:'.8rem 1rem', display:'flex', flexDirection:'column', gap:'.35rem' }}>
              <div style={{ fontSize:'.82rem', fontWeight:500, color:'var(--text)' }}>{t.label}</div>
              <div style={{ fontSize:'.72rem', color:'var(--muted)', lineHeight:1.5, flex:1 }}>{t.text.substring(0, 80)}...</div>
              <button onClick={() => useTemplate(t.text)} style={{ alignSelf:'flex-start', ...btn, color:'#f97316', borderColor:'rgba(249,115,22,.3)', background:'rgba(249,115,22,.07)', fontSize:'.68rem' }}>Use </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
