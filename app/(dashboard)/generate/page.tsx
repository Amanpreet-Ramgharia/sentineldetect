'use client'
import { useState, useEffect } from 'react'
import type { DetectionRule, Platform } from '@/lib/types'

const TEMPLATES = [
  { label:'LSASS Dump',        text:'Detect non-system processes accessing LSASS memory to steal credentials, targeting tools like Mimikatz' },
  { label:'Kerberoasting',     text:'Detect Kerberoasting attacks — RC4 encrypted TGS ticket requests for service accounts in Active Directory' },
  { label:'Password Spray',    text:'Detect password spray attack — single source IP attempting authentication against 20+ accounts within 5 minutes' },
  { label:'MFA Fatigue',       text:'Detect MFA fatigue attack where a user receives more than 10 push notification requests within 5 minutes' },
  { label:'DCSync Attack',     text:'Detect DCSync — non-domain-controller account requests AD replication using GetNCChanges to dump all credentials' },
  { label:'PowerShell C2',     text:'Detect PowerShell using EncodedCommand, IEX, or DownloadString to fetch and execute remote payloads' },
  { label:'WMI Execution',     text:'Detect WMI-based remote code execution using WmiPrvSE spawning suspicious child processes' },
  { label:'Ransomware',        text:'Detect ransomware — more than 50 file renames per minute combined with vssadmin shadow copy deletion' },
  { label:'BEC Inbox Rule',    text:'Detect inbox rules that silently forward or delete emails to hide Business Email Compromise activity' },
  { label:'DNS Tunnelling',    text:'Detect DNS tunnelling using unusually long queries or high-frequency beaconing to rare domains' },
  { label:'Pass the Hash',     text:'Detect Pass the Hash lateral movement using NTLM authentication from one host to another' },
  { label:'RDP Brute Force',   text:'Detect RDP brute force — 10+ failed authentication attempts followed by a successful login from the same IP' },
  { label:'Log Clearing',      text:'Detect Windows event log clearing using wevtutil or PowerShell Clear-EventLog — common anti-forensics step' },
  { label:'AV Tampering',      text:'Detect Windows Defender being disabled via registry, PowerShell Set-MpPreference, or service stop commands' },
  { label:'Scheduled Task',    text:'Detect scheduled tasks created by non-system processes pointing to scripts in temp or user directories' },
  { label:'Data Exfiltration', text:'Detect large data exfiltration — a process uploading more than 500MB to an external IP within 30 minutes' },
]

const PLATFORMS: Platform[] = ['Microsoft Sentinel (KQL)', 'Splunk (SPL)', 'Elastic (EQL)']

const IMPROVE_OPTIONS = [
  'Reduce false positives',
  'Add time-based threshold',
  'Add whitelist for known-good processes',
  'Improve MITRE accuracy',
  'Add entity mapping for Sentinel',
  'Optimise query performance',
  'Add severity scoring',
  'Expand detection coverage',
]

function esc(s: string) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
}

function hlKQL(code: string) {
  let h = code.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  h = h.replace(/(\/\/[^\n]*)/g,'<span class="code-cmt">$1</span>')
  h = h.replace(/("(?:[^"\\]|\\.)*")/g,'<span class="code-str">$1</span>')
  h = h.replace(/\b(\d+[dhms]?)\b/g,'<span class="code-num">$1</span>')
  ;['let','where','project','extend','summarize','by','join','union','distinct','limit','take','top','ago','now','between','has_any','has','contains','and','or','not','true','false','in','count']
    .forEach(k=>{h=h.replace(new RegExp('\\b'+k+'\\b','gi'),'<span class="code-kw">'+k+'</span>')})
  ;['bin','tostring','toint','tolower','toupper','split','strcat','parse_json','dynamic','dcount','max','min','avg','sum','iff']
    .forEach(f=>{h=h.replace(new RegExp('\\b'+f+'\\b','gi'),'<span class="code-fn">'+f+'</span>')})
  return h
}

function toSigma(rule: DetectionRule): string {
  return `title: ${rule.title}
id: ${Math.random().toString(36).substring(2,10)}
status: experimental
description: ${rule.description||''}
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
${(rule.false_positives||[]).map((f:string)=>'  - '+f).join('\n')}
level: ${(rule.severity||'medium').toLowerCase()}
`
}

