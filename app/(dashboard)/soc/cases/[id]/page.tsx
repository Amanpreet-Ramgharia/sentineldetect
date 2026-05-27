'use client'
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'

interface SocCase {
  id: string; title: string; description: string; severity: string; status: string
  ai_summary: string; ai_summary_at: string | null
  opened_at: string; contained_at: string | null; resolved_at: string | null; created_at: string
}
interface SocAlert {
  id: string; title: string; severity: string; status: string
  mitre_technique: string; summary: string; created_at: string; linked_at: string
}
interface CaseEvent {
  id: string; event_type: string; content: string; metadata: Record<string,unknown>; created_at: string
}

const SEV_COLOR: Record<string,string> = { Critical:'var(--red)', High:'#f97316', Medium:'#eab308', Low:'var(--blue)' }
const SEV_BG:    Record<string,string> = { Critical:'var(--red-bg)', High:'rgba(249,115,22,.12)', Medium:'rgba(234,179,8,.12)', Low:'rgba(59,130,246,.12)' }
const STA_COLOR: Record<string,string> = { new:'#f97316', investigating:'var(--blue)', resolved:'var(--green)', false_positive:'var(--muted)', open:'var(--muted)', contained:'#eab308', closed:'var(--muted2)' }
const STA_BG:    Record<string,string> = { new:'rgba(249,115,22,.12)', investigating:'rgba(59,130,246,.12)', resolved:'rgba(34,197,94,.12)', false_positive:'rgba(148,163,184,.1)', open:'rgba(148,163,184,.1)', contained:'rgba(234,179,8,.12)', closed:'rgba(148,163,184,.05)' }
const EV_ICON:   Record<string,string> = { alert_linked:'🔗', alert_unlinked:'✂️', status_change:'📋', note:'📝', ai_summary:'🤖', assignment:'👤' }

