'use client'
import { useState, useCallback } from 'react'

const CATEGORIES = [
  { id:'windows/process_creation', label:'Windows — Process Creation',   icon:'⚙' },
  { id:'windows/registry',         label:'Windows — Registry Events',    icon:'🗂' },
  { id:'windows/network',          label:'Windows — Network',            icon:'🌐' },
  { id:'windows/file',             label:'Windows — File Events',        icon:'📄' },
  { id:'windows/powershell',       label:'Windows — PowerShell',         icon:'💻' },
  { id:'linux/process',            label:'Linux — Process',              icon:'🐧' },
  { id:'cloud/aws',                label:'Cloud — AWS',                  icon:'☁' },
  { id:'cloud/azure',              label:'Cloud — Azure',                icon:'☁' },
  { id:'network/dns',              label:'Network — DNS',                icon:'🔗' },
  { id:'web/webserver',            label:'Web — Server Logs',            icon:'🌍' },
]

interface Rule { name:string; path:string; download_url:string; sha:string }
interface ParsedRule { title?:string; description?:string; level?:string; status?:string; logsource?:Record<string,string>; mitre_ids?:string[]; tags?:string[] }

const SEV: Record<string,{bg:string;fg:string}> = {
  critical:      {bg:'var(--red-bg)',         fg:'var(--red)'},
  high:          {bg:'rgba(249,115,22,.12)',   fg:'#f97316'},
  medium:        {bg:'rgba(234,179,8,.12)',    fg:'#eab308'},
  low:           {bg:'rgba(59,130,246,.12)',   fg:'var(--blue)'},
  informational: {bg:'rgba(148,163,184,.1)',   fg:'var(--muted)'},
}

