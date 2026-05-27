'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SocAlert {
  id: string
  title: string
  severity: string
  severity_score: number
  summary: string
  status: string
  source: string
  source_system: string | null
  mitre_technique: string
  mitre_tactic: string
  iocs: string[]
  investigation_steps: string[]
  response_actions: string[]
  is_false_positive: boolean
  escalate: boolean
  escalation_reason: string
  false_positive_reason: string
  notes: string
  alert_time: string
  updated_at: string
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  Critical: 'var(--red)',   High: '#f97316',
  Medium:   '#eab308',      Low:  'var(--blue)',
}
const SEV_BG: Record<string, string> = {
  Critical: 'var(--red-bg)', High: 'rgba(249,115,22,.12)',
  Medium:   'rgba(234,179,8,.12)', Low: 'rgba(59,130,246,.12)',
}
const STATUS_COLOR: Record<string, string> = {
  new: '#f97316', investigating: 'var(--blue)',
  resolved: 'var(--green)', false_positive: 'var(--muted)',
}
const STATUS_BG: Record<string, string> = {
  new: 'rgba(249,115,22,.12)', investigating: 'rgba(59,130,246,.12)',
  resolved: 'rgba(34,197,94,.12)', false_positive: 'rgba(148,163,184,.1)',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SocPage() {
  const [alerts, setAlerts]       = useState<SocAlert[]>([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [filter, setFilter]       = useState('all')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [alertText, setAlertText] = useState('')
  const [showSubmit, setShowSubmit] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // Get user for webhook URL
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email || '')
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const params = filter !== 'all' ? `?status=${filter}` : ''
    const res = await fetch(`/api/soc/alerts${params}`)
    if (res.ok) {
      const d = await res.json()
      setAlerts(d.alerts || [])
      setTotal(d.total || 0)
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/soc/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, status } : a))
    }
  }

  async function saveNotes(id: string, notes: string) {
    await fetch(`/api/soc/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    })
  }

  async function submitAlert() {
    if (!alertText.trim()) return
    setSubmitting(true); setSubmitErr('')
    const res = await fetch('/api/soc/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_text: alertText }),
    })
    const data = await res.json()
    if (!res.ok) { setSubmitErr(data.error || 'Failed'); setSubmitting(false); return }
    setAlertText(''); setShowSubmit(false)
    setAlerts(prev => [data.alert, ...prev])
    setExpanded(data.alert.id)
    setSubmitting(false)
  }

  const counts = {
    all: total,
    new: alerts.filter(a => a.status === 'new').length,
    investigating: alerts.filter(a => a.status === 'investigating').length,
    resolved: alerts.filter(a => a.status === 'resolved').length,
  }

  const criticalCount = alerts.filter(a => a.severity === 'Critical' || a.escalate).length
  const resolvedToday = alerts.filter(a => {
    return a.status === 'resolved' &&
      new Date(a.updated_at || a.created_at).toDateString() === new Date().toDateString()
  }).length

  const s: Record<string, React.CSSProperties> = {
    page:     { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', padding: '1.5rem 2rem' },
    header:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' },
    title:    { fontSize: '1.35rem', fontWeight: 700 },
    statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: '.75rem', marginBottom: '1.5rem' },
    stat:     { background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1rem 1.2rem' },
    statVal:  { fontSize: '1.75rem', fontWeight: 700, color: '#f97316' },
    statLbl:  { fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem' },
    filters:  { display: 'flex', gap: '.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' },
    fBtn:     { padding: '.4rem .9rem', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '.8rem', cursor: 'pointer', fontFamily: 'inherit' },
    card:     { background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: '.6rem', overflow: 'hidden' },
    cardHead: { display: 'flex', alignItems: 'center', gap: '.75rem', padding: '1rem 1.2rem', cursor: 'pointer' },
    badge:    { display: 'inline-flex', alignItems: 'center', padding: '.2rem .65rem', borderRadius: 999, fontSize: '.7rem', fontWeight: 600, whiteSpace: 'nowrap' as const },
    detail:   { borderTop: '1px solid var(--border)', padding: '1.2rem' },
    section:  { marginBottom: '1rem' },
    secTitle: { fontSize: '.72rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase' as const, letterSpacing: '.08em', marginBottom: '.5rem' },
    step:     { display: 'flex', gap: '.65rem', padding: '.5rem .65rem', borderRadius: 7, background: 'var(--bg)', marginBottom: '.35rem', fontSize: '.82rem', color: 'var(--muted)', lineHeight: 1.5, alignItems: 'flex-start' },
    actions:  { display: 'flex', gap: '.5rem', flexWrap: 'wrap' as const, marginTop: '.75rem' },
    actBtn:   { padding: '.35rem .85rem', borderRadius: 7, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: '.78rem', cursor: 'pointer', fontFamily: 'inherit' },
    textarea: { width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 8, padding: '.7rem .9rem', color: 'var(--text)', fontSize: '.82rem', fontFamily: 'inherit', resize: 'vertical' as const, outline: 'none', minHeight: 80 },
  }

  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div>
          <div style={s.title}>SOC — Alert Queue</div>
          <div style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.2rem' }}>
            AI-powered triage · {total} alerts total
          </div>
        </div>
        <div style={{ display: 'flex', gap: '.65rem' }}>
          <button
            onClick={() => setShowSubmit(v => !v)}
            style={{ padding: '.55rem 1.1rem', borderRadius: 8, background: 'var(--bg4)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: '.85rem', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}
          >
            + Paste alert
          </button>
          <a
            href="/settings"
            style={{ padding: '.55rem 1.1rem', borderRadius: 8, background: '#f97316', color: '#fff', textDecoration: 'none', fontSize: '.85rem', fontWeight: 600 }}
          >
            Get webhook URL
          </a>
        </div>
      </div>

      {/* Manual submit box */}
      {showSubmit && (
        <div style={{ background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ fontSize: '.85rem', fontWeight: 600, marginBottom: '.65rem' }}>Paste any alert</div>
          <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginBottom: '.75rem' }}>
            Raw JSON, Splunk alert, Sentinel incident, plain text — any format works.
          </div>
          <textarea
            style={s.textarea}
            value={alertText}
            onChange={e => setAlertText(e.target.value)}
            placeholder={'{\n  "EventID": 4625,\n  "Message": "An account failed to log on",\n  "TargetUserName": "administrator",\n  "IpAddress": "185.220.101.45"\n}'}
            rows={6}
          />
          {submitErr && (
            <div style={{ color: 'var(--red)', fontSize: '.78rem', marginTop: '.5rem' }}>{submitErr}</div>
          )}
          <div style={{ display: 'flex', gap: '.65rem', marginTop: '.75rem' }}>
            <button
              onClick={submitAlert}
              disabled={submitting || !alertText.trim()}
              style={{ padding: '.55rem 1.25rem', borderRadius: 8, background: submitting ? 'var(--muted2)' : '#f97316', border: 'none', color: '#fff', fontWeight: 700, fontSize: '.85rem', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
            >
              {submitting ? 'Triaging…' : 'Triage with AI'}
            </button>
            <button
              onClick={() => { setShowSubmit(false); setAlertText('') }}
              style={{ ...s.actBtn }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={s.statsRow}>
        {[
          { val: total,           lbl: 'Total alerts' },
          { val: criticalCount,   lbl: 'Critical / escalated' },
          { val: counts.new,      lbl: 'New (unreviewed)' },
          { val: counts.investigating, lbl: 'Investigating' },
          { val: resolvedToday,   lbl: 'Resolved today' },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={s.stat}>
            <div style={s.statVal}>{val}</div>
            <div style={s.statLbl}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={s.filters}>
        {(['all','new','investigating','resolved','false_positive'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...s.fBtn,
              background: filter === f ? 'rgba(249,115,22,.15)' : 'transparent',
              borderColor: filter === f ? 'rgba(249,115,22,.4)' : 'var(--border)',
              color:       filter === f ? '#f97316' : 'var(--muted)',
            }}
          >
            {f === 'all' ? `All (${total})` : f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Alert list */}
      {loading && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem' }}>
          Loading alerts…
        </div>
      )}

      {!loading && alerts.length === 0 && (
        <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '3rem', fontSize: '.85rem', background: 'var(--bg4)', border: '1px solid var(--border)', borderRadius: 12 }}>
          No alerts yet. Paste an alert above or configure a webhook from Settings → API Keys.
        </div>
      )}

      {alerts.map(alert => (
        <div key={alert.id} style={{ ...s.card, borderColor: alert.escalate ? 'rgba(239,68,68,.4)' : 'var(--border)' }}>

          {/* Card header */}
          <div style={s.cardHead} onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
            {/* Severity */}
            <span style={{ ...s.badge, background: SEV_BG[alert.severity] || 'var(--bg)', color: SEV_COLOR[alert.severity] || 'var(--muted)', minWidth: 64, justifyContent: 'center' }}>
              {alert.severity}
            </span>

            {/* Title + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.88rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {alert.escalate && <span style={{ color: 'var(--red)', marginRight: '.35rem' }}>⚑</span>}
                {alert.title}
              </div>
              <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.2rem', display: 'flex', gap: '.75rem', flexWrap: 'wrap' }}>
                {alert.mitre_technique && <span style={{ color: '#f97316' }}>{alert.mitre_technique}</span>}
                {alert.source_system   && <span>{alert.source_system}</span>}
                <span>{timeAgo(alert.created_at)}</span>
              </div>
            </div>

            {/* Status badge */}
            <span style={{ ...s.badge, background: STATUS_BG[alert.status] || 'transparent', color: STATUS_COLOR[alert.status] || 'var(--muted)' }}>
              {alert.status.replace('_', ' ')}
            </span>

            {/* Expand chevron */}
            <span style={{ color: 'var(--muted2)', fontSize: '.85rem', transform: expanded === alert.id ? 'rotate(90deg)' : 'none', transition: 'transform .2s' }}>›</span>
          </div>

          {/* Expanded detail */}
          {expanded === alert.id && (
            <div style={s.detail}>

              {/* Summary */}
              <div style={s.section}>
                <div style={s.secTitle}>Summary</div>
                <div style={{ fontSize: '.85rem', color: 'var(--muted)', lineHeight: 1.65 }}>{alert.summary}</div>
              </div>

              {/* MITRE + IOCs row */}
              {(alert.mitre_technique || alert.iocs?.length > 0) && (
                <div style={{ display: 'grid', gridTemplateColumns: alert.mitre_technique && alert.iocs?.length > 0 ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1rem' }}>
                  {alert.mitre_technique && (
                    <div style={s.section}>
                      <div style={s.secTitle}>MITRE ATT&amp;CK</div>
                      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                        <span style={{ ...s.badge, background: 'rgba(249,115,22,.12)', color: '#f97316' }}>{alert.mitre_technique}</span>
                        {alert.mitre_tactic && <span style={{ ...s.badge, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)' }}>{alert.mitre_tactic}</span>}
                      </div>
                    </div>
                  )}
                  {alert.iocs?.length > 0 && (
                    <div style={s.section}>
                      <div style={s.secTitle}>IOCs ({alert.iocs.length})</div>
                      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
                        {alert.iocs.slice(0, 8).map((ioc, i) => (
                          <span key={i} style={{ ...s.badge, background: 'var(--bg)', color: 'var(--muted)', border: '1px solid var(--border)', fontFamily: 'monospace', fontSize: '.68rem' }}>{ioc}</span>
                        ))}
                        {alert.iocs.length > 8 && <span style={{ fontSize: '.72rem', color: 'var(--muted2)' }}>+{alert.iocs.length - 8} more</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Investigation steps */}
              {alert.investigation_steps?.length > 0 && (
                <div style={s.section}>
                  <div style={s.secTitle}>Investigation steps</div>
                  {alert.investigation_steps.map((step, i) => (
                    <div key={i} style={s.step}>
                      <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, minWidth: 18, fontSize: '.75rem' }}>{i + 1}</span>
                      {step}
                    </div>
                  ))}
                </div>
              )}

              {/* Response actions */}
              {alert.response_actions?.length > 0 && (
                <div style={s.section}>
                  <div style={s.secTitle}>Response actions</div>
                  {alert.response_actions.map((action, i) => (
                    <div key={i} style={{ ...s.step, background: 'rgba(249,115,22,.05)', borderLeft: '2px solid rgba(249,115,22,.3)' }}>
                      <span style={{ color: '#f97316', fontWeight: 700, flexShrink: 0, fontSize: '.75rem' }}>→</span>
                      {action}
                    </div>
                  ))}
                </div>
              )}

              {/* False positive / escalation notes */}
              {alert.false_positive_reason && (
                <div style={{ ...s.step, background: 'rgba(148,163,184,.08)', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--muted2)', fontWeight: 700, fontSize: '.75rem', flexShrink: 0 }}>FP</span>
                  {alert.false_positive_reason}
                </div>
              )}
              {alert.escalation_reason && (
                <div style={{ ...s.step, background: 'var(--red-bg)', borderLeft: '2px solid var(--red)', marginBottom: '1rem' }}>
                  <span style={{ color: 'var(--red)', fontWeight: 700, fontSize: '.75rem', flexShrink: 0 }}>⚑</span>
                  {alert.escalation_reason}
                </div>
              )}

              {/* Notes */}
              <div style={s.section}>
                <div style={s.secTitle}>Analyst notes</div>
                <textarea
                  defaultValue={alert.notes}
                  onBlur={e => saveNotes(alert.id, e.target.value)}
                  placeholder="Add your notes here…"
                  rows={2}
                  style={s.textarea}
                />
              </div>

              {/* Actions */}
              <div style={s.actions}>
                {alert.status !== 'investigating' && (
                  <button style={{ ...s.actBtn, borderColor: 'rgba(59,130,246,.4)', color: 'var(--blue)' }}
                    onClick={() => updateStatus(alert.id, 'investigating')}>
                    Start investigating
                  </button>
                )}
                {alert.status !== 'resolved' && (
                  <button style={{ ...s.actBtn, borderColor: 'rgba(34,197,94,.4)', color: 'var(--green)' }}
                    onClick={() => updateStatus(alert.id, 'resolved')}>
                    Mark resolved
                  </button>
                )}
                {alert.status !== 'false_positive' && (
                  <button style={s.actBtn}
                    onClick={() => updateStatus(alert.id, 'false_positive')}>
                    False positive
                  </button>
                )}
                <a
                  href={`/generate?scenario=${encodeURIComponent(alert.summary || alert.title)}`}
                  style={{ ...s.actBtn, borderColor: 'rgba(249,115,22,.4)', color: '#f97316', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                >
                  Generate detection rule →
                </a>
              </div>

            </div>
          )}
        </div>
      ))}

    </div>
  )
}
