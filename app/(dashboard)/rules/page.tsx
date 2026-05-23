'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DbRule } from '@/lib/types'

function esc(str: string) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function hlKQL(code: string) {
  let h = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  h = h.replace(/(\/\/[^\n]*)/g, '<span class="code-cmt">$1</span>')
  h = h.replace(/("(?:[^"\\]|\\.)*")/g, '<span class="code-str">$1</span>')
  h = h.replace(/\b(\d+[dhms]?)\b/g, '<span class="code-num">$1</span>')
  ;['let','where','project','extend','summarize','by','join','union','distinct','limit','take','top','ago','now','between','has_any','has','contains','and','or','not','true','false','in','count']
    .forEach(k => { h = h.replace(new RegExp('\\b'+k+'\\b','gi'), '<span class="code-kw">'+k+'</span>') })
  ;['bin','tostring','toint','tolower','toupper','split','strcat','parse_json','dynamic','dcount','max','min','avg','sum','iff']
    .forEach(f => { h = h.replace(new RegExp('\\b'+f+'\\b','gi'), '<span class="code-fn">'+f+'</span>') })
  return h
}

function toSigma(rule: DbRule): string {
  return `title: ${rule.title}
id: ${Math.random().toString(36).substring(2,10)}
status: experimental
description: ${rule.description || ''}
author: Amanpreet Singh Matharu
date: ${new Date().toISOString().split('T')[0]}
tags:
  - attack.${(rule.tactic||'').toLowerCase().replace(/ /g,'_')}
  - attack.${rule.mitre_id||''}
logsource:
  product: windows
  service: security
detection:
  selection:
    EventID: 1
  condition: selection
falsepositives:
${(rule.false_positives as string[]).map(f=>'  - '+f).join('\n')}
level: ${(rule.severity||'medium').toLowerCase()}
`
}

const SEV: Record<string, {dot:string;bg:string;fg:string;bd:string}> = {
  Critical: {dot:'var(--red)',   bg:'var(--red-bg)',  fg:'var(--red)',  bd:'var(--red-bd)'},
  High:     {dot:'var(--red)',   bg:'var(--red-bg)',  fg:'var(--red)',  bd:'var(--red-bd)'},
  Medium:   {dot:'#f97316',      bg:'#fff7ed',        fg:'#c2410c',     bd:'#fed7aa'},
  Low:      {dot:'var(--blue)',  bg:'var(--blue-bg)', fg:'var(--blue)', bd:'var(--blue-bd)'},
}

