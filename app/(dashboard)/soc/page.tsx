'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface SocAlert {
  id: string; title: string; severity: string; severity_score: number
  summary: string; status: string; source: string; source_system: string | null
  mitre_technique: string; mitre_tactic: string; iocs: string[]
  investigation_steps: string[]; response_actions: string[]
  is_false_positive: boolean; escalate: boolean
  escalation_reason: string; false_positive_reason: string
  notes: string; alert_time: string; updated_at: string; created_at: string
}
interface SocCase {
  id: string; title: string; severity: string; status: string
  alert_count: number; opened_at: string; resolved_at: string | null
  ai_summary: string; created_at: string
}

const SEV_COLOR: Record<string,string> = { Critical:'var(--red)', High:'#f97316', Medium:'#eab308', Low:'var(--blue)' }
const SEV_BG: Record<string,string>    = { Critical:'var(--red-bg)', High:'rgba(249,115,22,.12)', Medium:'rgba(234,179,8,.12)', Low:'rgba(59,130,246,.12)' }
const STA_COLOR: Record<string,string> = { new:'#f97316', investigating:'var(--blue)', resolved:'var(--green)', false_positive:'var(--muted)', open:'var(--muted)', contained:'#eab308', closed:'var(--muted2)' }
const STA_BG: Record<string,string>    = { new:'rgba(249,115,22,.12)', investigating:'rgba(59,130,246,.12)', resolved:'rgba(34,197,94,.12)', false_positive:'rgba(148,163,184,.1)', open:'rgba(148,163,184,.1)', contained:'rgba(234,179,8,.12)', closed:'rgba(148,163,184,.05)' }

function timeAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  return `${Math.floor(h/24)}d ago`
}
function durationMins(from: string, to?: string | null) {
  const ms = (to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 60) return `${m}m`; if (m < 1440) return `${Math.floor(m/60)}h ${m%60}m`
  return `${Math.floor(m/1440)}d ${Math.floor((m%1440)/60)}h`
}

