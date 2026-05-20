'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ApiKey { id: string; name: string; key_preview: string; created_at: string; last_used_at: string | null }

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ position:'relative', marginBottom:'1rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg3)', padding:'.4rem .85rem', borderRadius:'8px 8px 0 0', borderBottom:'1px solid var(--border)' }}>
        <span style={{ fontSize:'.65rem', fontFamily:'monospace', color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'.07em' }}>{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ fontSize:'.68rem', padding:'.18rem .55rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ background:'var(--code-bg)', padding:'1rem', margin:0, fontFamily:'monospace', fontSize:'.75rem', color:'var(--code-text)', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word', borderRadius:'0 0 8px 8px' }}>{code}</pre>
    </div>
  )
}

export default function ApiDocsPage() {
  const [apiKeys,  setApiKeys]  = useState<ApiKey[]>([])
  const [keyName,  setKeyName]  = useState('')
  const [creating, setCreating] = useState(false)
  const [newKey,   setNewKey]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [msg,      setMsg]      = useState<{ text: string; type: 'ok'|'err' } | null>(null)

  useEffect(() => { loadKeys() }, [])

  async function loadKeys() {
    const sb = createClient()
    const { data } = await sb.from('sd_api_keys').select('*').order('created_at', { ascending: false })
    setApiKeys(data || [])
  }

  async function createKey() {
    if (!keyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/api-keys', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name: keyName.trim() }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setNewKey(data.key)
      setKeyName('')
      loadKeys()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to create key', type: 'err' })
    }
    setCreating(false)
  }

  async function deleteKey(id: string) {
    if (!confirm('Delete this API key? Any integrations using it will stop working.')) return
    setDeleting(id)
    const sb = createClient()
    await sb.from('sd_api_keys').delete().eq('id', id)
    setApiKeys(prev => prev.filter(k => k.id !== id))
    setDeleting(null)
  }

  const exampleCurl = `curl -X POST https://sentineldetect.vercel.app/api/v1/generate \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scenario": "Detect LSASS memory access by non-system processes",
    "platform": "Microsoft Sentinel (KQL)",
    "focus": "Credential Access"
  }'`

  const examplePython = `import requests

response = requests.post(
    "https://sentineldetect.vercel.app/api/v1/generate",
    headers={
        "Authorization": "Bearer YOUR_API_KEY",
        "Content-Type": "application/json"
    },
    json={
        "scenario": "Detect LSASS memory access by non-system processes",
        "platform": "Microsoft Sentinel (KQL)",
        "focus": "Credential Access"
    }
)

rule = response.json()["rule"]
print(rule["title"])   # Detection rule title
print(rule["rule"])    # The KQL query
print(rule["mitre_id"])  # e.g. T1003.001`

  const exampleResponse = `{
  "rule": {
    "id": "uuid",
    "title": "LSASS Memory Access by Non-System Process",
    "mitre_id": "T1003.001",
    "mitre_name": "LSASS Memory",
    "tactic": "Credential Access",
    "severity": "High",
    "confidence": 92,
    "platform": "Microsoft Sentinel (KQL)",
    "rule": "DeviceProcessEvents | where ...",
    "description": "...",
    "false_positives": ["..."],
    "tuning_tips": ["..."],
    "response_steps": ["..."]
  },
  "model_used": "gemini-3.1-flash-lite"
}`

  const inp: React.CSSProperties = { flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>API Access</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>
          Use the SentinelDetect REST API to generate detection rules programmatically from your own tools, scripts, or CI/CD pipelines.
        </p>
      </div>

      {msg && (
        <div style={{ background: msg.type==='ok'?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${msg.type==='ok'?'var(--green-bd)':'var(--red-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.8rem', color: msg.type==='ok'?'var(--green)':'var(--red)', marginBottom:'1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Key management */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', marginBottom:'1.5rem' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)', marginBottom:'.2rem' }}>Your API keys</div>
          <div style={{ fontSize:'.75rem', color:'var(--muted)' }}>Keys grant full access to your account — keep them secret. Never commit them to Git.</div>
        </div>

        {/* New key */}
        <div style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', gap:'.65rem' }}>
            <input value={keyName} onChange={e => setKeyName(e.target.value)} placeholder='Key name (e.g. "CI pipeline", "Home lab")'
              style={inp} onKeyDown={e => e.key==='Enter' && createKey()}
              onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
              onBlur={e => e.target.style.borderColor='var(--border2)'}/>
            <button onClick={createKey} disabled={creating || !keyName.trim()}
              style={{ padding:'.5rem 1.1rem', background: keyName.trim()&&!creating?'#f97316':'var(--muted2)', border:'none', borderRadius:8, color:'#fff', fontSize:'.82rem', fontWeight:600, cursor: keyName.trim()&&!creating?'pointer':'not-allowed', fontFamily:'inherit', flexShrink:0 }}>
              {creating ? 'Creating...' : 'Create key'}
            </button>
          </div>
        </div>

        {/* Show new key once */}
        {newKey && (
          <div style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)', background:'rgba(52,211,153,.05)', border:'1px solid var(--green-bd)', margin:'.5rem 1rem', borderRadius:8 }}>
            <div style={{ fontSize:'.75rem', fontWeight:600, color:'var(--green)', marginBottom:'.4rem' }}>Copy your new key — it will only be shown once</div>
            <div style={{ display:'flex', gap:'.5rem', alignItems:'center' }}>
              <code style={{ flex:1, fontFamily:'monospace', fontSize:'.78rem', color:'var(--code-text)', background:'var(--code-bg)', padding:'.45rem .7rem', borderRadius:6, wordBreak:'break-all' }}>{newKey}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKey); setMsg({ text:'Key copied!', type:'ok' }); setTimeout(()=>setMsg(null),2000) }}
                style={{ padding:'.4rem .8rem', borderRadius:7, border:'1px solid var(--green-bd)', background:'var(--green-bg)', color:'var(--green)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                Copy
              </button>
            </div>
            <button onClick={() => setNewKey(null)} style={{ marginTop:'.5rem', fontSize:'.72rem', color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              I have copied it — dismiss
            </button>
          </div>
        )}

        {/* Existing keys */}
        {apiKeys.length === 0 ? (
          <div style={{ padding:'1.5rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>No API keys yet. Create one above.</div>
        ) : apiKeys.map(k => (
          <div key={k.id} style={{ padding:'.75rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
            <div>
              <div style={{ fontSize:'.82rem', fontWeight:500, color:'var(--text)', marginBottom:'.2rem' }}>{k.name}</div>
              <div style={{ fontSize:'.68rem', color:'var(--muted2)', fontFamily:'monospace' }}>
                {k.key_preview}••••••••••••••••••••
                {k.last_used_at ? ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}` : ' · Never used'}
                {' · Created '}{new Date(k.created_at).toLocaleDateString()}
              </div>
            </div>
            <button onClick={() => deleteKey(k.id)} disabled={deleting===k.id}
              style={{ padding:'.32rem .75rem', borderRadius:6, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              {deleting===k.id ? '...' : 'Delete'}
            </button>
          </div>
        ))}
      </div>

      {/* API Docs */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>API reference</div>
        </div>
        <div style={{ padding:'1.1rem' }}>

          {/* Endpoint */}
          <div style={{ display:'flex', alignItems:'center', gap:'.65rem', marginBottom:'1rem' }}>
            <span style={{ background:'rgba(249,115,22,.12)', color:'#f97316', border:'1px solid rgba(249,115,22,.3)', borderRadius:5, padding:'.25rem .6rem', fontSize:'.72rem', fontWeight:700, fontFamily:'monospace', flexShrink:0 }}>POST</span>
            <code style={{ fontSize:'.8rem', fontFamily:'monospace', color:'var(--text)' }}>https://sentineldetect.vercel.app/api/v1/generate</code>
          </div>

          {/* Request body */}
          <div style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem' }}>Request body</div>
          <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:'1.25rem' }}>
            {[
              { param:'scenario',  type:'string',  req:true,  desc:'Plain English description of the attack to detect' },
              { param:'platform',  type:'string',  req:true,  desc:'"Microsoft Sentinel (KQL)" | "Splunk (SPL)" | "Elastic (EQL)"' },
              { param:'focus',     type:'string',  req:false, desc:'MITRE tactic hint e.g. "Credential Access", "Lateral Movement"' },
              { param:'provider',  type:'string',  req:false, desc:'"gemini" (default) | "openai" | "anthropic" | "groq"' },
            ].map((p, i) => (
              <div key={p.param} style={{ padding:'.6rem .9rem', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', display:'flex', alignItems:'flex-start', gap:'1rem' }}>
                <code style={{ fontSize:'.75rem', fontFamily:'monospace', color:'#f97316', flexShrink:0, minWidth:90 }}>{p.param}</code>
                <code style={{ fontSize:'.72rem', fontFamily:'monospace', color:'var(--blue)', flexShrink:0, minWidth:60 }}>{p.type}</code>
                <span style={{ fontSize:'.62rem', padding:'.1rem .38rem', borderRadius:3, background: p.req?'var(--red-bg)':'var(--bg3)', color: p.req?'var(--red)':'var(--muted)', fontWeight:600, flexShrink:0 }}>{p.req?'required':'optional'}</span>
                <span style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.5 }}>{p.desc}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem' }}>curl example</div>
          <CodeBlock code={exampleCurl} lang="bash" />

          <div style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem' }}>Python example</div>
          <CodeBlock code={examplePython} lang="python" />

          <div style={{ fontSize:'.78rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem' }}>Response</div>
          <CodeBlock code={exampleResponse} lang="json" />

          <div style={{ padding:'.75rem .9rem', background:'rgba(249,115,22,.05)', border:'1px solid rgba(249,115,22,.15)', borderRadius:8, fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6 }}>
            Rate limits: 60 requests per hour per API key. Rules generated via API are saved to your account and appear in My Rules.
            Authentication uses Bearer token in the Authorization header. Contact via GitHub issues for higher limits.
          </div>
        </div>
      </div>
    </div>
  )
}