function dur(from: string, to?: string | null) {
  const m = Math.floor(((to ? new Date(to) : new Date()).getTime() - new Date(from).getTime()) / 60000)
  if (m < 60) return `${m}m`; if (m < 1440) return `${Math.floor(m/60)}h ${m%60}m`; return `${Math.floor(m/1440)}d ${Math.floor((m%1440)/60)}h`
}
function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
}

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [scase,   setScase]   = useState<SocCase|null>(null)
  const [alerts,  setAlerts]  = useState<SocAlert[]>([])
  const [events,  setEvents]  = useState<CaseEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [genLoading, setGenLoading] = useState(false)
  const [noteText, setNoteText]     = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [linkAlert, setLinkAlert]   = useState('')
  const [linking, setLinking]       = useState(false)

  async function load() {
    setLoading(true)
    const r = await fetch(`/api/soc/cases/${id}`)
    if (r.ok) { const d = await r.json(); setScase(d.case); setAlerts(d.alerts||[]); setEvents(d.events||[]) }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function updateStatus(status: string) {
    const r = await fetch(`/api/soc/cases/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({status}) })
    if (r.ok) { const d = await r.json(); setScase(d.case); load() }
  }

  async function generateSummary() {
    setGenLoading(true)
    const r = await fetch(`/api/soc/cases/${id}/summary`, { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' })
    if (r.ok) { load() }
    setGenLoading(false)
  }

  async function addNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    await fetch(`/api/soc/cases/${id}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({description: noteText}) })
    setEvents(prev => [{
      id: Date.now().toString(), event_type:'note', content: noteText,
      metadata:{}, created_at: new Date().toISOString()
    }, ...prev])
    setNoteText(''); setSavingNote(false)
  }

  async function linkAlertToCase() {
    if (!linkAlert.trim()) return
    setLinking(true)
    const r = await fetch(`/api/soc/cases/${id}/alerts`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({alert_id:linkAlert.trim()}) })
    if (r.ok) { setLinkAlert(''); load() }
    setLinking(false)
  }

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:'.85rem' }}>
      Loading case…
    </div>
  )
  if (!scase) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--muted)', fontSize:'.85rem' }}>
      Case not found. <button onClick={() => router.push('/soc')} style={{ marginLeft:'.5rem', color:'#f97316', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>← Back</button>
    </div>
  )

  const bd:  React.CSSProperties = { display:'inline-flex', alignItems:'center', padding:'.2rem .65rem', borderRadius:999, fontSize:'.7rem', fontWeight:600, whiteSpace:'nowrap' }
  const inp: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:8, padding:'.55rem .85rem', color:'var(--text)', fontSize:'.82rem', fontFamily:'inherit', outline:'none' }
  const secT: React.CSSProperties = { fontSize:'.72rem', fontWeight:600, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:'.65rem' }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', padding:'1.5rem 2rem' }}>

      {/* Back */}
      <button onClick={() => router.push('/soc')} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'.82rem', fontFamily:'inherit', marginBottom:'1rem', padding:0 }}>
        ← Back to SOC
      </button>

      {/* Case header */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.5rem', marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:'1rem', flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:'1.25rem', fontWeight:700, margin:'0 0 .5rem' }}>{scase.title}</h1>
            <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginBottom:'.75rem' }}>
              <span style={{ ...bd, background:SEV_BG[scase.severity]||'var(--bg)', color:SEV_COLOR[scase.severity]||'var(--muted)' }}>{scase.severity}</span>
              <span style={{ ...bd, background:STA_BG[scase.status]||'transparent', color:STA_COLOR[scase.status]||'var(--muted)' }}>{scase.status}</span>
              <span style={{ ...bd, background:'var(--bg)', color:'var(--muted)', border:'1px solid var(--border)', fontFamily:'monospace', fontSize:'.65rem' }}>{scase.id.slice(0,8)}</span>
            </div>
          </div>
          {/* SLA metrics */}
          <div style={{ display:'flex', gap:'.75rem', flexShrink:0, flexWrap:'wrap' }}>
            {[
              { lbl:'Duration', val: dur(scase.opened_at, scase.resolved_at) },
              { lbl:'Alerts', val: alerts.length },
              { lbl:'Events', val: events.length },
            ].map(m => (
              <div key={m.lbl} style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:'.65rem 1rem', textAlign:'center', minWidth:72 }}>
                <div style={{ fontSize:'1.25rem', fontWeight:700, color:'#f97316' }}>{m.val}</div>
                <div style={{ fontSize:'.68rem', color:'var(--muted)' }}>{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Status actions */}
        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap', marginTop:'.75rem' }}>
          {['investigating','contained','resolved','closed'].filter(s => s !== scase.status).map(s => (
            <button key={s} onClick={() => updateStatus(s)}
              style={{ padding:'.35rem .85rem', borderRadius:7, border:`1px solid ${STA_COLOR[s]||'var(--border)'}`, background:'transparent', color:STA_COLOR[s]||'var(--muted)', fontSize:'.78rem', cursor:'pointer', fontFamily:'inherit' }}>
              Mark {s}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:'1.25rem', alignItems:'start' }}>

        {/* Left: AI summary + alerts + timeline */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

          {/* AI Narrative */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.75rem' }}>
              <div style={secT}>AI Incident Narrative</div>
              <button onClick={generateSummary} disabled={genLoading || alerts.length === 0}
                style={{ padding:'.35rem .85rem', borderRadius:7, border:'none', background:genLoading?'var(--muted2)':'#f97316', color:'#fff', fontSize:'.78rem', cursor:genLoading||alerts.length===0?'not-allowed':'pointer', fontFamily:'inherit', fontWeight:600 }}>
                {genLoading ? 'Generating…' : scase.ai_summary ? 'Regenerate' : '✨ Generate'}
              </button>
            </div>
            {scase.ai_summary ? (
              <div>
                <div style={{ fontSize:'.85rem', color:'var(--muted)', lineHeight:1.7, whiteSpace:'pre-wrap' }}>{scase.ai_summary}</div>
                {scase.ai_summary_at && (
                  <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:'.75rem' }}>Generated {fmt(scase.ai_summary_at)}</div>
                )}
              </div>
            ) : (
              <div style={{ fontSize:'.82rem', color:'var(--muted2)', textAlign:'center', padding:'1.5rem 0' }}>
                {alerts.length === 0 ? 'Link alerts first, then generate the AI narrative.' : 'Click Generate to create an AI incident narrative from the linked alerts.'}
              </div>
            )}
          </div>

          {/* Linked alerts */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={secT}>Linked Alerts ({alerts.length})</div>
            {alerts.length === 0 && (
              <div style={{ fontSize:'.82rem', color:'var(--muted2)', padding:'.5rem 0' }}>No alerts linked. Use the form on the right to link an alert by ID.</div>
            )}
            {alerts.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:'.65rem', padding:'.65rem .85rem', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:9, marginBottom:'.4rem', cursor:'pointer' }}
                onClick={() => window.open('/soc','_self')}>
                <span style={{ ...bd, background:SEV_BG[a.severity]||'var(--bg)', color:SEV_COLOR[a.severity]||'var(--muted)', minWidth:56, justifyContent:'center', fontSize:'.65rem' }}>{a.severity}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.82rem', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.title}</div>
                  <div style={{ fontSize:'.72rem', color:'var(--muted)', marginTop:'.15rem', display:'flex', gap:'.5rem' }}>
                    {a.mitre_technique && <span style={{ color:'#f97316' }}>{a.mitre_technique}</span>}
                    <span style={{ ...bd, background:STA_BG[a.status]||'transparent', color:STA_COLOR[a.status]||'var(--muted)', fontSize:'.65rem', padding:'.1rem .45rem' }}>{a.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={secT}>Timeline ({events.length})</div>
            {events.length === 0 && <div style={{ fontSize:'.82rem', color:'var(--muted2)' }}>No events yet.</div>}
            <div style={{ position:'relative' }}>
              {events.map((ev, i) => (
                <div key={ev.id} style={{ display:'flex', gap:'.85rem', marginBottom: i < events.length-1 ? '1rem' : 0 }}>
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', flexShrink:0 }}>
                    <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--bg)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'.8rem' }}>
                      {EV_ICON[ev.event_type] || '·'}
                    </div>
                    {i < events.length-1 && <div style={{ width:1, flex:1, background:'var(--border)', margin:'.3rem 0', minHeight:16 }}/>}
                  </div>
                  <div style={{ flex:1, paddingTop:'.3rem' }}>
                    <div style={{ fontSize:'.82rem', color:'var(--text)', lineHeight:1.5 }}>{ev.content}</div>
                    <div style={{ fontSize:'.7rem', color:'var(--muted2)', marginTop:'.2rem' }}>{fmt(ev.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Actions panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

          {/* Link alert */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={secT}>Link alert</div>
            <input value={linkAlert} onChange={e => setLinkAlert(e.target.value)}
              placeholder="Alert ID (uuid)" style={{ ...inp, width:'100%', marginBottom:'.65rem' }} />
            <button onClick={linkAlertToCase} disabled={linking||!linkAlert.trim()}
              style={{ width:'100%', padding:'.55rem', borderRadius:8, background:linking?'var(--muted2)':'#f97316', border:'none', color:'#fff', fontWeight:600, fontSize:'.82rem', cursor:linking?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {linking ? 'Linking…' : 'Link alert'}
            </button>
            <div style={{ fontSize:'.72rem', color:'var(--muted2)', marginTop:'.5rem' }}>
              Find alert IDs in the Alerts tab. Copy the ID from the alert URL or the alert JSON.
            </div>
          </div>

          {/* Add note */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={secT}>Add note to timeline</div>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Write an analyst note…" rows={3}
              style={{ ...inp, width:'100%', resize:'vertical', minHeight:80, marginBottom:'.65rem' }} />
            <button onClick={addNote} disabled={savingNote||!noteText.trim()}
              style={{ width:'100%', padding:'.55rem', borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', fontWeight:500, fontSize:'.82rem', cursor:savingNote?'not-allowed':'pointer', fontFamily:'inherit' }}>
              {savingNote ? 'Saving…' : 'Add note'}
            </button>
          </div>

          {/* Case info */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'1.25rem' }}>
            <div style={secT}>Case info</div>
            {[
              { lbl:'Opened',    val: fmt(scase.opened_at) },
              { lbl:'Duration',  val: dur(scase.opened_at, scase.resolved_at) },
              { lbl:'Contained', val: scase.contained_at ? fmt(scase.contained_at) : '—' },
              { lbl:'Resolved',  val: scase.resolved_at  ? fmt(scase.resolved_at)  : '—' },
            ].map(({ lbl, val }) => (
              <div key={lbl} style={{ display:'flex', justifyContent:'space-between', padding:'.4rem 0', borderBottom:'1px solid var(--border)', fontSize:'.8rem' }}>
                <span style={{ color:'var(--muted)' }}>{lbl}</span>
                <span style={{ color:'var(--text)', fontFamily: lbl==='Opened'||lbl==='Contained'||lbl==='Resolved' ? 'monospace' : 'inherit', fontSize:'.78rem' }}>{val}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
