'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function CommunityPage() {
  const [allRules, setAllRules] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const sb = createClient()
    sb.from('rules')
      .select('id,title,platform,severity,tactic,mitre_id,mitre_name,description,confidence,created_at')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => { setAllRules(data || []); setLoading(false) })
  }, [])
  const platforms = [...new Set(allRules.map((r:any) => r.platform?.split(' ')[0]).filter(Boolean))]
  const tactics   = [...new Set(allRules.map((r:any) => r.tactic).filter(Boolean))].sort()
  const SEV: Record<string,string> = { Critical:'#dc2626', High:'#ef4444', Medium:'#f97316', Low:'#3b82f6' }

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <nav style={{ borderBottom:'1px solid rgba(99,102,241,.15)', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(15,23,42,.9)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'.5rem', textDecoration:'none' }}>
          <div style={{ width:28, height:28, background:'#f97316', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.6rem' }}>SD</div>
          <span style={{ fontSize:'.9rem', fontWeight:700, color:'#e2e8f0' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></span>
        </Link>
        <div style={{ display:'flex', gap:'.65rem' }}>
          <Link href="/login"  style={{ color:'#94a3b8', textDecoration:'none', fontSize:'.82rem', padding:'.4rem .85rem', borderRadius:7, border:'1px solid rgba(99,102,241,.2)' }}>Sign in</Link>
          <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontSize:'.82rem', fontWeight:600, padding:'.4rem .9rem', borderRadius:7 }}>Get started free</Link>
        </div>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'2.5rem 1.5rem' }}>
        <div style={{ marginBottom:'2rem', textAlign:'center' }}>
          <h1 style={{ fontSize:'2rem', fontWeight:800, margin:'0 0 .5rem', letterSpacing:'-.02em' }}>Community Rule Library</h1>
          <p style={{ color:'#94a3b8', fontSize:'.9rem', margin:0 }}>
            {allRules.length} detection rules shared by the SentinelDetect community. Click any rule to view the full query.
          </p>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:'.75rem', flexWrap:'wrap', marginBottom:'1.5rem', justifyContent:'center' }}>
          {[
            { n:allRules.length, l:'Rules shared' },
            { n:platforms.length, l:'Platforms covered' },
            { n:new Set(allRules.map(r=>r.mitre_id).filter(Boolean)).size, l:'MITRE techniques' },
            { n:tactics.length,   l:'Tactics' },
          ].map((s,i) => (
            <div key={i} style={{ background:'rgba(30,41,59,.6)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, padding:'.65rem 1.25rem', textAlign:'center', minWidth:100 }}>
              <div style={{ fontSize:'1.4rem', fontWeight:800, color:'#f97316' }}>{s.n}</div>
              <div style={{ fontSize:'.65rem', color:'#64748b', textTransform:'uppercase', letterSpacing:'.06em' }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Rule grid */}
        {allRules.length === 0 ? (
          <div style={{ textAlign:'center', padding:'4rem', color:'#475569' }}>
            <div style={{ fontSize:'1rem', marginBottom:'.5rem' }}>No shared rules yet</div>
            <div style={{ fontSize:'.85rem' }}>Be the first — generate a rule and share it from My Rules.</div>
            <Link href="/signup" style={{ display:'inline-block', marginTop:'1rem', background:'#f97316', color:'#fff', textDecoration:'none', padding:'.65rem 1.4rem', borderRadius:8, fontWeight:600, fontSize:'.85rem' }}>Get started free</Link>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'1rem' }}>
            {allRules.map(rule => (
              <Link key={rule.id} href={`/share/${rule.id}`} style={{ textDecoration:'none' }}>
                <div style={{ background:'rgba(30,41,59,.6)', border:'1px solid rgba(99,102,241,.15)', borderRadius:12, padding:'1.1rem', cursor:'pointer', transition:'border-color .2s', height:'100%' }}
                  onMouseEnter={(e: any) => e.currentTarget.style.borderColor='rgba(249,115,22,.4)'}
                  onMouseLeave={(e: any) => e.currentTarget.style.borderColor='rgba(99,102,241,.15)'}>
                  <div style={{ display:'flex', gap:'.35rem', flexWrap:'wrap', marginBottom:'.5rem' }}>
                    <span style={{ fontSize:'.6rem', padding:'.12rem .45rem', borderRadius:4, background:`${SEV[rule.severity]||'#6b7280'}20`, color:SEV[rule.severity]||'#6b7280', border:`1px solid ${SEV[rule.severity]||'#6b7280'}`, fontWeight:600 }}>{rule.severity}</span>
                    <span style={{ fontSize:'.6rem', padding:'.12rem .45rem', borderRadius:4, background:'rgba(99,102,241,.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,.25)', fontFamily:'monospace' }}>{rule.mitre_id}</span>
                    <span style={{ fontSize:'.6rem', padding:'.12rem .45rem', borderRadius:4, background:'rgba(99,102,241,.08)', color:'#64748b', border:'1px solid rgba(99,102,241,.15)' }}>{rule.platform?.split(' ')[0]}</span>
                  </div>
                  <div style={{ fontSize:'.88rem', fontWeight:600, color:'#e2e8f0', marginBottom:'.3rem', lineHeight:1.3 }}>{rule.title}</div>
                  <div style={{ fontSize:'.72rem', color:'#64748b', marginBottom:'.5rem' }}>{rule.tactic} · {rule.mitre_name}</div>
                  {rule.description && <div style={{ fontSize:'.75rem', color:'#94a3b8', lineHeight:1.55, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>{rule.description}</div>}
                  <div style={{ marginTop:'.65rem', fontSize:'.65rem', color:'#475569' }}>View rule →</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div style={{ textAlign:'center', marginTop:'3rem', paddingTop:'2rem', borderTop:'1px solid rgba(99,102,241,.1)' }}>
          <p style={{ color:'#475569', fontSize:'.85rem', marginBottom:'1rem' }}>Want to share your own rules?</p>
          <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontWeight:700, padding:'.75rem 1.75rem', borderRadius:9, fontSize:'.9rem' }}>Create free account</Link>
        </div>
      </div>
    </div>
  )
}
