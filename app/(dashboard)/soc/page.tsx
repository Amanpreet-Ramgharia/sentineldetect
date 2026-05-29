'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SocAlert { id:string;title:string;severity:string;severity_score:number;summary:string;status:string;source:string;source_system:string|null;mitre_technique:string;mitre_tactic:string;iocs:string[];investigation_steps:string[];response_actions:string[];is_false_positive:boolean;escalate:boolean;escalation_reason:string;false_positive_reason:string;notes:string;alert_time:string;updated_at:string;created_at:string }
interface SocCase { id:string;title:string;severity:string;status:string;alert_count:number;opened_at:string;resolved_at:string|null;ai_summary:string;created_at:string }
interface Playbook { id:string;title:string;mitre_technique:string;mitre_tactic:string;overview:string;steps:Record<string,string[]>;created_at:string }
interface Analytics { overview:{total:number;resolved:number;fps:number;fpRate:number;avgMttd:number;avgMttr:number};volume:{date:string;count:number}[];bySeverity:{severity:string;count:number}[];byMitre:{technique:string;count:number}[];bySource:{source:string;count:number}[] }
interface Correlation { id:string;title:string;severity:string;status:string;mitre_technique:string;created_at:string;correlation_score:number;correlation_reasons:string[] }

// ── MITRE technique library for playbook picker ───────────────────────────────
const MITRE_TACTICS: Record<string, { id: string; name: string }[]> = {
  'Initial Access':    [{id:'T1566',name:'Phishing'},{id:'T1190',name:'Exploit Public-Facing App'},{id:'T1133',name:'External Remote Services'},{id:'T1078',name:'Valid Accounts'}],
  'Execution':         [{id:'T1059',name:'Command & Scripting Interpreter'},{id:'T1053',name:'Scheduled Task/Job'},{id:'T1203',name:'Exploitation for Execution'},{id:'T1047',name:'Windows Management Instrumentation'}],
  'Persistence':       [{id:'T1547',name:'Boot/Logon Autostart'},{id:'T1136',name:'Create Account'},{id:'T1543',name:'Create/Modify System Process'},{id:'T1098',name:'Account Manipulation'}],
  'Defense Evasion':   [{id:'T1055',name:'Process Injection'},{id:'T1562',name:'Impair Defenses'},{id:'T1070',name:'Indicator Removal'},{id:'T1036',name:'Masquerading'}],
  'Credential Access': [{id:'T1003',name:'OS Credential Dumping'},{id:'T1110',name:'Brute Force'},{id:'T1555',name:'Credentials from Password Stores'},{id:'T1558',name:'Steal or Forge Kerberos Tickets'}],
  'Discovery':         [{id:'T1082',name:'System Information Discovery'},{id:'T1046',name:'Network Service Discovery'},{id:'T1057',name:'Process Discovery'},{id:'T1083',name:'File & Directory Discovery'}],
  'Lateral Movement':  [{id:'T1021',name:'Remote Services'},{id:'T1570',name:'Lateral Tool Transfer'},{id:'T1550',name:'Use Alternate Auth Material'}],
  'C2':                [{id:'T1071',name:'App Layer Protocol'},{id:'T1105',name:'Ingress Tool Transfer'},{id:'T1568',name:'Dynamic Resolution'},{id:'T1573',name:'Encrypted Channel'}],
  'Exfiltration':      [{id:'T1041',name:'Exfil Over C2 Channel'},{id:'T1048',name:'Exfil Over Alt Protocol'},{id:'T1567',name:'Exfil Over Web Service'}],
  'Impact':            [{id:'T1486',name:'Data Encrypted for Impact'},{id:'T1490',name:'Inhibit System Recovery'},{id:'T1498',name:'Network Denial of Service'}],
}

// ── Style helpers ─────────────────────────────────────────────────────────────
const SC: Record<string,string> = { Critical:'var(--red)', High:'#f97316', Medium:'#eab308', Low:'var(--blue)' }
const SB: Record<string,string> = { Critical:'var(--red-bg)', High:'rgba(249,115,22,.12)', Medium:'rgba(234,179,8,.12)', Low:'rgba(59,130,246,.12)' }
const TC: Record<string,string> = { new:'#f97316',investigating:'var(--blue)',resolved:'var(--green)',false_positive:'var(--muted)',open:'var(--muted)',contained:'#eab308',closed:'var(--muted2)' }
const TB: Record<string,string> = { new:'rgba(249,115,22,.12)',investigating:'rgba(59,130,246,.12)',resolved:'rgba(34,197,94,.12)',false_positive:'rgba(148,163,184,.1)',open:'rgba(148,163,184,.1)',contained:'rgba(234,179,8,.12)',closed:'rgba(148,163,184,.05)' }
const CHART_COLORS = ['#f97316','#3b82f6','#eab308','#ef4444','#8b5cf6','#10b981','#06b6d4','#ec4899']

function tAgo(iso:string){const m=Math.floor((Date.now()-new Date(iso).getTime())/60000);if(m<1)return'just now';if(m<60)return`${m}m ago`;const h=Math.floor(m/60);if(h<24)return`${h}h ago`;return`${Math.floor(h/24)}d ago`}
function dur(from:string,to?:string|null){const m=Math.floor(((to?new Date(to):new Date()).getTime()-new Date(from).getTime())/60000);if(m<60)return`${m}m`;if(m<1440)return`${Math.floor(m/60)}h ${m%60}m`;return`${Math.floor(m/1440)}d`}