export default function GeneratePage() {
  const [scenario,  setScenario]  = useState('')
  const [platform,  setPlatform]  = useState<Platform>('Microsoft Sentinel (KQL)')
  const [focus,     setFocus]     = useState('any')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [rule,      setRule]      = useState<DetectionRule|null>(null)
  const [tab,       setTab]       = useState('desc')
  const [modelUsed, setModelUsed] = useState('')
  const [copied,    setCopied]    = useState(false)

  // Improve
  const [showImprove,   setShowImprove]   = useState(false)
  const [improveOpts,   setImproveOpts]   = useState<string[]>([])
  const [customImprove, setCustomImprove] = useState('')
  const [improving,     setImproving]     = useState(false)

  // Explain
  const [showExplain, setShowExplain] = useState(false)
  const [explanation, setExplanation] = useState<any>(null)
  const [explaining,  setExplaining]  = useState(false)

  // Convert
  const [converting, setConverting] = useState(false)

  // Bulk
  const [showBulk,     setShowBulk]     = useState(false)
  const [bulkInput,    setBulkInput]    = useState('')
  const [bulkResults,  setBulkResults]  = useState<any[]>([])
  const [bulkLoading,  setBulkLoading]  = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pre = params.get('prefill')
    if (pre) { setScenario(decodeURIComponent(pre)); window.history.replaceState({}, '', '/generate') }
  }, [])

  async function generate() {
    if (!scenario.trim() || scenario.trim().length < 10) { setError('Describe the attack in more detail (min 10 chars)'); return }
    setLoading(true); setError(''); setRule(null); setShowImprove(false); setShowExplain(false); setExplanation(null); setTab('desc')
    try {
      const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenario, platform, focus}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error||'Generation failed')
      setRule(data.rule); setModelUsed(data.model_used)
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Generation failed') }
    finally { setLoading(false) }
  }

  async function improveRule() {
    if (!rule || !improveOpts.length) return
    setImproving(true)
    try {
      const res = await fetch('/api/convert', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'improve', rule, improvements:improveOpts, custom_instructions:customImprove}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Validate response has the KQL/rule content before replacing
      if (!data.rule?.rule) throw new Error('Improvement returned an empty rule. Please try again.')
      // Merge improved fields but keep existing ones as fallback
      setRule(prev => prev ? { ...prev, ...data.rule, rule: data.rule.rule } : data.rule)
      setModelUsed(data.model_used)
      setShowImprove(false); setImproveOpts([]); setCustomImprove('')
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Improvement failed') }
    finally { setImproving(false) }
  }

  async function explainRule() {
    if (!rule) return
    setExplaining(true); setShowExplain(true); setExplanation(null)
    try {
      const res = await fetch('/api/convert', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'explain', rule}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setExplanation(data.explanation)
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Explain failed') }
    finally { setExplaining(false) }
  }

  async function convertRule(toPlatform: Platform) {
    if (!rule || rule.platform === toPlatform) return
    setConverting(true)
    try {
      const res = await fetch('/api/convert', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'convert', rule, to_platform:toPlatform}) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (!data.rule?.rule) throw new Error('Conversion returned an empty rule. Please try again.')
      setRule(prev => prev ? { ...prev, ...data.rule, rule: data.rule.rule } : data.rule)
      setModelUsed(data.model_used)
    } catch(e: unknown) { setError(e instanceof Error ? e.message : 'Convert failed') }
    finally { setConverting(false) }
  }

  async function bulkGenerate() {
    const lines = bulkInput.split('\n').map(l=>l.trim()).filter(l=>l.length>10)
    if (!lines.length) return
    setBulkLoading(true); setBulkResults([]); setBulkProgress(0)
    const results: any[] = []
    for (let i=0; i<lines.length; i++) {
      try {
        const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenario:lines[i], platform}) })
        const data = await res.json()
        results.push({ scenario:lines[i], title:data.rule?.title, error:res.ok?null:data.error })
      } catch(e: unknown) {
        results.push({ scenario:lines[i], title:null, error:e instanceof Error?e.message:'Failed' })
      }
      setBulkProgress(Math.round((i+1)/lines.length*100))
      setBulkResults([...results])
      if (i < lines.length-1) await new Promise(r=>setTimeout(r,2000))
    }
    setBulkLoading(false)
  }

  const SEV: Record<string,{bg:string;fg:string;bd:string}> = {
    High:     {bg:'var(--red-bg)',  fg:'var(--red)',  bd:'var(--red-bd)'},
    Critical: {bg:'var(--red-bg)',  fg:'var(--red)',  bd:'var(--red-bd)'},
    Medium:   {bg:'#fff7ed',        fg:'#c2410c',     bd:'#fed7aa'},
    Low:      {bg:'var(--blue-bg)', fg:'var(--blue)', bd:'var(--blue-bd)'},
  }

  const s = {
    inp: { width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .8rem', color:'var(--text)', fontSize:'.8rem', outline:'none', fontFamily:'inherit' } as React.CSSProperties,
    btn: { padding:'.3rem .7rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit', transition:'all .15s' } as React.CSSProperties,
  }

  return (
    <div style={{display:'grid', gridTemplateColumns:'380px 1fr', minHeight:'calc(100vh - 48px)'}}>

      {/*  SIDEBAR  */}
      <div style={{background:'var(--bg4)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', overflowY:'auto'}}>

        {/* Scenario */}
        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'.6rem', display:'block'}}>Attack Scenario</span>
          <div style={{position:'relative'}}>
            <textarea value={scenario} onChange={e=>setScenario(e.target.value)} maxLength={800} rows={6}
              placeholder={'Describe the attack behaviour to detect...\n\nExample: Detect PowerShell using EncodedCommand to download and execute remote payloads'}
              style={{...s.inp, resize:'none', lineHeight:1.65, minHeight:140, paddingBottom:'1.5rem'}}/>
            <span style={{position:'absolute', bottom:'.5rem', right:'.65rem', fontSize:'.62rem', color:'var(--muted2)', fontFamily:'var(--font-mono)'}}>{scenario.length}/800</span>
          </div>
          <div style={{marginTop:'.65rem'}}>
            <div style={{fontSize:'.65rem', color:'var(--muted)', marginBottom:'.35rem'}}>Quick templates:</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'.3rem'}}>
              {TEMPLATES.map(t=>(
                <button key={t.label} onClick={()=>setScenario(t.text)}
                  style={{padding:'.22rem .58rem', borderRadius:5, border:'1px solid var(--border2)', background:'var(--bg)', color:'var(--muted)', fontSize:'.67rem', cursor:'pointer', fontFamily:'inherit', transition:'all .12s'}}
                  onMouseEnter={e=>{(e.target as HTMLElement).style.borderColor='rgba(249,115,22,.4)';(e.target as HTMLElement).style.color='#f97316'}}
                  onMouseLeave={e=>{(e.target as HTMLElement).style.borderColor='var(--border2)';(e.target as HTMLElement).style.color='var(--muted)'}}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Options */}
        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>
          <span style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'.6rem', display:'block'}}>Options</span>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.65rem', marginBottom:'.8rem'}}>
            <div>
              <div style={{fontSize:'.67rem', color:'var(--muted)', marginBottom:'.28rem'}}>Platform</div>
              <select value={platform} onChange={e=>setPlatform(e.target.value as Platform)} style={{...s.inp, cursor:'pointer'}}>
                {PLATFORMS.map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <div style={{fontSize:'.67rem', color:'var(--muted)', marginBottom:'.28rem'}}>Focus Area</div>
              <select value={focus} onChange={e=>setFocus(e.target.value)} style={{...s.inp, cursor:'pointer'}}>
                <option value="any">Auto-detect</option>
                <option value="Credential Access">Credential Access</option>
                <option value="Lateral Movement">Lateral Movement</option>
                <option value="Persistence">Persistence</option>
                <option value="Execution">Execution</option>
                <option value="Defense Evasion">Defense Evasion</option>
                <option value="Exfiltration">Exfiltration</option>
                <option value="Impact">Impact / Ransomware</option>
              </select>
            </div>
          </div>
          <button onClick={generate} disabled={loading} style={{width:'100%', padding:'.82rem', background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:'.88rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', boxShadow:loading?'none':'0 3px 12px rgba(249,115,22,.28)', transition:'all .2s'}}>
            {loading ? <><span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .65s linear infinite'}}/>Generating...</> : 'Generate Detection Rule'}
          </button>
        </div>

        {/* Actions — only show when rule exists */}
        {rule && (
          <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted)', marginBottom:'.6rem', display:'block'}}>Actions</span>
            <div style={{display:'flex', gap:'.4rem', flexWrap:'wrap', marginBottom: showImprove ? '.65rem' : 0}}>
              <button onClick={()=>{setShowImprove(!showImprove);setShowExplain(false)}} style={{...s.btn, color:'#f97316', borderColor:'rgba(249,115,22,.3)', background:'rgba(249,115,22,.07)'}}>Improve</button>
              <button onClick={()=>{setShowExplain(!showExplain);setShowImprove(false);if(!explanation)explainRule()}} style={s.btn}>Explain</button>
              {PLATFORMS.filter(p=>p!==rule.platform).map(p=>(
                <button key={p} onClick={()=>convertRule(p)} disabled={converting} style={s.btn}>
                  {converting?'...':' '+p.split(' ')[0]}
                </button>
              ))}
            </div>

            {showImprove && (
              <div style={{background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, padding:'.85rem'}}>
                <div style={{fontSize:'.72rem', fontWeight:600, color:'var(--text)', marginBottom:'.5rem'}}>Select improvements:</div>
                <div style={{display:'flex', flexDirection:'column', gap:'.3rem', marginBottom:'.6rem'}}>
                  {IMPROVE_OPTIONS.map(opt=>(
                    <label key={opt} style={{display:'flex', alignItems:'center', gap:'.45rem', fontSize:'.75rem', color:'var(--text2)', cursor:'pointer'}}>
                      <input type="checkbox" checked={improveOpts.includes(opt)} onChange={e=>setImproveOpts(prev=>e.target.checked?[...prev,opt]:prev.filter(o=>o!==opt))} style={{accentColor:'#f97316', width:13, height:13, flexShrink:0}}/>
                      {opt}
                    </label>
                  ))}
                </div>
                <textarea value={customImprove} onChange={e=>setCustomImprove(e.target.value)} rows={2}
                  placeholder="Custom instructions (optional)..." style={{...s.inp, resize:'none', fontSize:'.75rem', marginBottom:'.5rem'}}/>
                <button onClick={improveRule} disabled={improving||!improveOpts.length} style={{width:'100%', padding:'.5rem', background:(!improving&&improveOpts.length)?'#f97316':'var(--muted2)', border:'none', borderRadius:7, color:'#fff', fontSize:'.78rem', fontWeight:600, cursor:(!improving&&improveOpts.length)?'pointer':'not-allowed', fontFamily:'inherit'}}>
                  {improving?'Improving...':'Apply improvements'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bulk generation — collapsed by default */}
        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>
          <button onClick={()=>setShowBulk(!showBulk)} style={{fontSize:'.72rem', color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:'.35rem', width:'100%', textAlign:'left'}}>
            <span style={{fontSize:'.6rem'}}>{showBulk?'':''}</span> Bulk generation
          </button>
          {showBulk && (
            <div style={{marginTop:'.65rem', display:'flex', flexDirection:'column', gap:'.55rem'}}>
              <div style={{fontSize:'.72rem', color:'var(--muted)', lineHeight:1.5}}>One scenario per line — generates all sequentially</div>
              <textarea value={bulkInput} onChange={e=>setBulkInput(e.target.value)} rows={5}
                placeholder={'LSASS memory access by Mimikatz\nKerberoasting TGS requests\nPowerShell encoded command C2'}
                style={{...s.inp, resize:'none', fontFamily:'var(--font-mono)', fontSize:'.73rem', lineHeight:1.7}}/>
              <button onClick={bulkGenerate} disabled={bulkLoading||!bulkInput.trim()}
                style={{padding:'.5rem .9rem', background:bulkInput.trim()&&!bulkLoading?'#f97316':'var(--muted2)', border:'none', borderRadius:8, color:'#fff', fontSize:'.78rem', fontWeight:600, cursor:bulkInput.trim()&&!bulkLoading?'pointer':'not-allowed', fontFamily:'inherit'}}>
                {bulkLoading?`Generating... ${bulkProgress}%`:`Generate ${bulkInput.split('\n').filter(l=>l.trim().length>10).length} rules`}
              </button>
              {bulkLoading && <div style={{background:'var(--bg)', borderRadius:6, height:6, overflow:'hidden'}}><div style={{width:`${bulkProgress}%`, height:'100%', background:'#f97316', transition:'width .3s'}}/></div>}
              {bulkResults.length>0 && (
                <div style={{display:'flex', flexDirection:'column', gap:'.3rem', maxHeight:150, overflowY:'auto'}}>
                  {bulkResults.map((r,i)=>(
                    <div key={i} style={{fontSize:'.72rem', padding:'.3rem .6rem', borderRadius:5, background:r.error?'var(--red-bg)':'var(--green-bg)', color:r.error?'var(--red)':'var(--green)', border:`1px solid ${r.error?'var(--red-bd)':'var(--green-bd)'}`}}>
                      {r.error?` ${r.scenario.substring(0,45)}...`:` ${r.title||r.scenario.substring(0,45)}`}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/*  OUTPUT  */}
      <div style={{background:'var(--bg)', padding:'1.25rem', overflowY:'auto'}}>

        {!rule && !loading && !error && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.75rem', textAlign:'center'}}>
            <div style={{fontSize:'2.5rem', opacity:.2}}></div>
            <div style={{fontSize:'.95rem', fontWeight:600, color:'var(--text2)'}}>Ready to generate</div>
            <div style={{fontSize:'.8rem', color:'var(--muted)', maxWidth:300, lineHeight:1.6}}>Describe an attack scenario and click Generate to build a production-ready detection rule.</div>
          </div>
        )}

        {loading && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.85rem'}}>
            <div style={{width:32, height:32, border:'2.5px solid var(--border2)', borderTopColor:'#f97316', borderRadius:'50%', animation:'spin .8s linear infinite'}}/>
            <div style={{display:'flex', flexDirection:'column', gap:'.4rem'}}>
              {['Analysing attack scenario...','Mapping to MITRE ATT&CK...','Writing detection logic...','Adding IR guidance...'].map((step,i)=>(
                <div key={i} style={{fontSize:'.72rem', color:'var(--muted2)', fontFamily:'var(--font-mono)', display:'flex', alignItems:'center', gap:'.5rem'}}><span>•</span>{step}</div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:10, padding:'1rem 1.1rem', color:'var(--red)', fontSize:'.82rem', lineHeight:1.6, marginBottom:'1rem'}}>
            <strong style={{display:'block', marginBottom:'.25rem'}}>Generation failed</strong>{error}
          </div>
        )}

        {rule && (
          <div style={{display:'flex', flexDirection:'column', gap:'1rem', maxWidth:900}}>

            {/* Rule card */}
            <div style={{background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', boxShadow:'0 3px 10px rgba(0,0,0,.1)'}}>

              {/* Header */}
              <div style={{padding:'.9rem 1.15rem', background:'linear-gradient(135deg,rgba(249,115,22,.05),rgba(99,102,241,.04))', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'.65rem', flexWrap:'wrap'}}>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:'.92rem', fontWeight:700, color:'var(--text)', marginBottom:'.45rem'}}>{esc(rule.title)}</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:'.3rem'}}>
                    {[
                      rule.severity && {label:rule.severity, c:SEV[rule.severity]||SEV.Low},
                      rule.mitre_id && {label:rule.mitre_id, c:{bg:'var(--blue-bg)',fg:'var(--blue)',bd:'var(--blue-bd)'}},
                      rule.tactic   && {label:rule.tactic,   c:{bg:'var(--purple-bg)',fg:'var(--purple)',bd:'var(--purple-bd)'}},
                      rule.data_source && {label:rule.data_source, c:{bg:'var(--green-bg)',fg:'var(--green)',bd:'var(--green-bd)'}},
                      rule.confidence!=null && {label:`${rule.confidence}% confidence`, c:{bg:'var(--green-bg)',fg:'var(--green)',bd:'var(--green-bd)'}},
                    ].filter(Boolean).map((b:any,i:number)=>(
                      <span key={i} style={{fontSize:'.62rem', padding:'.15rem .5rem', borderRadius:4, fontWeight:600, fontFamily:'var(--font-mono)', background:b.c.bg, color:b.c.fg, border:`1px solid ${b.c.bd}`}}>{b.label}</span>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex', gap:'.35rem', flexShrink:0, flexWrap:'wrap', justifyContent:'flex-end'}}>
                  <button onClick={()=>{navigator.clipboard.writeText(rule.rule);setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={s.btn}>{copied?' Copied':'Copy'}</button>
                  <button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([`// ${rule.title}\n// MITRE: ${rule.mitre_id}\n\n${rule.rule}`],{type:'text/plain'}));a.download=(rule.mitre_id||'rule').replace(/\./g,'_')+'.kql';a.click()}} style={s.btn}>Download .kql</button>
                  <button onClick={()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([toSigma(rule)],{type:'text/plain'}));a.download=(rule.mitre_id||'rule').replace(/\./g,'_')+'_sigma.yml';a.click()}} style={s.btn}>Download Sigma</button>
                </div>
              </div>

              {/* Code */}
              <div style={{background:'var(--code-bg)'}}>
                <div style={{padding:'.38rem .9rem', borderBottom:'1px solid rgba(255,255,255,.04)', opacity:.7}}>
                  <span style={{fontSize:'.6rem', fontFamily:'var(--font-mono)', color:'var(--muted2)', textTransform:'uppercase', letterSpacing:'.07em'}}>{rule.platform} · {modelUsed}</span>
                </div>
                <pre style={{padding:'1rem 1.15rem', margin:0, fontFamily:'var(--font-mono)', fontSize:'.75rem', lineHeight:1.8, color:'var(--code-text)', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word'}}
                  dangerouslySetInnerHTML={{__html:hlKQL(rule.rule||'')}}/>
              </div>

              {/* Tabs */}
              <div style={{display:'flex', borderBottom:'1px solid var(--border)', background:'var(--bg)', padding:'0 1rem'}}>
                {[['desc','Description'],['fp','False Positives'],['tune','Tuning'],['resp','IR Steps']].map(([k,l])=>(
                  <button key={k} onClick={()=>setTab(k)} style={{padding:'.55rem .8rem', fontSize:'.72rem', fontWeight:tab===k?600:400, color:tab===k?'#f97316':'var(--muted)', background:'none', border:'none', borderBottom:tab===k?'2px solid #f97316':'2px solid transparent', cursor:'pointer', fontFamily:'inherit', marginBottom:-1}}>{l}</button>
                ))}
              </div>
              <div style={{padding:'.9rem 1.1rem'}}>
                {tab==='desc' && <p style={{fontSize:'.82rem', color:'var(--text2)', lineHeight:1.75, margin:0}}>{esc(rule.description)}{rule.mitre_name&&<><br/><br/><span style={{fontSize:'.72rem', color:'var(--muted)'}}>MITRE: <strong style={{color:'#f97316'}}>{rule.mitre_id} — {esc(rule.mitre_name)}</strong></span></>}</p>}
                {tab==='fp'   && (rule.false_positives||[]).map((x:string,i:number)=><div key={i} style={{display:'flex',gap:'.5rem',padding:'.28rem 0',borderBottom:'1px solid var(--border)',fontSize:'.78rem',color:'var(--text2)'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#f97316',flexShrink:0,marginTop:'.48rem'}}/>{esc(x)}</div>)}
                {tab==='tune' && (rule.tuning_tips||[]).map((x:string,i:number)=><div key={i} style={{display:'flex',gap:'.5rem',padding:'.28rem 0',borderBottom:'1px solid var(--border)',fontSize:'.78rem',color:'var(--text2)'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#f97316',flexShrink:0,marginTop:'.48rem'}}/>{esc(x)}</div>)}
                {tab==='resp' && (rule.response_steps||[]).map((x:string,i:number)=><div key={i} style={{display:'flex',gap:'.5rem',padding:'.28rem 0',borderBottom:'1px solid var(--border)',fontSize:'.78rem',color:'var(--text2)'}}><span style={{width:17,height:17,borderRadius:'50%',background:'#f97316',color:'#fff',fontSize:'.6rem',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:'.1rem'}}>{i+1}</span>{esc(x)}</div>)}
              </div>
            </div>

            {/* Explain panel */}
            {showExplain && (
              <div style={{background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden'}}>
                <div style={{padding:'.75rem 1.1rem', borderBottom:'1px solid var(--border)', background:'rgba(99,102,241,.05)', display:'flex', alignItems:'center', justifyContent:'space-between'}}>
                  <span style={{fontSize:'.82rem', fontWeight:600, color:'var(--text)'}}> Plain English Explanation</span>
                  <button onClick={()=>setShowExplain(false)} style={{background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.9rem'}}></button>
                </div>
                {explaining ? (
                  <div style={{padding:'1.5rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem'}}>Generating explanation...</div>
                ) : explanation && (
                  <div>
                    {[['Summary','summary'],['How it works','how_it_works'],['What it catches','what_it_catches'],['Limitations','limitations'],['Analogy','analogy']].map(([label,key])=>explanation[key]&&(
                      <div key={key} style={{padding:'.75rem 1.1rem', borderBottom:'1px solid var(--border)'}}>
                        <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.35rem'}}>{label}</div>
                        <p style={{fontSize:'.82rem', color:'var(--text2)', lineHeight:1.7, margin:0}}>{esc(explanation[key])}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}} select option{background:var(--bg4);color:var(--text)}`}</style>
    </div>
  )
}
