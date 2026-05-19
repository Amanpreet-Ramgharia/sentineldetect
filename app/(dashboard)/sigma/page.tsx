'use client'
import { useState } from 'react'
import type { Platform } from '@/lib/types'
const PLATFORMS: Platform[] = ['Microsoft Sentinel (KQL)', 'Splunk (SPL)', 'Elastic (EQL)']
const SAMPLE = `title: Mimikatz Detection
status: experimental
description: Detects Mimikatz usage
tags:
  - attack.credential_access
  - attack.t1003.001
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    CommandLine|contains:
      - 'sekurlsa'
      - 'lsadump'
  condition: selection
falsepositives:
  - Legitimate security testing
level: high`

export default function SigmaPage() {
  const [yaml, setYaml] = useState('')
  const [platform, setPlatform] = useState<Platform>('Microsoft Sentinel (KQL)')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{title:string;rule:string;mitre_id:string;platform:string}|null>(null)
  const [model, setModel] = useState('')
  const [copied, setCopied] = useState(false)
  const inp: React.CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .8rem', color:'var(--text)', fontSize:'.8rem', outline:'none', fontFamily:'inherit' }
  async function convert() {
    if (!yaml.trim()) { setError('Paste a Sigma rule first'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/sigma', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sigma_yaml: yaml, platform }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setResult(data.rule); setModel(data.model_used)
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Failed') }
    finally { setLoading(false) }
  }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'calc(100vh - 48px)' }}>
      <div style={{ padding:'1.25rem', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'1rem' }}>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.1rem', flex:1 }}>
          <div style={{ fontSize:'.88rem', fontWeight:700, color:'var(--text)', marginBottom:'.2rem' }}> Sigma Import</div>
          <div style={{ fontSize:'.75rem', color:'var(--muted)', marginBottom:'.85rem' }}>Paste Sigma YAML, select target platform, convert and save.</div>
          <div style={{ marginBottom:'.65rem' }}>
            <div style={{ fontSize:'.67rem', color:'var(--muted)', marginBottom:'.28rem' }}>Target platform</div>
            <select value={platform} onChange={e=>setPlatform(e.target.value as Platform)} style={{ ...inp, cursor:'pointer' }}>{PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}</select>
          </div>
          <textarea value={yaml} onChange={e=>setYaml(e.target.value)} rows={14} placeholder="Paste Sigma YAML rule here..." style={{ ...inp, resize:'none', lineHeight:1.65, fontFamily:'var(--font-mono)', fontSize:'.72rem' }}/>
          <div style={{ display:'flex', gap:'.5rem', marginTop:'.65rem' }}>
            <button onClick={()=>setYaml(SAMPLE)} style={{ padding:'.45rem .85rem', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>Load sample</button>
            <button onClick={convert} disabled={loading} style={{ flex:1, padding:'.55rem', background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:8, color:'#fff', fontWeight:700, fontSize:'.82rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit' }}>{loading?'Converting...':'Convert to '+platform.split(' ')[0]}</button>
          </div>
          {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.5rem .75rem', fontSize:'.78rem', color:'var(--red)', marginTop:'.65rem' }}>{error}</div>}
        </div>
      </div>
      <div style={{ padding:'1.25rem', background:'var(--bg)' }}>
        {!result && !loading && <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.75rem', textAlign:'center', opacity:.5 }}><div style={{ fontSize:'2rem' }}></div><div style={{ fontSize:'.9rem', fontWeight:600, color:'var(--text)' }}>Paste a Sigma rule to convert</div></div>}
        {loading && <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', flexDirection:'column', gap:'.75rem' }}><div style={{ width:28,height:28,border:'2px solid var(--border2)',borderTopColor:'#f97316',borderRadius:'50%',animation:'spin .8s linear infinite' }}/><div style={{ fontSize:'.8rem', color:'var(--muted)' }}>Converting...</div></div>}
        {result && (
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ padding:'.9rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div><div style={{ fontSize:'.88rem', fontWeight:700, color:'var(--text)' }}>{result.title}</div><div style={{ fontSize:'.68rem', color:'var(--muted)', marginTop:'.2rem' }}>{result.mitre_id} · Saved to My Rules · {model}</div></div>
              <button onClick={()=>{navigator.clipboard.writeText(result.rule);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{ padding:'.3rem .7rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.72rem', cursor:'pointer', fontFamily:'inherit' }}>{copied?'Copied':'Copy'}</button>
            </div>
            <pre style={{ padding:'1rem 1.15rem', margin:0, background:'var(--code-bg)', fontFamily:'var(--font-mono)', fontSize:'.75rem', lineHeight:1.8, color:'var(--code-text)', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{result.rule}</pre>
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )
}