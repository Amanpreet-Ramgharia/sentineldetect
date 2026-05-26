import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  // Authenticated users go straight to the app
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', color:'var(--text)', fontFamily:'var(--font-outfit)' }}>

      {/* Nav */}
      <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2rem', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--bg)', zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.65rem' }}>
          <div style={{ width:34, height:34, background:'#f97316', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'.8rem', boxShadow:'0 2px 10px rgba(249,115,22,.4)' }}>SD</div>
          <span style={{ fontWeight:700, fontSize:'1rem' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></span>
        </div>
        <div style={{ display:'flex', gap:'.75rem' }}>
          <Link href="/login" style={{ padding:'.45rem 1rem', borderRadius:7, border:'1px solid var(--border)', color:'var(--muted)', fontSize:'.82rem', textDecoration:'none', fontWeight:500 }}>Sign in</Link>
          <Link href="/signup" style={{ padding:'.45rem 1rem', borderRadius:7, background:'#f97316', color:'#fff', fontSize:'.82rem', textDecoration:'none', fontWeight:700 }}>Get started free</Link>
        </div>
      </nav>

      {/* Hero */}
      <section style={{ textAlign:'center', padding:'5rem 1.5rem 4rem', maxWidth:760, margin:'0 auto' }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'.5rem', background:'rgba(249,115,22,.1)', border:'1px solid rgba(249,115,22,.3)', borderRadius:20, padding:'.3rem .85rem', fontSize:'.75rem', color:'#f97316', fontWeight:600, marginBottom:'1.5rem', letterSpacing:'.04em' }}>
          AI-POWERED DETECTION ENGINEERING
        </div>
        <h1 style={{ fontSize:'clamp(2rem,5vw,3.2rem)', fontWeight:800, lineHeight:1.15, margin:'0 0 1.25rem', color:'var(--text)' }}>
          Generate production-ready<br/><span style={{ color:'#f97316' }}>SIEM detection rules</span><br/>in seconds
        </h1>
        <p style={{ fontSize:'1.05rem', color:'var(--muted)', lineHeight:1.7, maxWidth:560, margin:'0 auto 2.5rem' }}>
          SentinelDetect uses AI to write KQL, SPL, EQL, Sigma, and 6 other SIEM formats — with automatic MITRE ATT&CK mapping, quality scoring, and one-click export.
        </p>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap' }}>
          <Link href="/signup" style={{ padding:'.85rem 2rem', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:'1rem', textDecoration:'none', boxShadow:'0 4px 20px rgba(249,115,22,.4)' }}>
            Start for free →
          </Link>
          <Link href="/community" style={{ padding:'.85rem 2rem', borderRadius:10, border:'1px solid var(--border)', color:'var(--muted)', fontWeight:600, fontSize:'1rem', textDecoration:'none' }}>
            Browse rules
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <section style={{ maxWidth:900, margin:'0 auto', padding:'2rem 1.5rem 5rem', display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))', gap:'1rem' }}>
        {[
          ['🎯', '10 SIEM Platforms', 'KQL, SPL, EQL, Sigma, YARA-L, QRadar, Chronicle, Elastic, Suricata, OpenSearch'],
          ['🧠', 'MITRE ATT&CK', 'Automatic tactic and technique mapping for every rule you generate'],
          ['✅', 'Quality Scoring', 'AI grades each rule for accuracy, coverage, and false-positive risk'],
          ['🔍', 'Log Analyser', 'Paste raw logs and get detection rules written from the evidence'],
          ['🔐', 'Team Workspaces', 'Collaborate, version rules, and manage access across your team'],
          ['📡', 'REST API', 'Integrate rule generation into your own pipelines and tooling'],
        ].map(([icon, title, desc]) => (
          <div key={String(title)} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.35rem' }}>
            <div style={{ fontSize:'1.5rem', marginBottom:'.6rem' }}>{icon}</div>
            <div style={{ fontWeight:700, fontSize:'.9rem', marginBottom:'.4rem', color:'var(--text)' }}>{title}</div>
            <div style={{ fontSize:'.78rem', color:'var(--muted)', lineHeight:1.6 }}>{desc}</div>
          </div>
        ))}
      </section>

      {/* CTA footer */}
      <section style={{ borderTop:'1px solid var(--border)', padding:'3rem 1.5rem', textAlign:'center' }}>
        <h2 style={{ fontSize:'1.5rem', fontWeight:700, margin:'0 0 .75rem' }}>Ready to write better detection rules?</h2>
        <p style={{ color:'var(--muted)', fontSize:'.9rem', marginBottom:'1.5rem' }}>Free to start. No credit card required.</p>
        <Link href="/signup" style={{ padding:'.85rem 2.5rem', borderRadius:10, background:'#f97316', color:'#fff', fontWeight:700, fontSize:'1rem', textDecoration:'none' }}>
          Create free account
        </Link>
      </section>

    </div>
  )
}
