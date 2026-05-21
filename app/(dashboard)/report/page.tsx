'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ReportPage() {
  const [rules,   setRules]   = useState<any[]>([])
  const [user,    setUser]    = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      setUser(user)
      const { data } = await sb.from('rules').select('*').order('created_at', { ascending: false })
      setRules(data || [])
      setLoading(false)
      // Auto-print after render
      setTimeout(() => window.print(), 800)
    }
    load()
  }, [])

  const tactics: Record<string,number> = {}
  rules.forEach(r => { if (r.tactic) tactics[r.tactic] = (tactics[r.tactic]||0)+1 })
  const covered = new Set(rules.filter(r => r.mitre_id).map(r => r.mitre_id)).size
  const bySev: Record<string,number> = {}
  rules.forEach(r => { bySev[r.severity] = (bySev[r.severity]||0)+1 })
  const byPlat: Record<string,number> = {}
  rules.forEach(r => { const p = r.platform?.split(' ')[0]; if(p) byPlat[p] = (byPlat[p]||0)+1 })

  const SEV_COLOR: Record<string,string> = { Critical:'#dc2626', High:'#ef4444', Medium:'#f97316', Low:'#3b82f6' }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#6b7280', fontFamily:'system-ui' }}>
      Preparing report...
    </div>
  )

  return (
    <>
      <style>{`
        @media print {
          body { margin: 0; background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .page-break { page-break-before: always; }
        }
        body { font-family: 'Georgia', serif; background: white; color: #111; margin: 0; }
        @page { margin: 1.5cm; size: A4; }
      `}</style>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem', background: 'white', color: '#111', fontFamily: 'system-ui, sans-serif' }}>

        {/* Print button */}
        <div className="no-print" style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
          <button onClick={() => window.print()}
            style={{ padding: '.65rem 1.5rem', background: '#f97316', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 700, fontSize: '.9rem', cursor: 'pointer' }}>
            Download PDF
          </button>
          <button onClick={() => window.close()}
            style={{ padding: '.65rem 1rem', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 8, color: '#6b7280', fontSize: '.9rem', cursor: 'pointer' }}>
            Close
          </button>
        </div>

        {/* Header */}
        <div style={{ borderBottom: '3px solid #f97316', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ width: 48, height: 48, background: '#f97316', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#fff', fontSize: '1rem', flexShrink: 0 }}>SD</div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111' }}>SentinelDetect</div>
              <div style={{ fontSize: '.85rem', color: '#6b7280' }}>Detection Engineering Report</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '2rem', fontSize: '.82rem', color: '#6b7280' }}>
            <span>Generated: {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' })}</span>
            <span>Account: {user?.email}</span>
            <span>Total rules: {rules.length}</span>
          </div>
        </div>

        {/* Executive summary */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', borderBottom: '1px solid #e5e7eb', paddingBottom: '.5rem', marginBottom: '1rem' }}>Executive Summary</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { n: rules.length,            l: 'Total rules'       },
              { n: covered,                 l: 'MITRE techniques'  },
              { n: Object.keys(tactics).length, l: 'Tactics covered' },
              { n: `${Math.round(covered/60*100)}%`, l: 'Coverage %' },
            ].map((s, i) => (
              <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '.75rem', textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f97316' }}>{s.n}</div>
                <div style={{ fontSize: '.72rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: '.1rem' }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Severity breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '.85rem' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>By severity</div>
              {Object.entries(bySev).sort((a,b)=>b[1]-a[1]).map(([sev, n]) => (
                <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEV_COLOR[sev]||'#6b7280', flexShrink: 0 }}/>
                  <span style={{ fontSize: '.78rem', color: '#374151', flex: 1 }}>{sev}</span>
                  <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#111' }}>{n}</span>
                </div>
              ))}
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '.85rem' }}>
              <div style={{ fontSize: '.75rem', fontWeight: 600, color: '#374151', marginBottom: '.5rem', textTransform: 'uppercase', letterSpacing: '.06em' }}>By platform</div>
              {Object.entries(byPlat).sort((a,b)=>b[1]-a[1]).map(([plat, n]) => (
                <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.3rem' }}>
                  <span style={{ fontSize: '.78rem', color: '#374151', flex: 1 }}>{plat}</span>
                  <span style={{ fontSize: '.78rem', fontWeight: 600, color: '#111' }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ATT&CK coverage */}
        {Object.keys(tactics).length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', borderBottom: '1px solid #e5e7eb', paddingBottom: '.5rem', marginBottom: '1rem' }}>MITRE ATT&CK Coverage</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
              {Object.entries(tactics).sort((a,b)=>b[1]-a[1]).map(([tactic, count]) => (
                <div key={tactic} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '.4rem .75rem', fontSize: '.78rem' }}>
                  <span style={{ color: '#374151' }}>{tactic}</span>
                  <span style={{ marginLeft: '.5rem', fontWeight: 700, color: '#f97316' }}>{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rule list */}
        <div className="page-break">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111', borderBottom: '1px solid #e5e7eb', paddingBottom: '.5rem', marginBottom: '1rem' }}>Detection Rules ({rules.length})</h2>
          {rules.map((r, i) => (
            <div key={r.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '.85rem 1rem', marginBottom: '.75rem', breakInside: 'avoid' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '.4rem' }}>
                <div style={{ fontSize: '.88rem', fontWeight: 600, color: '#111' }}>{i+1}. {r.title}</div>
                <div style={{ display: 'flex', gap: '.35rem', flexShrink: 0 }}>
                  <span style={{ fontSize: '.65rem', padding: '.12rem .45rem', borderRadius: 4, background: SEV_COLOR[r.severity]+'20', color: SEV_COLOR[r.severity]||'#6b7280', border: `1px solid ${SEV_COLOR[r.severity]||'#e5e7eb'}`, fontWeight: 600 }}>{r.severity}</span>
                  {r.mitre_id && <span style={{ fontSize: '.65rem', padding: '.12rem .45rem', borderRadius: 4, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', fontFamily: 'monospace', fontWeight: 600 }}>{r.mitre_id}</span>}
                </div>
              </div>
              <div style={{ fontSize: '.75rem', color: '#6b7280', marginBottom: '.35rem' }}>
                {[r.tactic, r.platform?.split(' ')[0], r.data_source, r.confidence ? `${r.confidence}% confidence` : ''].filter(Boolean).join(' · ')}
              </div>
              {r.description && <div style={{ fontSize: '.78rem', color: '#374151', lineHeight: 1.55 }}>{r.description}</div>}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '2rem', fontSize: '.72rem', color: '#9ca3af', display: 'flex', justifyContent: 'space-between' }}>
          <span>SentinelDetect — Built by Amanpreet Singh Matharu</span>
          <span>smartswingalerts.com</span>
        </div>
      </div>
    </>
  )
}