export default function SigmaHubPage() {
  const [category,  setCategory]  = useState('windows/process_creation')
  const [rules,     setRules]     = useState<Rule[]>([])
  const [loading,   setLoading]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [selRule,   setSelRule]   = useState<Rule|null>(null)
  const [parsed,    setParsed]    = useState<ParsedRule|null>(null)
  const [rawYaml,   setRawYaml]   = useState('')
  const [fetching,  setFetching]  = useState(false)
  const [importing, setImporting] = useState(false)
  const [imported,  setImported]  = useState<Set<string>>(new Set())
  const [error,     setError]     = useState('')
  const [msg,       setMsg]       = useState('')
  const [total,     setTotal]     = useState(0)

  const loadRules = useCallback(async (cat: string, q = '') => {
    setLoading(true); setError(''); setRules([]); setSelRule(null); setParsed(null)
    const r = await fetch(`/api/sigma-hub?action=list&category=${cat}&search=${encodeURIComponent(q)}`)
    const d = await r.json()
    if (!r.ok) {
      setError(d.rate_limited ? 'GitHub API rate limit reached — wait a few minutes and try again.' : d.error || 'Failed to load rules')
    } else {
      setRules(d.rules || [])
      setTotal(d.total || 0)
    }
    setLoading(false)
  }, [])

  async function selectRule(rule: Rule) {
    setSelRule(rule); setFetching(true); setParsed(null); setRawYaml('')
    const r = await fetch(`/api/sigma-hub?action=fetch&file=${encodeURIComponent(rule.download_url)}`)
    const d = await r.json()
    if (r.ok) { setParsed(d.parsed); setRawYaml(d.raw || '') }
    setFetching(false)
  }

  async function importRule() {
    if (!selRule) return
    setImporting(true)
    const r = await fetch('/api/sigma-hub', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ download_url: selRule.download_url }) })
    const d = await r.json()
    if (r.ok) {
      setImported(prev => new Set([...prev, selRule.sha]))
      setMsg(`Imported "${parsed?.title || selRule.name}" to your rules library`)
      setTimeout(() => setMsg(''), 4000)
    } else {
      setError(d.error || 'Import failed')
    }
    setImporting(false)
  }

  const inp: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .85rem', color:'var(--text)', fontSize:'.82rem', fontFamily:'inherit', outline:'none', width:'100%' }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:'1.5rem 2rem' }}>

      <div style={{ marginBottom:'1.5rem' }}>
        <h1 style={{ fontSize:'1.25rem', fontWeight:700, margin:'0 0 .3rem' }}>SigmaHQ Community Rules</h1>
        <p style={{ fontSize:'.82rem', color:'var(--muted)', margin:0 }}>
          Browse 3,000+ community detection rules from SigmaHQ. Preview, then import to your library.
        </p>
      </div>

      {msg && (
        <div style={{ background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:8, padding:'.65rem 1rem', fontSize:'.82rem', color:'var(--green)', marginBottom:'1rem' }}>{msg}</div>
      )}
      {error && (
        <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:8, padding:'.65rem 1rem', fontSize:'.82rem', color:'var(--red)', marginBottom:'1rem' }}>{error}</div>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr', gap:'1.25rem', alignItems:'start' }}>

        {/* Category sidebar */}
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
          <div style={{ padding:'.75rem .85rem', borderBottom:'1px solid var(--border)', fontSize:'.72rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em' }}>
            Categories
          </div>
          {CATEGORIES.map(cat => (
            <div key={cat.id} onClick={() => { setCategory(cat.id); loadRules(cat.id, search) }}
              style={{ padding:'.65rem .9rem', cursor:'pointer', fontSize:'.8rem', display:'flex', alignItems:'center', gap:'.6rem', borderBottom:'1px solid var(--border)',
                background: category===cat.id ? 'rgba(249,115,22,.1)' : 'transparent',
                color: category===cat.id ? '#f97316' : 'var(--muted)',
                borderLeft: `3px solid ${category===cat.id ? '#f97316' : 'transparent'}` }}>
              <span>{cat.icon}</span><span>{cat.label}</span>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div>
          {/* Search + load */}
          <div style={{ display:'flex', gap:'.65rem', marginBottom:'1rem' }}>
            <input value={search} onChange={e=>setSearch(e.target.value)}
              placeholder="Search by filename (e.g. mimikatz, lsass, brute)..."
              style={inp} onKeyDown={e=>e.key==='Enter'&&loadRules(category,search)} />
            <button onClick={() => loadRules(category, search)}
              style={{ padding:'.55rem 1.25rem', borderRadius:8, background:'#f97316', border:'none', color:'#fff', fontWeight:700, fontSize:'.85rem', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              {loading ? 'Loading…' : rules.length > 0 ? 'Refresh' : 'Browse'}
            </button>
          </div>

          {rules.length === 0 && !loading && (
            <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'3rem', textAlign:'center', color:'var(--muted)', fontSize:'.85rem' }}>
              Click Browse to load rules from the selected category, or search for a specific rule.
            </div>
          )}

          {rules.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns: selRule ? '1fr 420px' : '1fr', gap:'1rem' }}>

              {/* Rule list */}
              <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ padding:'.65rem .9rem', borderBottom:'1px solid var(--border)', fontSize:'.72rem', color:'var(--muted)', display:'flex', justifyContent:'space-between' }}>
                  <span>Showing {rules.length} rules</span>
                  <span>{CATEGORIES.find(c=>c.id===category)?.label}</span>
                </div>
                <div style={{ maxHeight:600, overflowY:'auto' }}>
                  {rules.map(rule => (
                    <div key={rule.sha} onClick={() => selectRule(rule)}
                      style={{ padding:'.65rem .9rem', cursor:'pointer', borderBottom:'1px solid var(--border)',
                        background: selRule?.sha===rule.sha ? 'rgba(249,115,22,.08)' : 'transparent',
                        borderLeft: `3px solid ${selRule?.sha===rule.sha ? '#f97316' : 'transparent'}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                        <span style={{ fontSize:'.8rem', color:'var(--text)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {rule.name.replace('.yml','').replace(/_/g,' ')}
                        </span>
                        {imported.has(rule.sha) && (
                          <span style={{ fontSize:'.65rem', padding:'.1rem .45rem', borderRadius:4, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)', flexShrink:0 }}>Imported</span>
                        )}
                      </div>
                      <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:'.15rem', fontFamily:'monospace' }}>{rule.name}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rule detail */}
              {selRule && (
                <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden', maxHeight:640, display:'flex', flexDirection:'column' }}>
                  <div style={{ padding:'.85rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
                    <div style={{ fontWeight:600, fontSize:'.85rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                      {parsed?.title || selRule.name}
                    </div>
                    <button onClick={() => { setSelRule(null); setParsed(null) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'1.1rem', padding:'.1rem .3rem', flexShrink:0 }}>×</button>
                  </div>

                  {fetching && <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>Loading rule…</div>}

                  {parsed && !fetching && (
                    <div style={{ flex:1, overflowY:'auto', padding:'1rem' }}>
                      {/* Metadata */}
                      <div style={{ display:'flex', gap:'.4rem', flexWrap:'wrap', marginBottom:'.85rem' }}>
                        {parsed.level && (
                          <span style={{ fontSize:'.7rem', padding:'.15rem .55rem', borderRadius:4, fontWeight:600,
                            background:(SEV[parsed.level]||SEV.informational).bg,
                            color:(SEV[parsed.level]||SEV.informational).fg,
                            border:`1px solid ${(SEV[parsed.level]||SEV.informational).fg}44` }}>
                            {parsed.level}
                          </span>
                        )}
                        {parsed.status && (
                          <span style={{ fontSize:'.7rem', padding:'.15rem .55rem', borderRadius:4, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)' }}>
                            {parsed.status}
                          </span>
                        )}
                        {parsed.mitre_ids?.map(t => (
                          <span key={t} style={{ fontSize:'.7rem', padding:'.15rem .55rem', borderRadius:4, background:'rgba(249,115,22,.12)', color:'#f97316', fontFamily:'monospace' }}>{t}</span>
                        ))}
                      </div>

                      {parsed.description && (
                        <div style={{ fontSize:'.82rem', color:'var(--muted)', lineHeight:1.6, marginBottom:'1rem' }}>{parsed.description}</div>
                      )}

                      {parsed.logsource && (
                        <div style={{ marginBottom:'.85rem' }}>
                          <div style={{ fontSize:'.68rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.35rem' }}>Log source</div>
                          <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                            {Object.entries(parsed.logsource).map(([k,v]) => (
                              <span key={k} style={{ fontSize:'.72rem', padding:'.15rem .5rem', borderRadius:4, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--muted)', fontFamily:'monospace' }}>{k}: {v}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Raw YAML preview */}
                      {rawYaml && (
                        <div style={{ marginBottom:'1rem' }}>
                          <div style={{ fontSize:'.68rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.35rem' }}>Rule YAML</div>
                          <pre style={{ background:'var(--code-bg)', padding:'.75rem', borderRadius:8, fontSize:'.68rem', fontFamily:'monospace', color:'var(--code-text)', overflowX:'auto', maxHeight:200, margin:0, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>
                            {rawYaml.slice(0, 1500)}{rawYaml.length > 1500 ? '\n…(truncated)' : ''}
                          </pre>
                        </div>
                      )}

                      <button onClick={importRule} disabled={importing || imported.has(selRule.sha)}
                        style={{ width:'100%', padding:'.6rem', borderRadius:8, fontWeight:700, fontSize:'.85rem', fontFamily:'inherit', cursor: importing || imported.has(selRule.sha) ? 'not-allowed' : 'pointer', border:'none',
                          background: imported.has(selRule.sha) ? 'var(--green-bg)' : importing ? 'var(--muted2)' : '#f97316',
                          color: imported.has(selRule.sha) ? 'var(--green)' : '#fff' }}>
                        {imported.has(selRule.sha) ? '✓ Imported to library' : importing ? 'Importing…' : 'Import to My Rules →'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