export default function SocPage() {
  const router = useRouter()
  const [tab, setTab]             = useState<'alerts'|'cases'>('alerts')
  const [alerts, setAlerts]       = useState<SocAlert[]>([])
  const [cases, setCases]         = useState<SocCase[]>([])
  const [totalAlerts, setTotalAlerts] = useState(0)
  const [totalCases,  setTotalCases]  = useState(0)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [expanded, setExpanded]   = useState<string|null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [alertText, setAlertText] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [creatingCase, setCreatingCase] = useState<string|null>(null)
  const [caseTitle, setCaseTitle] = useState('')
  const [caseSeverity, setCaseSeverity] = useState('Medium')
  const [savingCase, setSavingCase] = useState(false)

  const loadAlerts = useCallback(async () => {
    setLoading(true)
    const p = filter !== 'all' ? `?status=${filter}` : ''
    const r = await fetch(`/api/soc/alerts${p}`)
    if (r.ok) { const d = await r.json(); setAlerts(d.alerts||[]); setTotalAlerts(d.total||0) }
    setLoading(false)
  }, [filter])

  const loadCases = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/soc/cases')
    if (r.ok) { const d = await r.json(); setCases(d.cases||[]); setTotalCases(d.total||0) }
    setLoading(false)
  }, [])

  useEffect(() => { if (tab === 'alerts') loadAlerts(); else loadCases() }, [tab, loadAlerts, loadCases])

  async function updateStatus(id: string, status: string) {
    const r = await fetch(`/api/soc/alerts/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    if (r.ok) setAlerts(prev => prev.map(a => a.id === id ? {...a, status} : a))
  }
  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/soc/alerts/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({notes}) })
  }
  async function submitAlert() {
    if (!alertText.trim()) return
    setSubmitting(true); setSubmitErr('')
    const r = await fetch('/api/soc/alerts', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({alert_text:alertText}) })
    const d = await r.json()
    if (!r.ok) { setSubmitErr(d.error||'Failed'); setSubmitting(false); return }
    setAlertText(''); setShowSubmit(false)
    setAlerts(prev => [d.alert, ...prev]); setTotalAlerts(t => t+1)
    setExpanded(d.alert.id); setSubmitting(false)
  }
  function openCreateCase(alert: SocAlert) {
    setCreatingCase(alert.id)
    setCaseTitle(alert.title)
    setCaseSeverity(alert.severity)
  }
  async function createCase(alertId: string) {
    if (!caseTitle.trim()) return
    setSavingCase(true)
    const r = await fetch('/api/soc/cases', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ title: caseTitle, severity: caseSeverity, alert_id: alertId }) })
    const d = await r.json()
    if (r.ok) router.push(`/soc/cases/${d.case.id}`)
    setSavingCase(false)
  }

  const criticalCount = alerts.filter(a => a.severity === 'Critical' || a.escalate).length
  const resolvedToday = alerts.filter(a => a.status === 'resolved' &&
    new Date(a.updated_at||a.created_at).toDateString() === new Date().toDateString()).length
  const openCases = cases.filter(c => !['resolved','closed'].includes(c.status)).length

  const bd:  React.CSSProperties = { display:'inline-flex', alignItems:'center', padding:'.2rem .65rem', borderRadius:999, fontSize:'.7rem', fontWeight:600, whiteSpace:'nowrap' }
  const inp: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .85rem', color:'var(--text)', fontSize:'.82rem', fontFamily:'inherit', outline:'none', width:'100%' }
  const actBtn: React.CSSProperties = { padding:'.35rem .85rem', borderRadius:7, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }


  const alertStats = [
    { val: totalAlerts,   lbl: 'Total alerts' },
    { val: criticalCount, lbl: 'Critical / escalated' },
    { val: alerts.filter(a => a.status === 'new').length,          lbl: 'New (unreviewed)' },
    { val: alerts.filter(a => a.status === 'investigating').length, lbl: 'Investigating' },
    { val: resolvedToday, lbl: 'Resolved today' },
  ]
  const caseStats = [
    { val: totalCases, lbl: 'Total cases' },
    { val: openCases,  lbl: 'Open cases' },
    { val: cases.filter(c => c.status === 'investigating').length,                     lbl: 'Investigating' },
    { val: cases.filter(c => ['resolved','closed'].includes(c.status)).length,         lbl: 'Resolved' },
    { val: cases.filter(c => !!c.ai_summary).length,                                   lbl: 'With AI summary' },
  ]
  const statsItems = tab === 'alerts' ? alertStats : caseStats

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:'1.5rem 2rem' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <div style={{ fontSize:'1.35rem', fontWeight:700 }}>SOC</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.2rem' }}>AI-powered triage · {totalAlerts} alerts · {totalCases} cases</div>
        </div>
        <div style={{ display:'flex', gap:'.65rem' }}>
          {tab === 'alerts' && (
            <button onClick={() => setShowSubmit(v=>!v)}
              style={{ padding:'.55rem 1.1rem', borderRadius:8, background:'var(--bg4)', border:'1px solid var(--border)', color:'var(--text)', fontSize:'.85rem', cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
              + Paste alert
            </button>
          )}
          {tab === 'cases' && (
            <button onClick={() => router.push('/soc?tab=alerts')}
              style={{ padding:'.55rem 1.1rem', borderRadius:8, background:'#f97316', border:'none', color:'#fff', fontSize:'.85rem', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
              + New case
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:'.35rem', marginBottom:'1.25rem', borderBottom:'1px solid var(--border)', paddingBottom:'.75rem' }}>
        {(['alerts','cases'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setFilter('all') }}
            style={{ padding:'.45rem 1.1rem', borderRadius:8, border:'none', background: tab===t ? 'rgba(249,115,22,.15)' : 'transparent',
              color: tab===t ? '#f97316' : 'var(--muted)', fontSize:'.85rem', cursor:'pointer', fontFamily:'inherit', fontWeight: tab===t ? 600 : 400 }}>
            {t === 'alerts' ? `Alerts (${totalAlerts})` : `Cases (${totalCases})`}
          </button>
        ))}
      </div>

      {/* Paste alert box */}
      {tab === 'alerts' && showSubmit && (
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.25rem', marginBottom:'1.25rem' }}>
          <div style={{ fontSize:'.85rem', fontWeight:600, marginBottom:'.5rem' }}>Paste any alert</div>
          <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:'.75rem' }}>Raw JSON, Splunk, Sentinel, plain text — any format works.</div>
          <textarea value={alertText} onChange={e => setAlertText(e.target.value)} rows={6} placeholder={'{ "EventID": 4625, "Message": "Failed login", "IpAddress": "185.220.101.45" }'}
            style={{ ...inp, resize:'vertical', minHeight:100 }} />
          {submitErr && <div style={{ color:'var(--red)', fontSize:'.78rem', marginTop:'.4rem' }}>{submitErr}</div>}
          <div style={{ display:'flex', gap:'.65rem', marginTop:'.75rem' }}>
            <button onClick={submitAlert} disabled={submitting||!alertText.trim()}
              style={{ padding:'.55rem 1.25rem', borderRadius:8, background:submitting?'var(--muted2)':'#f97316', border:'none', color:'#fff', fontWeight:700, fontSize:'.85rem', cursor:submitting?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {submitting ? 'Triaging…' : 'Triage with AI'}
            </button>
            <button onClick={() => { setShowSubmit(false); setAlertText('') }} style={actBtn}>Cancel</button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'.75rem', marginBottom:'1.5rem' }}>
      {statsItems.map(({ val, lbl }) => (
          <div key={lbl} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.2rem' }}>
            <div style={{ fontSize:'1.75rem', fontWeight:700, color:'#f97316' }}>{val}</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem' }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'.5rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        {(tab === 'alerts'
          ? ['all','new','investigating','resolved','false_positive']
          : ['all','open','investigating','contained','resolved','closed']
        ).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:'.4rem .9rem', borderRadius:8, fontSize:'.8rem', cursor:'pointer', fontFamily:'inherit',
            background: filter===f ? 'rgba(249,115,22,.15)' : 'transparent',
            borderColor: filter===f ? 'rgba(249,115,22,.4)' : 'var(--border)',
            border: `1px solid ${filter===f ? 'rgba(249,115,22,.4)' : 'var(--border)'}`,
            color: filter===f ? '#f97316' : 'var(--muted)' }}>
            {f === 'all' ? `All (${tab==='alerts'?totalAlerts:totalCases})` : f.replace('_',' ')}
          </button>
        ))}
      </div>

      {loading && <div style={{ color:'var(--muted)', textAlign:'center', padding:'3rem', fontSize:'.85rem' }}>Loading…</div>}

      {/* ── ALERTS TAB ── */}
      {!loading && tab === 'alerts' && alerts.length === 0 && (
        <div style={{ color:'var(--muted)', textAlign:'center', padding:'3rem', fontSize:'.85rem', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12 }}>
          No alerts yet. Paste an alert above or configure a webhook from Settings → API Keys.
        </div>
      )}

      {tab === 'alerts' && alerts.map(alert => (
        <div key={alert.id} style={{ background:'var(--bg4)', border:`1px solid ${alert.escalate ? 'rgba(239,68,68,.4)' : 'var(--border)'}`, borderRadius:12, marginBottom:'.6rem', overflow:'hidden' }}>

          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', padding:'1rem 1.2rem', cursor:'pointer' }}
            onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
            <span style={{ ...bd, background:SEV_BG[alert.severity]||'var(--bg)', color:SEV_COLOR[alert.severity]||'var(--muted)', minWidth:64, justifyContent:'center' }}>{alert.severity}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:600, fontSize:'.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {alert.escalate && <span style={{ color:'var(--red)', marginRight:'.35rem' }}>⚑</span>}{alert.title}
              </div>
              <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem', display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
                {alert.mitre_technique && <span style={{ color:'#f97316' }}>{alert.mitre_technique}</span>}
                {alert.source_system   && <span>{alert.source_system}</span>}
                <span>{timeAgo(alert.created_at)}</span>
              </div>
            </div>
            <span style={{ ...bd, background:STA_BG[alert.status]||'transparent', color:STA_COLOR[alert.status]||'var(--muted)' }}>{alert.status.replace('_',' ')}</span>
            <span style={{ color:'var(--muted2)', fontSize:'.85rem', transform:expanded===alert.id?'rotate(90deg)':'none', transition:'transform .2s' }}>›</span>
          </div>

          {expanded === alert.id && (
            <div style={{ borderTop:'1px solid var(--border)', padding:'1.2rem' }}>
              <div style={{ marginBottom:'1rem' }}>
                <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>Summary</div>
                <div style={{ fontSize:'.85rem', color:'var(--muted)', lineHeight:1.65 }}>{alert.summary}</div>
              </div>

              {(alert.mitre_technique || alert.iocs?.length > 0) && (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1rem' }}>
                  {alert.mitre_technique && (
                    <div>
                      <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>MITRE ATT&amp;CK</div>
                      <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                        <span style={{ ...bd, background:'rgba(249,115,22,.12)', color:'#f97316' }}>{alert.mitre_technique}</span>
                        {alert.mitre_tactic && <span style={{ ...bd, background:'var(--bg)', color:'var(--muted)', border:'1px solid var(--border)' }}>{alert.mitre_tactic}</span>}
                      </div>
                    </div>
                  )}
                  {alert.iocs?.length > 0 && (
                    <div>
                      <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>IOCs ({alert.iocs.length})</div>
                      <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap' }}>
                        {alert.iocs.slice(0,6).map((ioc,i) => <span key={i} style={{ ...bd, background:'var(--bg)', color:'var(--muted)', border:'1px solid var(--border)', fontFamily:'monospace', fontSize:'.68rem' }}>{ioc}</span>)}
                        {alert.iocs.length > 6 && <span style={{ fontSize:'.72rem', color:'var(--muted2)' }}>+{alert.iocs.length-6} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {alert.investigation_steps?.length > 0 && (
                <div style={{ marginBottom:'1rem' }}>
                  <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>Investigation steps</div>
                  {alert.investigation_steps.map((s,i) => (
                    <div key={i} style={{ display:'flex', gap:'.65rem', padding:'.5rem .65rem', borderRadius:7, background:'var(--bg)', marginBottom:'.35rem', fontSize:'.82rem', color:'var(--muted)', lineHeight:1.5 }}>
                      <span style={{ color:'#f97316', fontWeight:700, flexShrink:0, minWidth:18, fontSize:'.75rem' }}>{i+1}</span>{s}
                    </div>
                  ))}
                </div>
              )}

              {alert.response_actions?.length > 0 && (
                <div style={{ marginBottom:'1rem' }}>
                  <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>Response actions</div>
                  {alert.response_actions.map((a,i) => (
                    <div key={i} style={{ display:'flex', gap:'.65rem', padding:'.5rem .65rem', borderRadius:7, background:'rgba(249,115,22,.05)', borderLeft:'2px solid rgba(249,115,22,.3)', marginBottom:'.35rem', fontSize:'.82rem', color:'var(--muted)', lineHeight:1.5 }}>
                      <span style={{ color:'#f97316', fontWeight:700, flexShrink:0, fontSize:'.75rem' }}>→</span>{a}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginBottom:'1rem' }}>
                <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.5rem' }}>Analyst notes</div>
                <textarea defaultValue={alert.notes} onBlur={e => saveNotes(alert.id, e.target.value)} placeholder="Add notes…" rows={2}
                  style={{ ...inp, resize:'vertical' }} />
              </div>

              {/* Create case inline form */}
              {creatingCase === alert.id ? (
                <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'1rem', marginBottom:'.75rem' }}>
                  <div style={{ fontSize:'.82rem', fontWeight:600, marginBottom:'.65rem' }}>Create case from this alert</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'.5rem', marginBottom:'.75rem' }}>
                    <input value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="Case title" style={inp} />
                    <select value={caseSeverity} onChange={e => setCaseSeverity(e.target.value)}
                      style={{ ...inp, width:'auto' }}>
                      {['Critical','High','Medium','Low'].map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display:'flex', gap:'.5rem' }}>
                    <button onClick={() => createCase(alert.id)} disabled={savingCase||!caseTitle.trim()}
                      style={{ padding:'.45rem 1rem', borderRadius:7, background:savingCase?'var(--muted2)':'#f97316', border:'none', color:'#fff', fontWeight:700, fontSize:'.8rem', cursor:savingCase?'not-allowed':'pointer', fontFamily:'inherit' }}>
                      {savingCase ? 'Creating…' : 'Create case'}
                    </button>
                    <button onClick={() => setCreatingCase(null)} style={actBtn}>Cancel</button>
                  </div>
                </div>
              ) : null}

              <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
                {alert.status !== 'investigating' && (
                  <button style={{ ...actBtn, borderColor:'rgba(59,130,246,.4)', color:'var(--blue)' }} onClick={() => updateStatus(alert.id,'investigating')}>Start investigating</button>
                )}
                {alert.status !== 'resolved' && (
                  <button style={{ ...actBtn, borderColor:'rgba(34,197,94,.4)', color:'var(--green)' }} onClick={() => updateStatus(alert.id,'resolved')}>Mark resolved</button>
                )}
                {alert.status !== 'false_positive' && (
                  <button style={actBtn} onClick={() => updateStatus(alert.id,'false_positive')}>False positive</button>
                )}
                <button style={{ ...actBtn, borderColor:'rgba(99,102,241,.4)', color:'var(--blue)' }}
                  onClick={() => openCreateCase(alert)}>
                  Create case →
                </button>
                <a href={`/generate?scenario=${encodeURIComponent(alert.summary||alert.title)}`}
                  style={{ ...actBtn, borderColor:'rgba(249,115,22,.4)', color:'#f97316', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                  Generate rule →
                </a>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* ── CASES TAB ── */}
      {!loading && tab === 'cases' && cases.length === 0 && (
        <div style={{ color:'var(--muted)', textAlign:'center', padding:'3rem', fontSize:'.85rem', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12 }}>
          No cases yet. Open an alert and click "Create case →" to start an investigation.
        </div>
      )}

      {tab === 'cases' && cases.map(c => (
        <div key={c.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, marginBottom:'.6rem', padding:'1rem 1.2rem',
          cursor:'pointer', display:'flex', alignItems:'center', gap:'.75rem' }}
          onClick={() => router.push(`/soc/cases/${c.id}`)}>
          <span style={{ ...bd, background:SEV_BG[c.severity]||'var(--bg)', color:SEV_COLOR[c.severity]||'var(--muted)', minWidth:64, justifyContent:'center' }}>{c.severity}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:600, fontSize:'.88rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.title}</div>
            <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem', display:'flex', gap:'.75rem', flexWrap:'wrap' }}>
              <span>{c.alert_count} alert{c.alert_count !== 1 ? 's' : ''}</span>
              <span>Open {durationMins(c.opened_at)}</span>
              <span>{timeAgo(c.created_at)}</span>
              {c.ai_summary && <span style={{ color:'var(--green)' }}>AI summary ready</span>}
            </div>
          </div>
          <span style={{ ...bd, background:STA_BG[c.status]||'transparent', color:STA_COLOR[c.status]||'var(--muted)' }}>{c.status}</span>
          <span style={{ color:'var(--muted2)', fontSize:'.85rem' }}>›</span>
        </div>
      ))}

    </div>
  )
}