export default function RulesPage() {
  const [rules,     setRules]     = useState<DbRule[]>([])
  const [filtered,  setFiltered]  = useState<DbRule[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [sevF,      setSevF]      = useState('all')
  const [platF,     setPlatF]     = useState('all')
  const [sel,       setSel]       = useState<DbRule | null>(null)
  const [tab,       setTab]       = useState('desc')
  const [deleting,  setDeleting]  = useState<string|null>(null)
  const [sharing,  setSharing]  = useState(false)
  const [shareUrl, setShareUrl] = useState<string|null>(null)
  const [scoring,  setScoring]  = useState(false)
  const [quality,  setQuality]  = useState<Record<string,any>|null>(null)
  const [copied,      setCopied]      = useState(false)
  const [playbook,    setPlaybook]    = useState<Record<string,any>|null>(null)
  const [playLoading, setPlayLoading] = useState(false)
  const [testLog,     setTestLog]     = useState('')
  const [testResult,  setTestResult]  = useState<string|null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [showTest,    setShowTest]    = useState(false)
  const [showPlay,    setShowPlay]    = useState(false)
  const [validation,  setValidation]  = useState<any>(null)
  const [editNote,  setEditNote]  = useState<string|null>(null)
  const [noteVal,   setNoteVal]   = useState('')

  useEffect(() => { load() }, [])

  useEffect(() => {
    let out = [...rules]
    const q = search.toLowerCase()
    if (q) out = out.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.mitre_id||'').toLowerCase().includes(q) ||
      (r.tactic||'').toLowerCase().includes(q) ||
      (r.scenario||'').toLowerCase().includes(q)
    )
    if (sevF  !== 'all') out = out.filter(r => r.severity === sevF)
    if (platF !== 'all') out = out.filter(r => r.platform.includes(platF))
    setFiltered(out)
  }, [rules, search, sevF, platF])

  async function load() {
    setLoading(true)
    const sb = createClient()
    const { data } = await sb.from('rules').select('*').order('created_at', { ascending: false })
    setRules((data as DbRule[]) || [])
    setLoading(false)
  }

  async function shareRule(rule: DbRule) {
    setSharing(true); setShareUrl(null)
    const newPublic = !rule.is_public
    const res = await fetch('/api/share', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rule_id: rule.id, is_public: newPublic }) })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setSharing(false); return }
    if (newPublic) {
      const url = `${window.location.origin}/share/${rule.id}`
      setShareUrl(url)
      navigator.clipboard.writeText(url)
    }
    setSharing(false)
    load()
  }

  async function scoreRule(rule: DbRule) {
    setScoring(true); setQuality(null)
    const res = await fetch('/api/quality', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rule, provider:'gemini' }) })
    const data = await res.json()
    if (!res.ok) { alert(data.error); setScoring(false); return }
    setQuality(data.quality)
    setScoring(false)
  }

  async function del(id: string) {
    if (!confirm('Delete this rule permanently?')) return
    setDeleting(id)
    await createClient().from('rules').delete().eq('id', id)
    setRules(p => p.filter(r => r.id !== id))
    if (sel?.id === id) setSel(null)
    setDeleting(null)
  }

  async function toggleFav(rule: DbRule) {
    await createClient().from('rules').update({ is_favourite: !rule.is_favourite }).eq('id', rule.id)
    setRules(p => p.map(r => r.id === rule.id ? {...r, is_favourite: !r.is_favourite} : r))
    if (sel?.id === rule.id) setSel(p => p ? {...p, is_favourite: !p.is_favourite} : null)
  }

  function dlKQL(r: DbRule) {
    const txt = `// ${r.title}\n// MITRE: ${r.mitre_id}\n// Created: ${r.created_at}\n\n${r.rule}\n\n// False Positives:\n${(r.false_positives as string[]).map(f=>'// • '+f).join('\n')}`
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([txt],{type:'text/plain'}))
    a.download = (r.mitre_id||'rule').replace(/\./g,'_')+'_detection.kql'; a.click()
  }

  function dlARM(r: DbRule) {
    const arm = {"$schema":"https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#","contentVersion":"1.0.0.0","resources":[{"type":"Microsoft.OperationalInsights/workspaces/providers/alertRules","apiVersion":"2022-11-01-preview","properties":{"displayName":r.title,"description":r.description,"severity":r.severity,"enabled":true,"query":r.rule,"queryFrequency":"PT1H","queryPeriod":"PT1H","triggerOperator":"GreaterThan","triggerThreshold":0,"tactics":[r.tactic],"techniques":[r.mitre_id],"kind":"Scheduled"}}]}
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(arm,null,2)],{type:'application/json'}))
    a.download = (r.mitre_id||'rule').replace(/\./g,'_')+'_arm.json'; a.click()
  }

  async function saveNote(rule: DbRule) {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().from('rules').update({ note: noteVal }).eq('id', rule.id)
    setRules(p => p.map(r => r.id === rule.id ? {...r, note: noteVal} : r))
    if (sel?.id === rule.id) setSel(p => p ? {...p, note: noteVal} : null)
    setEditNote(null)
  }

  function dlSigma(r: DbRule) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([toSigma(r)], {type:'text/plain'}))
    a.download = (r.mitre_id||'rule').replace(/\./g,'_')+'_sigma.yml'; a.click()
  }

  async function generatePlaybook(rule: DbRule) {
    setPlayLoading(true); setShowPlay(true); setPlaybook(null)
    try {
      const res = await fetch('/api/playbook', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rule }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPlaybook(data.playbook)
    } catch (e: unknown) { console.error(e) }
    finally { setPlayLoading(false) }
  }

  async function testRule(rule: DbRule) {
    if (!testLog.trim()) return
    setTestLoading(true); setTestResult(null)
    try {
      const res = await fetch('/api/analyse', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ log: testLog, format: 'auto', provider: 'gemini' }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const analysis = data.analysis
      const wouldMatch = analysis.threat_level !== 'Benign' && analysis.mitre_techniques?.some((t: any) => t.id === rule.mitre_id)
      setTestResult(wouldMatch ? ` Rule would likely FIRE — threat level: ${analysis.threat_level}. MITRE ${rule.mitre_id} matched.` : ` Rule may NOT fire — ${analysis.threat_level === 'Benign' ? 'log appears benign' : 'MITRE technique mismatch'}. Detected: ${analysis.mitre_techniques?.map((t: any)=>t.id).join(', ')||'none'}`)
    } catch (e: unknown) { setTestResult('Test failed: ' + (e instanceof Error ? e.message : 'unknown error')) }
    finally { setTestLoading(false) }
  }

  async function validateRule(rule: DbRule) {
    try {
      const res = await fetch('/api/validate', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ rule: rule.rule, platform: rule.platform }) })
      const data = await res.json()
      setValidation(data)
    } catch { /* silent */ }
  }

  const inp: React.CSSProperties = { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .75rem', color:'var(--text)', fontSize:'.78rem', outline:'none', fontFamily:'inherit' }
  const slc: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'.35rem .55rem', color:'var(--text)', fontSize:'.72rem', outline:'none', fontFamily:'inherit', cursor:'pointer', flex:1 }
  const btn: React.CSSProperties = { padding:'.3rem .7rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit' }

  return (
    <div style={{display:'grid', gridTemplateColumns:'340px 1fr', minHeight:'calc(100vh - 48px)'}}>

      {/* List */}
      <div style={{background:'var(--bg4)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'hidden'}}>
        <div style={{padding:'.85rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'.45rem', flexShrink:0}}>
          <input style={inp} placeholder="Search rules, MITRE IDs, tactics..." value={search} onChange={e=>setSearch(e.target.value)}/>
          <div style={{display:'flex', gap:'.4rem'}}>
            <select style={slc} value={sevF} onChange={e=>setSevF(e.target.value)}>
              <option value="all">All severities</option>
              {['Critical','High','Medium','Low'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <select style={slc} value={platF} onChange={e=>setPlatF(e.target.value)}>
              <option value="all">All platforms</option>
              <option value="KQL">Sentinel</option>
              <option value="SPL">Splunk</option>
              <option value="EQL">Elastic</option>
            </select>
          </div>
          <div style={{fontSize:'.63rem', color:'var(--muted2)', fontFamily:'var(--font-mono)'}}>
            {filtered.length} of {rules.length} rules
          </div>
        </div>

        <div style={{flex:1, overflowY:'auto'}}>
          {loading && <div style={{padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem'}}>Loading...</div>}
          {!loading && filtered.length===0 && (
            <div style={{padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem'}}>
              {rules.length===0 ? 'No rules yet — generate some!' : 'No rules match your search'}
            </div>
          )}
          {filtered.map(rule => {
            const sv = SEV[rule.severity] || SEV.Low
            const active = sel?.id === rule.id
            return (
              <div key={rule.id} onClick={()=>{setSel(rule);setTab('desc')}}
                style={{padding:'.72rem 1rem', borderBottom:'1px solid var(--border)', cursor:'pointer', background:active?'rgba(249,115,22,.07)':'transparent', borderLeft:active?'3px solid #f97316':'3px solid transparent', transition:'all .12s'}}>
                <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.5rem'}}>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', alignItems:'center', gap:'.4rem', marginBottom:'.28rem'}}>
                      <span style={{width:7, height:7, borderRadius:'50%', background:sv.dot, flexShrink:0}}/>
                      <span style={{fontSize:'.77rem', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{esc(rule.title)}</span>
                    </div>
                    <div style={{display:'flex', gap:'.28rem', flexWrap:'wrap'}}>
                      {rule.mitre_id && <span style={{fontSize:'.6rem', padding:'.1rem .38rem', borderRadius:3, background:'var(--blue-bg)', color:'var(--blue)', border:'1px solid var(--blue-bd)', fontFamily:'var(--font-mono)'}}>{rule.mitre_id}</span>}
                      {rule.tactic   && <span style={{fontSize:'.6rem', padding:'.1rem .38rem', borderRadius:3, background:'var(--purple-bg)', color:'var(--purple)', border:'1px solid var(--purple-bd)'}}>{rule.tactic}</span>}
                      {rule.confidence!=null && <span style={{fontSize:'.6rem', padding:'.1rem .38rem', borderRadius:3, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)'}}>{rule.confidence}%</span>}
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();toggleFav(rule)}} style={{background:'none', border:'none', cursor:'pointer', fontSize:'.82rem', opacity:rule.is_favourite?1:.25, transition:'opacity .15s', padding:'.1rem'}} title="Favourite"></button>
                </div>
                <div style={{fontSize:'.62rem', color:'var(--muted2)', marginTop:'.3rem', fontFamily:'var(--font-mono)'}}>
                  {new Date(rule.created_at).toLocaleDateString()} · {rule.platform.split(' ')[0]}
                </div>
                {rule.note && <div style={{fontSize:'.65rem', color:'var(--muted)', marginTop:'.2rem', fontStyle:'italic'}}> {rule.note}</div>}
              </div>
            )
          })}
        </div>
      </div>

      {/* Detail */}
      <div style={{background:'var(--bg)', padding:'1.25rem', overflowY:'auto'}}>
        {!sel ? (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.75rem', textAlign:'center'}}>
            <div style={{fontSize:'2.5rem', opacity:.2}}></div>
            <div style={{fontSize:'.92rem', fontWeight:600, color:'var(--text2)'}}>Select a rule to view</div>
            <div style={{fontSize:'.78rem', color:'var(--muted)'}}>{rules.length} rules in your account</div>
          </div>
        ) : (
          <div style={{maxWidth:900}}>
            <div style={{background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'0 3px 10px rgba(0,0,0,.1)'}}>
              {/* Header */}
              <div style={{padding:'.9rem 1.15rem', background:'linear-gradient(135deg,rgba(249,115,22,.05),rgba(99,102,241,.04))', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.65rem', flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'.92rem', fontWeight:700, color:'var(--text)', marginBottom:'.45rem'}}>{esc(sel.title)}</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:'.3rem'}}>
                    {sel.severity && <span style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, fontFamily:'var(--font-mono)', background:SEV[sel.severity]?.bg, color:SEV[sel.severity]?.fg, border:'1px solid '+(SEV[sel.severity]?.bd)}}>{sel.severity}</span>}
                    {sel.mitre_id && <span style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, fontFamily:'var(--font-mono)', background:'var(--blue-bg)', color:'var(--blue)', border:'1px solid var(--blue-bd)'}}>{sel.mitre_id}</span>}
                    {sel.tactic   && <span style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, background:'var(--purple-bg)', color:'var(--purple)', border:'1px solid var(--purple-bd)'}}>{sel.tactic}</span>}
                    {sel.data_source && <span style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)'}}>{sel.data_source}</span>}
                    {sel.confidence!=null && <span style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, background:'var(--green-bg)', color:'var(--green)', border:'1px solid var(--green-bd)'}}>{sel.confidence}% confidence</span>}
                  </div>
                </div>
                <div style={{display:'flex', gap:'.3rem', flexWrap:'wrap', marginTop:'.5rem'}}>
                  <button onClick={()=>{navigator.clipboard.writeText(sel.rule);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={btn}>{copied?'Copied':'Copy'}</button>
                  <button onClick={()=>dlKQL(sel)} style={btn}>.kql</button>
                  <button onClick={()=>dlARM(sel)} style={btn}>ARM</button>
                  <button onClick={()=>dlSigma(sel)} style={btn}>Sigma</button>
                  <button onClick={()=>{setShowTest(!showTest);setShowPlay(false)}} style={btn}>Test</button>
                  <button onClick={()=>{generatePlaybook(sel);setShowTest(false)}} style={btn}>Playbook</button>
                  <button onClick={()=>validateRule(sel)} style={btn}>Validate</button>
                  <button onClick={()=>scoreRule(sel)} disabled={scoring} style={btn}>{scoring?'Scoring...':'Score'}</button>
                  <button onClick={()=>shareRule(sel)} disabled={sharing} style={{...btn, color:sel.is_public?'var(--green)':'var(--muted)', borderColor:sel.is_public?'var(--green-bd)':'var(--border)'}}>
                    {sharing?'...':(sel.is_public?'Unshare':'Share')}
                  </button>
                  <button onClick={()=>del(sel.id)} disabled={deleting===sel.id} style={{...btn, borderColor:'var(--red-bd)', background:'var(--red-bg)', color:'var(--red)'}}>{deleting===sel.id?'...':'Delete'}</button>
                </div>
              </div>

              {/* Code block */}
              <div style={{background:'var(--code-bg)'}}>
                <div style={{padding:'.38rem .9rem', borderBottom:'1px solid rgba(255,255,255,.06)', opacity:.7}}>
                  <span style={{fontSize:'.6rem', fontFamily:'var(--font-mono)', color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'.07em'}}>{sel.platform}</span>
                </div>
                <pre style={{padding:'1rem 1.15rem', margin:0, fontFamily:'var(--font-mono)', fontSize:'.75rem', lineHeight:1.8, color:'var(--code-text)', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word'}}
                  dangerouslySetInnerHTML={{__html:hlKQL(sel.rule||'')}}/>
              </div>

              {/* Tabs */}
              <div style={{display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)', padding:'0 1rem'}}>
                {[['desc','Description'],['fp','False Positives'],['tune','Tuning'],['resp','IR Steps']].map(([k,l])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{padding:'.55rem .8rem', fontSize:'.72rem', fontWeight:tab===k?600:400, color:tab===k?'#f97316':'var(--muted)', background:'none', border:'none', borderBottom:tab===k?'2px solid #f97316':'2px solid transparent', cursor:'pointer', fontFamily:'inherit', marginBottom:-1}}>{l}</button>
                ))}
              </div>

              <div style={{padding:'.9rem 1.1rem'}}>
                {tab==='desc' && <p style={{fontSize:'.82rem', color:'var(--text2)', lineHeight:1.75, margin:0}}>{esc(sel.description)}</p>}
                {tab==='fp'   && <>{(sel.false_positives as string[]).map((x,i)=><div key={i} style={{display:'flex', gap:'.5rem', padding:'.28rem 0', borderBottom:'1px solid var(--border)', fontSize:'.78rem', color:'var(--text2)'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#f97316',flexShrink:0,marginTop:'.48rem'}}/>{esc(x)}</div>)}</>}
                {tab==='tune' && <>{(sel.tuning_tips as string[]).map((x,i)=><div key={i} style={{display:'flex', gap:'.5rem', padding:'.28rem 0', borderBottom:'1px solid var(--border)', fontSize:'.78rem', color:'var(--text2)'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#f97316',flexShrink:0,marginTop:'.48rem'}}/>{esc(x)}</div>)}</>}
                {tab==='resp' && <>{(sel.response_steps as string[]).map((x,i)=><div key={i} style={{display:'flex', gap:'.5rem', padding:'.28rem 0', borderBottom:'1px solid var(--border)', fontSize:'.78rem', color:'var(--text2)'}}><span style={{width:17,height:17,borderRadius:'50%',background:'#f97316',color:'#fff',fontSize:'.6rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'.1rem'}}>{i+1}</span>{esc(x)}</div>)}</>}
              </div>

              {/* Validation */}
              {validation && (
                <div style={{padding:'.75rem 1.1rem', borderTop:'1px solid var(--border)', background: validation.valid ? 'rgba(52,211,153,.03)' : 'rgba(248,113,113,.03)'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'.65rem', marginBottom: (validation.issues.length||validation.warnings.length||validation.suggestions.length) ? '.5rem' : 0}}>
                    <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)'}}>Validation score</div>
                    <span style={{fontSize:'.7rem', fontFamily:'var(--font-mono)', background: validation.score>=80 ? 'var(--green-bg)' : validation.score>=60 ? '#fff7ed' : 'var(--red-bg)', color: validation.score>=80 ? 'var(--green)' : validation.score>=60 ? '#c2410c' : 'var(--red)', border:'1px solid '+(validation.score>=80?'var(--green-bd)':validation.score>=60?'#fed7aa':'var(--red-bd)'), padding:'.1rem .45rem', borderRadius:4, fontWeight:600}}>{validation.score}/100</span>
                    <button onClick={()=>setValidation(null)} style={{marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.75rem'}}></button>
                  </div>
                  {[...validation.issues.map((i: string)=>({t:' Issue', m:i})), ...validation.warnings.map((w: string)=>({t:' Warning', m:w})), ...validation.suggestions.map((s: string)=>({t:' Suggestion', m:s}))].map((item,i) => (
                    <div key={i} style={{fontSize:'.75rem', color:'var(--text2)', padding:'.2rem 0', display:'flex', gap:'.5rem'}}><span style={{flexShrink:0}}>{item.t}:</span>{item.m}</div>
                  ))}
                </div>
              )}

              {/* Test Rule */}
              {showTest && (
                <div style={{padding:'.85rem 1.1rem', borderTop:'1px solid var(--border)', background:'rgba(99,102,241,.03)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem'}}>Test Rule rule against a log</div>
                  <textarea value={testLog} onChange={e=>setTestLog(e.target.value)} rows={4} placeholder="Paste a sample log entry here — AI checks if this rule would fire..."
                    style={{width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.55rem .8rem', color:'var(--text)', fontSize:'.75rem', outline:'none', resize:'none', fontFamily:'var(--font-mono)', lineHeight:1.7, marginBottom:'.5rem'}}/>
                  <div style={{display:'flex', gap:'.5rem', alignItems:'center'}}>
                    <button onClick={()=>testRule(sel)} disabled={testLoading||!testLog.trim()} style={{padding:'.45rem .9rem', background: testLog.trim() ? '#f97316' : 'var(--muted2)', border:'none', borderRadius:7, color:'#fff', fontSize:'.78rem', fontWeight:600, cursor: testLog.trim() ? 'pointer' : 'not-allowed', fontFamily:'inherit'}}>
                      {testLoading ? 'Testing...' : 'Run test'}
                    </button>
                    {testResult && <span style={{fontSize:'.78rem', color: testResult.startsWith('') ? 'var(--green)' : 'var(--muted)', flex:1}}>{testResult}</span>}
                  </div>
                </div>
              )}

              {/* IR Playbook */}
              {showPlay && (
                <div style={{padding:'.85rem 1.1rem', borderTop:'1px solid var(--border)', background:'rgba(249,115,22,.03)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem'}}> Incident Response Playbook</div>
                  {playLoading ? (
                    <div style={{color:'var(--muted)', fontSize:'.8rem'}}>Generating playbook...</div>
                  ) : playbook && (
                    <div style={{display:'flex', flexDirection:'column', gap:'.65rem'}}>
                      {playbook.overview && <p style={{fontSize:'.8rem', color:'var(--text2)', lineHeight:1.7, margin:0}}>{playbook.overview}</p>}
                      {[[' Triage steps','triage'],[' Investigation','investigation'],[' Containment','containment'],[' Eradication','eradication'],[' Evidence to collect','evidence_to_collect'],[' Escalation criteria','escalation_criteria']].map(([label, key]) => playbook[key]?.length && (
                        <div key={key}>
                          <div style={{fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:'.3rem'}}>{label}</div>
                          {(playbook[key] as string[]).map((s: string, i: number) => (
                            <div key={i} style={{display:'flex', gap:'.5rem', padding:'.2rem 0', fontSize:'.78rem', color:'var(--text2)'}}><span style={{width:16,height:16,borderRadius:'50%',background:'rgba(249,115,22,.2)',color:'#f97316',fontSize:'.6rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'.1rem'}}>{i+1}</span>{s}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Share URL banner */}
              {shareUrl && (
                <div style={{margin:'0 1rem .5rem', padding:'.65rem .9rem', background:'var(--green-bg)', border:'1px solid var(--green-bd)', borderRadius:8, display:'flex', alignItems:'center', gap:'.75rem', flexWrap:'wrap'}}>
                  <span style={{fontSize:'.75rem', color:'var(--green)', fontWeight:600}}>Rule shared — link copied to clipboard</span>
                  <code style={{fontSize:'.7rem', fontFamily:'monospace', color:'var(--green)', flex:1, wordBreak:'break-all'}}>{shareUrl}</code>
                  <button onClick={()=>setShareUrl(null)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.75rem', fontFamily:'inherit'}}>Dismiss</button>
                </div>
              )}

              {/* Quality score */}
              {quality && (
                <div style={{margin:'0 1rem .5rem', padding:'.85rem 1rem', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.65rem', flexWrap:'wrap', gap:'.5rem'}}>
                    <div style={{fontSize:'.78rem', fontWeight:600, color:'var(--text)'}}>Rule Quality Score</div>
                    <div style={{display:'flex', alignItems:'center', gap:.5+'rem'}}>
                      <div style={{fontSize:'1.4rem', fontWeight:800, color: (quality.overall as number)>=7?'var(--green)':(quality.overall as number)>=5?'#f97316':'var(--red)'}}>{quality.overall as number}/10</div>
                      <button onClick={()=>setQuality(null)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.75rem', fontFamily:'inherit'}}>Close</button>
                    </div>
                  </div>
                  <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'.4rem', marginBottom:'.6rem'}}>
                    {[
                      {label:'Specificity',     val: quality.specificity as number},
                      {label:'FP risk',         val: quality.fp_risk as number, invert:true},
                      {label:'Coverage',        val: quality.coverage as number},
                      {label:'Implementation',  val: quality.implementation as number},
                    ].map(m => (
                      <div key={m.label} style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:6, padding:'.45rem .65rem'}}>
                        <div style={{fontSize:'.62rem', color:'var(--muted)', marginBottom:'.15rem'}}>{m.label}</div>
                        <div style={{display:'flex', alignItems:'center', gap:'.4rem'}}>
                          <div style={{flex:1, background:'var(--bg3)', borderRadius:999, height:4, overflow:'hidden'}}>
                            <div style={{width:`${(m.invert ? 11-m.val : m.val)*10}%`, height:'100%', background:'#f97316', borderRadius:999}}/>
                          </div>
                          <span style={{fontSize:'.72rem', fontWeight:600, color:'var(--text)', fontFamily:'monospace'}}>{m.val}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:'.75rem', color:'var(--muted)', lineHeight:1.55, marginBottom:'.4rem'}}>{quality.summary as string}</div>
                  {(quality.improvements as string[])?.length > 0 && (
                    <div style={{fontSize:'.72rem', color:'var(--muted2)'}}>Improvements: {(quality.improvements as string[]).join(' · ')}</div>
                  )}
                </div>
              )}

              {/* Note */}
              <div style={{padding:'.75rem 1.1rem', background:'rgba(249,115,22,.03)', borderTop:'1px solid var(--border)'}}>
                <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.4rem'}}> Note</div>
                {editNote === sel.id ? (
                  <div style={{display:'flex', gap:'.5rem', alignItems:'flex-end'}}>
                    <textarea value={noteVal} onChange={e=>setNoteVal(e.target.value)} rows={2}
                      placeholder="Add a note about this rule..."
                      style={{flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.45rem .7rem', color:'var(--text)', fontSize:'.78rem', outline:'none', resize:'none', fontFamily:'inherit'}}
                      onFocus={e=>e.target.style.borderColor='rgba(249,115,22,.45)'}
                      onBlur={e=>e.target.style.borderColor='var(--border2)'}/>
                    <div style={{display:'flex', flexDirection:'column', gap:'.3rem'}}>
                      <button onClick={()=>saveNote(sel)} style={{padding:'.3rem .65rem', borderRadius:6, border:'none', background:'#f97316', color:'#fff', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit'}}>Save</button>
                      <button onClick={()=>setEditNote(null)} style={{padding:'.3rem .65rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit'}}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{display:'flex', alignItems:'center', gap:'.75rem'}}>
                    <span style={{fontSize:'.78rem', color: sel.note ? 'var(--text2)' : 'var(--muted2)', fontStyle: sel.note ? 'normal' : 'italic', flex:1}}>
                      {sel.note || 'No note yet'}
                    </span>
                    <button onClick={()=>{setEditNote(sel.id); setNoteVal(sel.note||'')}}
                      style={{padding:'.2rem .55rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.68rem', cursor:'pointer', fontFamily:'inherit'}}>
                      {sel.note ? 'Edit' : '+ Add note'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
