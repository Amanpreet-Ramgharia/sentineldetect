import { createServiceClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function SharePage({ params }: { params: Promise<{ ruleId: string }> }) {
  const { ruleId } = await params
  const sb = createServiceClient()
  const { data: rule } = await sb.from('rules').select('*').eq('id', ruleId).eq('is_public', true).single()
  if (!rule) notFound()

  const SEV: Record<string,string> = { Critical:'#dc2626', High:'#ef4444', Medium:'#f97316', Low:'#3b82f6' }

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <nav style={{ borderBottom:'1px solid rgba(99,102,241,.15)', padding:'1rem 2rem', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(15,23,42,.9)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50 }}>
        <Link href="/" style={{ display:'flex', alignItems:'center', gap:'.5rem', textDecoration:'none' }}>
          <div style={{ width:28, height:28, background:'#f97316', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.6rem' }}>SD</div>
          <span style={{ fontSize:'.9rem', fontWeight:700, color:'#e2e8f0' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></span>
        </Link>
        <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontSize:'.8rem', fontWeight:600, padding:'.4rem .9rem', borderRadius:7 }}>
          Generate your own rules free
        </Link>
      </nav>

      <div style={{ maxWidth:860, margin:'0 auto', padding:'2.5rem 1.5rem' }}>
        {/* Rule header */}
        <div style={{ marginBottom:'1.5rem' }}>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'.5rem', marginBottom:'.75rem', alignItems:'center' }}>
            <span style={{ fontSize:'.65rem', padding:'.15rem .55rem', borderRadius:4, background: `${SEV[rule.severity]}20`, color: SEV[rule.severity]||'#6b7280', border:`1px solid ${SEV[rule.severity]||'#e5e7eb'}`, fontWeight:600 }}>{rule.severity}</span>
            <span style={{ fontSize:'.65rem', padding:'.15rem .55rem', borderRadius:4, background:'rgba(99,102,241,.1)', color:'#818cf8', border:'1px solid rgba(99,102,241,.25)', fontFamily:'monospace' }}>{rule.mitre_id}</span>
            <span style={{ fontSize:'.65rem', padding:'.15rem .55rem', borderRadius:4, background:'rgba(99,102,241,.1)', color:'#94a3b8', border:'1px solid rgba(99,102,241,.15)' }}>{rule.platform}</span>
            {rule.confidence && <span style={{ fontSize:'.65rem', padding:'.15rem .55rem', borderRadius:4, background:'rgba(52,211,153,.1)', color:'#34d399', border:'1px solid rgba(52,211,153,.25)' }}>{rule.confidence}% confidence</span>}
          </div>
          <h1 style={{ fontSize:'1.6rem', fontWeight:800, color:'#e2e8f0', margin:'0 0 .4rem', letterSpacing:'-.02em' }}>{rule.title}</h1>
          <div style={{ fontSize:'.82rem', color:'#94a3b8' }}>
            {rule.tactic} · {rule.data_source} · Shared from SentinelDetect
          </div>
        </div>

        {/* Rule code */}
        <div style={{ background:'#0b1120', border:'1px solid rgba(99,102,241,.2)', borderRadius:12, overflow:'hidden', marginBottom:'1.25rem' }}>
          <div style={{ padding:'.55rem 1rem', borderBottom:'1px solid rgba(99,102,241,.15)', display:'flex', alignItems:'center', justifyContent:'space-between', background:'rgba(99,102,241,.05)' }}>
            <span style={{ fontSize:'.7rem', fontFamily:'monospace', color:'#64748b', textTransform:'uppercase', letterSpacing:'.07em' }}>{rule.platform}</span>
            <button onClick={() => navigator.clipboard.writeText(rule.rule)}
              style={{ fontSize:'.68rem', padding:'.18rem .55rem', borderRadius:5, border:'1px solid rgba(99,102,241,.2)', background:'transparent', color:'#64748b', cursor:'pointer' }}
              suppressHydrationWarning>
              Copy
            </button>
          </div>
          <pre style={{ padding:'1.1rem', margin:0, fontFamily:'monospace', fontSize:'.8rem', color:'#a5b4fc', overflowX:'auto', lineHeight:1.65, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{rule.rule}</pre>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.25rem' }}>
          {/* Description */}
          <div style={{ background:'rgba(30,41,59,.6)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, padding:'1rem' }}>
            <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'#64748b', marginBottom:'.4rem' }}>Description</div>
            <p style={{ fontSize:'.82rem', color:'#94a3b8', lineHeight:1.65, margin:0 }}>{rule.description}</p>
          </div>

          {/* MITRE */}
          <div style={{ background:'rgba(30,41,59,.6)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, padding:'1rem' }}>
            <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'#64748b', marginBottom:'.4rem' }}>MITRE ATT&CK</div>
            <div style={{ fontSize:'.88rem', fontWeight:600, color:'#818cf8', marginBottom:'.2rem' }}>{rule.mitre_id} — {rule.mitre_name}</div>
            <div style={{ fontSize:'.78rem', color:'#94a3b8' }}>{rule.tactic}</div>
          </div>
        </div>

        {rule.false_positives?.length > 0 && (
          <div style={{ background:'rgba(30,41,59,.6)', border:'1px solid rgba(99,102,241,.15)', borderRadius:10, padding:'1rem', marginBottom:'1rem' }}>
            <div style={{ fontSize:'.65rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'#64748b', marginBottom:'.5rem' }}>False positives</div>
            {rule.false_positives.map((fp: string, i: number) => <div key={i} style={{ fontSize:'.8rem', color:'#94a3b8', marginBottom:'.25rem' }}>· {fp}</div>)}
          </div>
        )}

        {/* CTA */}
        <div style={{ background:'rgba(249,115,22,.06)', border:'1px solid rgba(249,115,22,.2)', borderRadius:12, padding:'1.5rem', textAlign:'center', marginTop:'2rem' }}>
          <div style={{ fontSize:'1rem', fontWeight:700, color:'#e2e8f0', marginBottom:'.4rem' }}>Generate your own detection rules</div>
          <div style={{ fontSize:'.82rem', color:'#94a3b8', marginBottom:'1.25rem' }}>Free AI-powered SIEM rule generator. Supports 10 platforms including Sentinel, Splunk, Wazuh, CrowdStrike, and more.</div>
          <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontWeight:700, padding:'.75rem 1.75rem', borderRadius:9, fontSize:'.9rem', display:'inline-block' }}>
            Create free account
          </Link>
        </div>
      </div>
    </div>
  )
}