type Tab='alerts'|'cases'|'playbooks'|'analytics'

export default function SocPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('alerts')
  const [userId, setUserId] = useState('')

  // Alerts
  const [alerts,setAlerts]=useState<SocAlert[]>([]);const [totalAlerts,setTotalAlerts]=useState(0)
  const [alertsLoading,setAlertsLoading]=useState(true);const [alertFilter,setAlertFilter]=useState('all')
  const [expanded,setExpanded]=useState<string|null>(null);const [submitting,setSubmitting]=useState(false)
  const [alertText,setAlertText]=useState('');const [showSubmit,setShowSubmit]=useState(false)
  const [submitErr,setSubmitErr]=useState('');const [creatingCase,setCreatingCase]=useState<string|null>(null)
  const [caseTitle,setCaseTitle]=useState('');const [caseSev,setCaseSev]=useState('Medium');const [savingCase,setSavingCase]=useState(false)
  // Realtime toast
  const [liveToast,setLiveToast]=useState<SocAlert|null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>|null>(null)
  // Correlation
  const [correlations,setCorrelations]=useState<Record<string,Correlation[]>>({})
  const [loadingCorr,setLoadingCorr]=useState<string|null>(null)

  // Cases
  const [cases,setCases]=useState<SocCase[]>([]);const [totalCases,setTotalCases]=useState(0)
  const [casesLoading,setCasesLoading]=useState(false);const [caseFilter,setCaseFilter]=useState('all')

  // Playbooks
  const [playbooks,setPlaybooks]=useState<Playbook[]>([]);const [pbLoading,setPbLoading]=useState(false)
  const [selPb,setSelPb]=useState<Playbook|null>(null);const [generating,setGenerating]=useState(false)
  const [showGenForm,setShowGenForm]=useState(false)
  const [genMitre,setGenMitre]=useState('');const [genTactic,setGenTactic]=useState('')
  const [genCtx,setGenCtx]=useState('');const [genSearch,setGenSearch]=useState('')
  const [expandedTactic,setExpandedTactic]=useState<string|null>('Execution')

  // Analytics
  const [analytics,setAnalytics]=useState<Analytics|null>(null);const [analyticsLoading,setAnalyticsLoading]=useState(false)
  const [analyticsDays,setAnalyticsDays]=useState(30)

  // ── Load user ID for realtime filter ──────────────────────────────────────
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id)
    })
  }, [])

  // ── Supabase Realtime subscription ────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const sb = createClient()
    const channel = sb
      .channel('soc_alerts_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'soc_alerts', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newAlert = payload.new as SocAlert
          // Add to top of alerts list if on alerts tab
          setAlerts(prev => [newAlert, ...prev])
          setTotalAlerts(t => t + 1)
          // Show toast
          setLiveToast(newAlert)
          if (toastTimer.current) clearTimeout(toastTimer.current)
          toastTimer.current = setTimeout(() => setLiveToast(null), 6000)
        }
      )
      .subscribe()

    return () => {
      sb.removeChannel(channel)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [userId])

  // ── Loaders ────────────────────────────────────────────────────────────────
  const loadAlerts = useCallback(async () => {
    setAlertsLoading(true)
    const r = await fetch(`/api/soc/alerts${alertFilter !== 'all' ? `?status=${alertFilter}` : ''}`)
    if (r.ok) { const d = await r.json(); setAlerts(d.alerts || []); setTotalAlerts(d.total || 0) }
    setAlertsLoading(false)
  }, [alertFilter])

  const loadCases = useCallback(async () => {
    setCasesLoading(true)
    const r = await fetch(`/api/soc/cases${caseFilter !== 'all' ? `?status=${caseFilter}` : ''}`)
    if (r.ok) { const d = await r.json(); setCases(d.cases || []); setTotalCases(d.total || 0) }
    setCasesLoading(false)
  }, [caseFilter])

  const loadPlaybooks = useCallback(async () => {
    setPbLoading(true)
    const r = await fetch('/api/soc/playbooks')
    if (r.ok) { const d = await r.json(); setPlaybooks(d.playbooks || []) }
    setPbLoading(false)
  }, [])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    const r = await fetch(`/api/soc/analytics?days=${analyticsDays}`)
    if (r.ok) { const d = await r.json(); setAnalytics(d) }
    setAnalyticsLoading(false)
  }, [analyticsDays])

  useEffect(() => { if (tab === 'alerts') loadAlerts() }, [tab, loadAlerts])
  useEffect(() => { if (tab === 'cases') loadCases() }, [tab, loadCases])
  useEffect(() => { if (tab === 'playbooks') loadPlaybooks() }, [tab, loadPlaybooks])
  useEffect(() => { if (tab === 'analytics') loadAnalytics() }, [tab, loadAnalytics])

  // ── Correlation loader (fires when alert is expanded) ──────────────────────
  async function loadCorrelations(alertId: string) {
    if (correlations[alertId] || loadingCorr === alertId) return
    setLoadingCorr(alertId)
    const r = await fetch(`/api/soc/alerts/${alertId}/correlate`)
    if (r.ok) {
      const d = await r.json()
      setCorrelations(prev => ({ ...prev, [alertId]: d.correlations || [] }))
    }
    setLoadingCorr(null)
  }

  function handleExpand(alertId: string) {
    const next = expanded === alertId ? null : alertId
    setExpanded(next)
    if (next) loadCorrelations(next)
  }

  // ── Alert actions ──────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: string) {
    const r = await fetch(`/api/soc/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (r.ok) setAlerts(p => p.map(a => a.id === id ? { ...a, status } : a))
  }
  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/soc/alerts/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes }) })
  }
  async function submitAlert() {
    if (!alertText.trim()) return; setSubmitting(true); setSubmitErr('')
    const r = await fetch('/api/soc/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alert_text: alertText }) })
    const d = await r.json()
    if (!r.ok) { setSubmitErr(d.error || 'Failed'); setSubmitting(false); return }
    setAlertText(''); setShowSubmit(false); setSubmitting(false)
  }
  async function createCase(alertId: string) {
    if (!caseTitle.trim()) return; setSavingCase(true)
    const r = await fetch('/api/soc/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: caseTitle, severity: caseSev, alert_id: alertId }) })
    const d = await r.json()
    if (r.ok) router.push(`/soc/cases/${d.case.id}`)
    setSavingCase(false)
  }

  // ── Playbook actions ───────────────────────────────────────────────────────
  const [genError, setGenError] = useState('')
  async function generatePlaybook() {
    if (!genMitre.trim()) return; setGenerating(true); setGenError('')
    try {
      const r = await fetch('/api/soc/playbooks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mitre_technique: genMitre, mitre_tactic: genTactic, context: genCtx }) })
      const d = await r.json()
      if (!r.ok) { setGenError(d.error || 'Generation failed — check your Gemini API key in Settings'); return }
      setPlaybooks(p => [d.playbook, ...p]); setSelPb(d.playbook); setShowGenForm(false); setGenMitre(''); setGenTactic(''); setGenCtx('')
    } catch (e: any) { setGenError(e.message || 'Network error') }
    finally { setGenerating(false) }
  }
  async function deletePlaybook(id: string) {
    if (!confirm('Delete this playbook?')) return
    await fetch(`/api/soc/playbooks/${id}`, { method: 'DELETE' })
    setPlaybooks(p => p.filter(pb => pb.id !== id)); if (selPb?.id === id) setSelPb(null)
  }

  // Filtered MITRE techniques for search
  const filteredMitre = genSearch.trim()
    ? Object.entries(MITRE_TACTICS).flatMap(([tactic, techs]) =>
        techs.filter(t => t.id.toLowerCase().includes(genSearch.toLowerCase()) || t.name.toLowerCase().includes(genSearch.toLowerCase()))
          .map(t => ({ ...t, tactic }))
      )
    : []

  const criticalCount = alerts.filter(a => a.severity === 'Critical' || a.escalate).length
  const resolvedToday = alerts.filter(a => a.status === 'resolved' && new Date(a.updated_at || a.created_at).toDateString() === new Date().toDateString()).length
  const openCases = cases.filter(c => !['resolved', 'closed'].includes(c.status)).length

  const bd: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', padding: '.2rem .65rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 600, whiteSpace: 'nowrap' }
  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '.55rem .85rem', color: 'var(--text)', fontSize: '.82rem', fontFamily: 'inherit', outline: 'none', width: '100%' }
  const actBtn: React.CSSProperties = { padding: '.35rem .85rem', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit' }
  const tabBtn = (t: Tab): React.CSSProperties => ({ padding: '.45rem 1.1rem', borderRadius: 8, border: 'none', background: tab === t ? 'rgba(249,115,22,.15)' : 'transparent', color: tab === t ? '#f97316' : 'var(--muted)', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: tab === t ? 600 : 400 })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '1.5rem 2rem' }}>

      {/* ── Live alert toast ───────────────────────────────────────────────── */}
      {liveToast && (
        <div style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 999, background: 'var(--bg4)', border: `1px solid ${SB[liveToast.severity] || 'var(--border)'}`, borderLeft: `3px solid ${SC[liveToast.severity] || '#f97316'}`, borderRadius: 10, padding: '.85rem 1.1rem', maxWidth: 340, boxShadow: '0 8px 24px rgba(0,0,0,.3)', animation: 'slideIn .25s ease' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '.65rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '.7rem', color: SC[liveToast.severity] || '#f97316', fontWeight: 700, marginBottom: '.2rem' }}>LIVE — New {liveToast.severity} Alert</div>
              <div style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--text)', marginBottom: '.25rem' }}>{liveToast.title}</div>
              {liveToast.mitre_technique && <span style={{ ...bd, background: 'rgba(249,115,22,.12)', color: '#f97316', fontSize: '.65rem' }}>{liveToast.mitre_technique}</span>}
            </div>
            <button onClick={() => setLiveToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1rem', lineHeight: 1, padding: '.1rem' }}>×</button>
          </div>
          <button onClick={() => { setTab('alerts'); setExpanded(liveToast.id); setLiveToast(null) }}
            style={{ marginTop: '.65rem', width: '100%', padding: '.4rem', borderRadius: 6, background: '#f97316', border: 'none', color: '#fff', fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
            View alert →
          </button>
        </div>
      )}

      <style>{`@keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>SOC</div>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.2rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', boxShadow: '0 0 6px var(--green)' }}/>
            Live · {totalAlerts} alerts · {totalCases} cases
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.65rem' }}>
          {tab === 'alerts' && <button onClick={() => setShowSubmit(v => !v)} style={{ padding: '.55rem 1.1rem', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>+ Paste alert</button>}
          {tab === 'playbooks' && <button onClick={() => setShowGenForm(v => !v)} style={{ padding: '.55rem 1.1rem', borderRadius: 8, background: '#f97316', border: 'none', color: '#fff', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>+ Generate playbook</button>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '.35rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '.75rem' }}>
        {(['alerts', 'cases', 'playbooks', 'analytics'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={tabBtn(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'alerts' && totalAlerts > 0 ? ` (${totalAlerts})` : ''}
            {t === 'cases' && totalCases > 0 ? ` (${totalCases})` : ''}
          </button>
        ))}
      </div>

      {/* ══ ALERTS TAB ══════════════════════════════════════════════════════════ */}
      {tab === 'alerts' && (
        <>
          {showSubmit && (
            <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.5rem' }}>Paste any alert</div>
              <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '.75rem' }}>Raw JSON, Splunk, Sentinel, plain text — auto-detected and normalised.</div>
              <textarea value={alertText} onChange={e => setAlertText(e.target.value)} rows={5}
                placeholder={'{ "EventID": 4625, "Message": "Failed login", "IpAddress": "185.220.101.45" }'}
                style={{ ...inp, resize: 'vertical', minHeight: 90, marginBottom: '.65rem' }} />
              {submitErr && <div style={{ color: 'var(--red)', fontSize: '.78rem', marginBottom: '.5rem' }}>{submitErr}</div>}
              <div style={{ display: 'flex', gap: '.65rem' }}>
                <button onClick={submitAlert} disabled={submitting || !alertText.trim()} style={{ padding: '.55rem 1.25rem', borderRadius: 8, background: submitting ? 'var(--muted2)' : '#f97316', border: 'none', color: '#fff', fontWeight: 700, fontSize: '.85rem', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {submitting ? 'Triaging…' : 'Triage with AI'}
                </button>
                <button onClick={() => { setShowSubmit(false); setAlertText('') }} style={actBtn}>Cancel</button>
              </div>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
            {[{ val: totalAlerts, lbl: 'Total alerts' }, { val: criticalCount, lbl: 'Critical / escalated' }, { val: alerts.filter(a => a.status === 'new').length, lbl: 'New (unreviewed)' }, { val: alerts.filter(a => a.status === 'investigating').length, lbl: 'Investigating' }, { val: resolvedToday, lbl: 'Resolved today' }].map(({ val, lbl }) => (
              <div key={lbl} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.2rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f97316' }}>{val}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem' }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {(['all', 'new', 'investigating', 'resolved', 'false_positive'] as const).map(f => (
              <button key={f} onClick={() => setAlertFilter(f)} style={{ padding: '.4rem .9rem', borderRadius: 8, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${alertFilter === f ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, background: alertFilter === f ? 'rgba(249,115,22,.15)' : 'transparent', color: alertFilter === f ? '#f97316' : 'var(--muted)' }}>
                {f === 'all' ? `All (${totalAlerts})` : f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {alertsLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem' }}>Loading…</div>}
          {!alertsLoading && alerts.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12 }}>No alerts yet. Paste an alert above or configure a webhook from Settings → API Keys.</div>}

          {alerts.map(alert => (
            <div key={alert.id} style={{ background: 'var(--bg4)', border: `1px solid ${alert.escalate ? 'rgba(239,68,68,.4)' : 'var(--border)'}`, borderRadius: 12, marginBottom: '.6rem', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.2rem', cursor: 'pointer' }} onClick={() => handleExpand(alert.id)}>
                <span style={{ ...bd, background: SB[alert.severity] || 'var(--bg)', color: SC[alert.severity] || 'var(--muted)', minWidth: 64, justifyContent: 'center' }}>{alert.severity}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {alert.escalate && <span style={{ color: 'var(--red)', marginRight: '.35rem' }}>⚑</span>}{alert.title}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                    {alert.mitre_technique && <span style={{ color: '#f97316' }}>{alert.mitre_technique}</span>}
                    {alert.source_system && <span>{alert.source_system}</span>}
                    <span>{tAgo(alert.created_at)}</span>
                    {correlations[alert.id]?.length > 0 && <span style={{ color: 'var(--blue)' }}>⟷ {correlations[alert.id].length} related alert{correlations[alert.id].length > 1 ? 's' : ''}</span>}
                  </div>
                </div>
                <span style={{ ...bd, background: TB[alert.status] || 'transparent', color: TC[alert.status] || 'var(--muted)' }}>{alert.status.replace('_', ' ')}</span>
                <span style={{ color: 'var(--muted2)', fontSize: '.85rem', transform: expanded === alert.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
              </div>

              {expanded === alert.id && (
                <div style={{ borderTop: '1px solid var(--border)', padding: '1.2rem' }}>

                  {/* Correlation hints */}
                  {loadingCorr === alert.id && <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '1rem' }}>Checking for related alerts…</div>}
                  {correlations[alert.id]?.length > 0 && (
                    <div style={{ background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.2)', borderRadius: 9, padding: '.75rem 1rem', marginBottom: '1rem' }}>
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
                        ⟷ {correlations[alert.id].length} related alert{correlations[alert.id].length > 1 ? 's' : ''} — consider grouping into a case
                      </div>
                      {correlations[alert.id].map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '.65rem', padding: '.4rem 0', borderBottom: '1px solid rgba(59,130,246,.1)' }}>
                          <span style={{ ...bd, background: SB[c.severity] || 'var(--bg)', color: SC[c.severity] || 'var(--muted)', fontSize: '.65rem' }}>{c.severity}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '.8rem', color: 'var(--text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                            <div style={{ fontSize: '.7rem', color: 'var(--muted2)', marginTop: '.15rem' }}>{c.correlation_reasons.join(' · ')} · {tAgo(c.created_at)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Summary */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Summary</div>
                    <div style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: 1.65 }}>{alert.summary}</div>
                  </div>

                  {(alert.mitre_technique || alert.iocs?.length > 0) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      {alert.mitre_technique && <div><div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>MITRE ATT&CK</div><div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}><span style={{ ...bd, background: 'rgba(249,115,22,.12)', color: '#f97316' }}>{alert.mitre_technique}</span>{alert.mitre_tactic && <span style={{ ...bd, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{alert.mitre_tactic}</span>}</div></div>}
                      {alert.iocs?.length > 0 && <div><div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>IOCs ({alert.iocs.length})</div><div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>{alert.iocs.slice(0, 6).map((ioc, i) => <span key={i} style={{ ...bd, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '.68rem' }}>{ioc}</span>)}{alert.iocs.length > 6 && <span style={{ fontSize: '.72rem', color: 'var(--muted2)' }}>+{alert.iocs.length - 6}</span>}</div></div>}
                    </div>
                  )}

                  {alert.investigation_steps?.length > 0 && <div style={{ marginBottom: '1rem' }}><div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Investigation steps</div>{alert.investigation_steps.map((s, i) => <div key={i} style={{ display: 'flex', gap: '.65rem', padding: '.5rem .65rem', borderRadius: 7, background: 'var(--bg)', marginBottom: '.35rem', fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5 }}><span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, minWidth: 18, fontSize: '.75rem' }}>{i + 1}</span>{s}</div>)}</div>}
                  {alert.response_actions?.length > 0 && <div style={{ marginBottom: '1rem' }}><div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Response actions</div>{alert.response_actions.map((a, i) => <div key={i} style={{ display: 'flex', gap: '.65rem', padding: '.5rem .65rem', borderRadius: 7, background: 'rgba(249,115,22,.05)', borderLeft: '2px solid rgba(249,115,22,.3)', marginBottom: '.35rem', fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5 }}><span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, fontSize: '.75rem' }}>→</span>{a}</div>)}</div>}

                  <div style={{ marginBottom: '1rem' }}><div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>Analyst notes</div><textarea defaultValue={alert.notes} onBlur={e => saveNotes(alert.id, e.target.value)} placeholder="Add notes…" rows={2} style={{ ...inp, resize: 'vertical' }} /></div>

                  {creatingCase === alert.id && (
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem', marginBottom: '.75rem' }}>
                      <div style={{ fontSize: '.82rem', fontWeight: 600, marginBottom: '.65rem' }}>Create case from this alert</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem', marginBottom: '.75rem' }}>
                        <input value={caseTitle} onChange={e => setCaseTitle(e.target.value)} placeholder="Case title" style={inp} />
                        <select value={caseSev} onChange={e => setCaseSev(e.target.value)} style={{ ...inp, width: 'auto' }}>
                          {['Critical', 'High', 'Medium', 'Low'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '.5rem' }}>
                        <button onClick={() => createCase(alert.id)} disabled={savingCase || !caseTitle.trim()} style={{ padding: '.45rem 1rem', borderRadius: 7, background: savingCase ? 'var(--muted2)' : '#f97316', border: 'none', color: '#fff', fontWeight: 700, fontSize: '.8rem', cursor: savingCase ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{savingCase ? 'Creating…' : 'Create case'}</button>
                        <button onClick={() => setCreatingCase(null)} style={actBtn}>Cancel</button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                    {alert.status !== 'investigating' && <button style={{ ...actBtn, borderColor: 'rgba(59,130,246,.4)', color: 'var(--blue)' }} onClick={() => updateStatus(alert.id, 'investigating')}>Start investigating</button>}
                    {alert.status !== 'resolved' && <button style={{ ...actBtn, borderColor: 'rgba(34,197,94,.4)', color: 'var(--green)' }} onClick={() => updateStatus(alert.id, 'resolved')}>Mark resolved</button>}
                    {alert.status !== 'false_positive' && <button style={actBtn} onClick={() => updateStatus(alert.id, 'false_positive')}>False positive</button>}
                    <button style={{ ...actBtn, borderColor: 'rgba(99,102,241,.4)', color: 'var(--blue)' }} onClick={() => { setCreatingCase(alert.id); setCaseTitle(alert.title); setCaseSev(alert.severity) }}>Create case →</button>
                    {alert.mitre_technique && <button style={{ ...actBtn, borderColor: 'rgba(249,115,22,.3)', color: '#f97316' }} onClick={() => { setTab('playbooks'); setGenMitre(alert.mitre_technique); setGenTactic(alert.mitre_tactic); setGenCtx(alert.summary); setShowGenForm(true) }}>Generate playbook →</button>}
                    <a href={`/generate?scenario=${encodeURIComponent(alert.summary || alert.title)}`} style={{ ...actBtn, borderColor: 'rgba(249,115,22,.4)', color: '#f97316', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>Generate rule →</a>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {/* ══ CASES TAB ═══════════════════════════════════════════════════════════ */}
      {tab === 'cases' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
            {[{ val: totalCases, lbl: 'Total cases' }, { val: openCases, lbl: 'Open cases' }, { val: cases.filter(c => c.status === 'investigating').length, lbl: 'Investigating' }, { val: cases.filter(c => ['resolved', 'closed'].includes(c.status)).length, lbl: 'Resolved' }, { val: cases.filter(c => !!c.ai_summary).length, lbl: 'With AI summary' }].map(({ val, lbl }) => (
              <div key={lbl} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.2rem' }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f97316' }}>{val}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem' }}>{lbl}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
            {['all', 'open', 'investigating', 'contained', 'resolved', 'closed'].map(f => (
              <button key={f} onClick={() => setCaseFilter(f)} style={{ padding: '.4rem .9rem', borderRadius: 8, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${caseFilter === f ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, background: caseFilter === f ? 'rgba(249,115,22,.15)' : 'transparent', color: caseFilter === f ? '#f97316' : 'var(--muted)' }}>
                {f === 'all' ? `All (${totalCases})` : f}
              </button>
            ))}
          </div>
          {casesLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem' }}>Loading…</div>}
          {!casesLoading && cases.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12 }}>No cases yet. Open an alert and click "Create case →".</div>}
          {cases.map(c => (
            <div key={c.id} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: '.6rem', padding: '1rem 1.2rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '.75rem' }} onClick={() => router.push(`/soc/cases/${c.id}`)}>
              <span style={{ ...bd, background: SB[c.severity] || 'var(--bg)', color: SC[c.severity] || 'var(--muted)', minWidth: 64, justifyContent: 'center' }}>{c.severity}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                  <span>{c.alert_count} alert{c.alert_count !== 1 ? 's' : ''}</span><span>Open {dur(c.opened_at)}</span><span>{tAgo(c.created_at)}</span>
                  {c.ai_summary && <span style={{ color: 'var(--green)' }}>AI summary ready</span>}
                </div>
              </div>
              <span style={{ ...bd, background: TB[c.status] || 'transparent', color: TC[c.status] || 'var(--muted)' }}>{c.status}</span>
              <span style={{ color: 'var(--muted2)', fontSize: '.85rem' }}>›</span>
            </div>
          ))}
        </>
      )}

      {/* ══ PLAYBOOKS TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'playbooks' && (
        <>
          {/* Generate form with MITRE picker */}
          {showGenForm && (
            <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '.88rem', fontWeight: 600, marginBottom: '.75rem' }}>Generate playbook</div>

              {/* Selected technique display */}
              {genMitre && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '.65rem', padding: '.65rem .85rem', background: 'rgba(249,115,22,.08)', border: '1px solid rgba(249,115,22,.25)', borderRadius: 8, marginBottom: '.75rem' }}>
                  <span style={{ fontSize: '.85rem', fontWeight: 700, color: '#f97316', fontFamily: 'monospace' }}>{genMitre}</span>
                  {genTactic && <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>· {genTactic}</span>}
                  <button onClick={() => { setGenMitre(''); setGenTactic('') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '.85rem' }}>×</button>
                </div>
              )}

              {/* Search */}
              <input value={genSearch} onChange={e => setGenSearch(e.target.value)}
                placeholder="Search techniques (e.g. T1059, phishing, brute force)…"
                style={{ ...inp, marginBottom: '.75rem' }} />

              {/* Search results */}
              {genSearch && filteredMitre.length > 0 && (
                <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: '.75rem', maxHeight: 200, overflowY: 'auto' }}>
                  {filteredMitre.map(t => (
                    <div key={t.id} onClick={() => { setGenMitre(t.id); setGenTactic(t.tactic); setGenSearch('') }}
                      style={{ padding: '.6rem .9rem', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', gap: '.65rem', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg4)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                      <span style={{ fontFamily: 'monospace', fontSize: '.75rem', color: '#f97316', flexShrink: 0 }}>{t.id}</span>
                      <span style={{ fontSize: '.82rem', color: 'var(--text)' }}>{t.name}</span>
                      <span style={{ fontSize: '.7rem', color: 'var(--muted2)', marginLeft: 'auto' }}>{t.tactic}</span>
                    </div>
                  ))}
                </div>
              )}
              {genSearch && filteredMitre.length === 0 && (
                <div style={{ fontSize: '.78rem', color: 'var(--muted2)', marginBottom: '.75rem', padding: '.5rem .85rem' }}>No techniques found for "{genSearch}"</div>
              )}

              {/* Tactic browser */}
              {!genSearch && (
                <div style={{ marginBottom: '.75rem' }}>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: '.4rem' }}>Browse by tactic:</div>
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginBottom: '.5rem' }}>
                    {Object.keys(MITRE_TACTICS).map(tactic => (
                      <button key={tactic} onClick={() => setExpandedTactic(expandedTactic === tactic ? null : tactic)}
                        style={{ padding: '.25rem .7rem', borderRadius: 6, fontSize: '.72rem', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${expandedTactic === tactic ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, background: expandedTactic === tactic ? 'rgba(249,115,22,.12)' : 'var(--bg)', color: expandedTactic === tactic ? '#f97316' : 'var(--muted)' }}>
                        {tactic}
                      </button>
                    ))}
                  </div>
                  {expandedTactic && (
                    <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', padding: '.5rem .65rem', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                      {MITRE_TACTICS[expandedTactic].map(t => (
                        <button key={t.id} onClick={() => { setGenMitre(t.id); setGenTactic(expandedTactic) }}
                          style={{ padding: '.3rem .75rem', borderRadius: 6, fontSize: '.75rem', cursor: 'pointer', fontFamily: 'inherit', background: genMitre === t.id ? 'rgba(249,115,22,.12)' : 'var(--bg4)', border: `1px solid ${genMitre === t.id ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, color: genMitre === t.id ? '#f97316' : 'var(--muted)', textAlign: 'left' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '.7rem', marginRight: '.35rem' }}>{t.id}</span>{t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Context + generate */}
              <textarea value={genCtx} onChange={e => setGenCtx(e.target.value)}
                placeholder="Optional context — paste alert summary, threat intel, or describe the specific scenario…"
                rows={2} style={{ ...inp, resize: 'vertical', marginBottom: '.65rem' }} />
              <div style={{ display: 'flex', gap: '.65rem', alignItems: 'center' }}>
                {genError && <div style={{ color:'var(--red)', fontSize:'.78rem', marginBottom:'.5rem', padding:'.5rem .75rem', background:'var(--red-bg)', borderRadius:7, border:'1px solid var(--red-bd)' }}>{genError}</div>}
                <button onClick={generatePlaybook} disabled={generating || !genMitre.trim()}
                  style={{ padding: '.55rem 1.25rem', borderRadius: 8, background: generating || !genMitre ? 'var(--muted2)' : '#f97316', border: 'none', color: '#fff', fontWeight: 700, fontSize: '.85rem', cursor: generating || !genMitre ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                  {generating ? 'Generating…' : `Generate playbook${genMitre ? ` for ${genMitre}` : ''}`}
                </button>
                <button onClick={() => setShowGenForm(false)} style={actBtn}>Cancel</button>
              </div>
            </div>
          )}

          {pbLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem' }}>Loading…</div>}
          {!pbLoading && playbooks.length === 0 && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12 }}>No playbooks yet. Click "Generate playbook" to create one — browse by tactic or search for a technique.</div>}

          <div style={{ display: 'grid', gridTemplateColumns: selPb ? '280px 1fr' : 'repeat(auto-fill,minmax(260px,1fr))', gap: '1rem' }}>
            <div>
              {playbooks.map(pb => (
                <div key={pb.id} onClick={() => setSelPb(selPb?.id === pb.id ? null : pb)} style={{ background: 'var(--bg4)', border: `1px solid ${selPb?.id === pb.id ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, borderRadius: 10, padding: '.9rem 1rem', marginBottom: '.5rem', cursor: 'pointer', borderLeft: `3px solid ${selPb?.id === pb.id ? '#f97316' : 'transparent'}` }}>
                  <div style={{ fontWeight: 600, fontSize: '.85rem', marginBottom: '.3rem' }}>{pb.title}</div>
                  <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                    {pb.mitre_technique && <span style={{ fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: 4, background: 'rgba(249,115,22,.12)', color: '#f97316', fontFamily: 'monospace' }}>{pb.mitre_technique}</span>}
                    {pb.mitre_tactic && <span style={{ fontSize: '.65rem', padding: '.1rem .4rem', borderRadius: 4, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{pb.mitre_tactic}</span>}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted2)', marginTop: '.4rem' }}>{tAgo(pb.created_at)}</div>
                </div>
              ))}
            </div>

            {selPb && (
              <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', overflowY: 'auto', maxHeight: '80vh' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', gap: '.75rem' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '.4rem' }}>{selPb.title}</div>
                    <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                      {selPb.mitre_technique && <span style={{ fontSize: '.68rem', padding: '.15rem .5rem', borderRadius: 4, background: 'rgba(249,115,22,.12)', color: '#f97316', fontFamily: 'monospace' }}>{selPb.mitre_technique}</span>}
                      {selPb.mitre_tactic && <span style={{ fontSize: '.68rem', padding: '.15rem .5rem', borderRadius: 4, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{selPb.mitre_tactic}</span>}
                    </div>
                  </div>
                  <button onClick={() => deletePlaybook(selPb.id)} style={{ padding: '.3rem .7rem', borderRadius: 6, border: '1px solid var(--red-bd)', background: 'var(--red-bg)', color: 'var(--red)', fontSize: '.72rem', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Delete</button>
                </div>
                {selPb.overview && <p style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: 1.65, marginBottom: '1rem' }}>{selPb.overview}</p>}
                {([['Triage', 'triage'], ['Investigation', 'investigation'], ['Containment', 'containment'], ['Eradication', 'eradication'], ['Evidence to collect', 'evidence_to_collect'], ['Escalation criteria', 'escalation_criteria']] as [string, string][]).map(([label, key]) => {
                  const steps = selPb.steps[key] || []; if (!steps.length) return null
                  return (
                    <div key={key} style={{ marginBottom: '.85rem' }}>
                      <div style={{ fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.45rem' }}>{label}</div>
                      {steps.map((step: string, i: number) => (
                        <div key={i} style={{ display: 'flex', gap: '.65rem', padding: '.45rem .65rem', borderRadius: 7, background: 'var(--bg)', marginBottom: '.3rem', fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5 }}>
                          <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, minWidth: 18, fontSize: '.72rem' }}>{i + 1}</span>{step}
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ══ ANALYTICS TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'analytics' && (
        <>
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1.25rem' }}>
            {[7, 14, 30, 90].map(d => (
              <button key={d} onClick={() => setAnalyticsDays(d)} style={{ padding: '.4rem .9rem', borderRadius: 8, fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${analyticsDays === d ? 'rgba(249,115,22,.4)' : 'var(--border)'}`, background: analyticsDays === d ? 'rgba(249,115,22,.15)' : 'transparent', color: analyticsDays === d ? '#f97316' : 'var(--muted)' }}>
                {d}d
              </button>
            ))}
          </div>
          {analyticsLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem' }}>Loading analytics…</div>}
          {analytics && !analyticsLoading && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '.75rem', marginBottom: '1.5rem' }}>
                {[{ val: analytics.overview.total, lbl: 'Total alerts' }, { val: analytics.overview.resolved, lbl: 'Resolved' }, { val: `${analytics.overview.fpRate}%`, lbl: 'False positive rate' }, { val: analytics.overview.avgMttd === 0 ? '—' : `${analytics.overview.avgMttd}m`, lbl: 'Avg MTTD' }, { val: analytics.overview.avgMttr === 0 ? '—' : `${analytics.overview.avgMttr}m`, lbl: 'Avg MTTR' }].map(({ val, lbl }) => (
                  <div key={lbl} style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.2rem' }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#f97316' }}>{val}</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem' }}>{lbl}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>Alert Volume ({analyticsDays}d)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={analytics.volume} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="vol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="95%" stopColor="#f97316" stopOpacity={0} /></linearGradient></defs>
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} interval={Math.floor(analytics.volume.length / 5)} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Area type="monotone" dataKey="count" stroke="#f97316" fill="url(#vol)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>Top MITRE Techniques</div>
                  {analytics.byMitre.length === 0 && <div style={{ color: 'var(--muted2)', fontSize: '.82rem', padding: '2rem 0', textAlign: 'center' }}>No MITRE data yet</div>}
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={analytics.byMitre} layout="vertical" margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="technique" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickLine={false} axisLine={false} width={65} />
                      <Tooltip contentStyle={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>{analytics.byMitre.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>Severity Breakdown</div>
                  {analytics.bySeverity.map(({ severity, count }) => {
                    const pct = analytics.overview.total > 0 ? Math.round(count / analytics.overview.total * 100) : 0
                    return (<div key={severity} style={{ marginBottom: '.65rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}><span style={{ fontSize: '.8rem', color: SC[severity] || 'var(--muted)', fontWeight: 500 }}>{severity}</span><span style={{ fontSize: '.78rem', color: 'var(--muted2)' }}>{count} ({pct}%)</span></div><div style={{ background: 'var(--bg)', borderRadius: 999, height: 6, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: SC[severity] || '#f97316', borderRadius: 999 }} /></div></div>)
                  })}
                </div>
                <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem' }}>
                  <div style={{ fontSize: '.78rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '1rem' }}>Alert Sources</div>
                  {analytics.bySource.map(({ source, count }, i) => {
                    const pct = analytics.overview.total > 0 ? Math.round(count / analytics.overview.total * 100) : 0
                    return (<div key={source} style={{ marginBottom: '.65rem' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.25rem' }}><span style={{ fontSize: '.8rem', color: 'var(--muted)', fontWeight: 500 }}>{source}</span><span style={{ fontSize: '.78rem', color: 'var(--muted2)' }}>{count} ({pct}%)</span></div><div style={{ background: 'var(--bg)', borderRadius: 999, height: 6, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 999 }} /></div></div>)
                  })}
                </div>
              </div>
            </>
          )}
          {!analytics && !analyticsLoading && <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12 }}>No analytics data yet. Triage some alerts first.</div>}
        </>
      )}
    </div>
  )
}
