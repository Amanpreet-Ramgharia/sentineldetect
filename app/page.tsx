import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

const FEATURES = [
  { title: 'Instant rule generation',  desc: 'Plain English to production KQL, SPL, or EQL with full MITRE ATT&CK mapping, severity scoring, and data source in under 10 seconds.' },
  { title: 'ATT&CK coverage matrix',   desc: 'Visual matrix showing which MITRE techniques you have covered vs gaps. Click any uncovered technique to auto-generate a rule.' },
  { title: 'Log analyser',             desc: 'Paste any Sysmon, Windows Event, or Azure AD log. AI explains what happened, identifies threats, and suggests a detection rule.' },
  { title: 'Improve and explain',      desc: 'Eight improvement options including false positive reduction, threshold tuning, and performance optimisation. Explains any rule in plain English.' },
  { title: 'Platform conversion',      desc: 'Convert any rule between Microsoft Sentinel KQL, Splunk SPL, and Elastic EQL with one click using the same AI engine.' },
  { title: 'Export everywhere',        desc: 'Download as .kql, Sentinel ARM template, Sigma YAML, or MITRE Navigator JSON. All rules saved per account in Supabase.' },
  { title: 'CISA KEV threat feed',     desc: 'Live feed of CISA known-exploited vulnerabilities. Click any CVE to generate a detection rule for it automatically.' },
  { title: 'Team workspaces',          desc: 'Invite colleagues, share your rule library, and see combined ATT&CK coverage across your entire security team.' },
  { title: 'Bring your own API key',   desc: 'Works with Gemini, OpenAI, Claude, and Groq. Add your own API key in Settings — you control your usage and costs.' },
]

const STEPS = [
  { n: '01', title: 'Describe the attack', desc: 'Write a plain English description of the threat you want to detect. Choose from 16 built-in templates or write your own scenario.' },
  { n: '02', title: 'AI generates the rule', desc: 'The AI writes a syntactically correct detection rule with MITRE mapping, false positive guidance, tuning tips, and IR steps.' },
  { n: '03', title: 'Export and deploy',    desc: 'Copy the rule, download as .kql or ARM template, convert to another SIEM, improve it, or export to MITRE Navigator.' },
]

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <div style={{ minHeight:'100vh', background:'#0f172a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'fixed', inset:0, backgroundImage:'linear-gradient(rgba(99,102,241,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(99,102,241,0.04) 1px,transparent 1px)', backgroundSize:'24px 24px', pointerEvents:'none' }}/>
      <div style={{ position:'fixed', inset:0, background:'radial-gradient(ellipse at 0% 0%,rgba(249,115,22,0.07),transparent 50%),radial-gradient(ellipse at 100% 100%,rgba(99,102,241,0.07),transparent 50%)', pointerEvents:'none' }}/>

      <div style={{ position:'relative', zIndex:1 }}>

        {/* Nav */}
        <nav style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'1.25rem 2.5rem', borderBottom:'1px solid rgba(99,102,241,0.15)', background:'rgba(15,23,42,0.85)', backdropFilter:'blur(12px)', position:'sticky', top:0, zIndex:50 }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.6rem' }}>
            <div style={{ width:32, height:32, background:'#f97316', borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.75rem', color:'#fff', fontFamily:'monospace', boxShadow:'0 2px 8px rgba(249,115,22,.4)' }}>SD</div>
            <span style={{ fontSize:'1rem', fontWeight:700, letterSpacing:'-.01em' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></span>
          </div>
          <div style={{ display:'flex', gap:'.75rem', alignItems:'center' }}>
            <Link href="/login"  style={{ color:'#94a3b8', textDecoration:'none', fontSize:'.85rem', padding:'.45rem .9rem', borderRadius:7, border:'1px solid rgba(99,102,241,0.2)', transition:'all .2s' }}>Sign in</Link>
            <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontSize:'.85rem', fontWeight:600, padding:'.45rem 1.1rem', borderRadius:7, boxShadow:'0 2px 8px rgba(249,115,22,.3)' }}>Get started free</Link>
          </div>
        </nav>

        {/* Hero */}
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'5.5rem 2rem 4.5rem', textAlign:'center' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:'.5rem', padding:'.35rem .9rem', borderRadius:999, border:'1px solid rgba(249,115,22,0.3)', background:'rgba(249,115,22,0.08)', fontSize:'.75rem', color:'#fb923c', fontWeight:500, marginBottom:'1.75rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'#f97316' }}/>
            AI-powered detection engineering
          </div>
          <h1 style={{ fontSize:'clamp(2.2rem,5vw,3.6rem)', fontWeight:800, lineHeight:1.1, letterSpacing:'-.03em', margin:'0 0 1.5rem', background:'linear-gradient(135deg,#e2e8f0 0%,#94a3b8 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Generate production-ready<br/>
            <span style={{ background:'linear-gradient(135deg,#f97316,#fb923c)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>SIEM detection rules</span><br/>
            in seconds
          </h1>
          <p style={{ fontSize:'1.1rem', color:'#94a3b8', lineHeight:1.75, maxWidth:580, margin:'0 auto 2.5rem' }}>
            Describe an attack in plain English. Get a production-ready KQL, SPL, or EQL rule
            with MITRE ATT&CK mapping, false positive guidance, tuning tips, and IR steps — instantly.
          </p>
          <div style={{ display:'flex', gap:'.85rem', justifyContent:'center', flexWrap:'wrap' }}>
            <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontSize:'.95rem', fontWeight:700, padding:'.9rem 2.25rem', borderRadius:10, boxShadow:'0 4px 16px rgba(249,115,22,.35)', display:'inline-flex', alignItems:'center', gap:'.5rem' }}>
              Start generating free
            </Link>
            <Link href="/login" style={{ color:'#94a3b8', textDecoration:'none', fontSize:'.95rem', padding:'.9rem 2rem', borderRadius:10, border:'1px solid rgba(99,102,241,0.25)', display:'inline-flex', alignItems:'center', gap:'.5rem' }}>
              Sign in
            </Link>
          </div>
          <p style={{ fontSize:'.75rem', color:'#475569', marginTop:'1rem' }}>
            Free to use · No credit card required · Works with Gemini, OpenAI, Claude and Groq
          </p>
        </div>

        {/* Supported platforms */}
        <div style={{ borderTop:'1px solid rgba(99,102,241,0.12)', borderBottom:'1px solid rgba(99,102,241,0.12)', padding:'1.75rem 2rem', background:'rgba(30,41,59,0.3)', textAlign:'center' }}>
          <p style={{ fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.1em', color:'#475569', marginBottom:'1rem' }}>Works with</p>
          <div style={{ display:'flex', gap:'1rem', justifyContent:'center', flexWrap:'wrap', alignItems:'center' }}>
            {['Microsoft Sentinel','Splunk','Elastic SIEM','Google Gemini','OpenAI GPT-4','Anthropic Claude','Groq'].map(p => (
              <span key={p} style={{ fontSize:'.82rem', color:'#64748b', padding:'.3rem .85rem', border:'1px solid rgba(99,102,241,0.15)', borderRadius:6 }}>{p}</span>
            ))}
          </div>
        </div>

        {/* Features */}
        <div style={{ maxWidth:1100, margin:'0 auto', padding:'5rem 2rem' }}>
          <div style={{ textAlign:'center', marginBottom:'3rem' }}>
            <h2 style={{ fontSize:'1.85rem', fontWeight:700, letterSpacing:'-.02em', margin:'0 0 .75rem' }}>Everything a detection engineer needs</h2>
            <p style={{ color:'#94a3b8', fontSize:'.9rem' }}>From generation to deployment — all in one tool</p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'1rem' }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{ background:'rgba(30,41,59,0.6)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:14, padding:'1.4rem', backdropFilter:'blur(8px)' }}>
                <div style={{ fontSize:'.9rem', fontWeight:600, color:'#e2e8f0', marginBottom:'.4rem' }}>{f.title}</div>
                <div style={{ fontSize:'.8rem', color:'#94a3b8', lineHeight:1.65 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div style={{ borderTop:'1px solid rgba(99,102,241,0.12)', background:'rgba(30,41,59,0.2)' }}>
          <div style={{ maxWidth:900, margin:'0 auto', padding:'5rem 2rem', textAlign:'center' }}>
            <h2 style={{ fontSize:'1.85rem', fontWeight:700, letterSpacing:'-.02em', marginBottom:'.75rem' }}>How it works</h2>
            <p style={{ color:'#94a3b8', fontSize:'.9rem', marginBottom:'3rem' }}>Three steps from scenario to production rule</p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'1.5rem' }}>
              {STEPS.map(s => (
                <div key={s.n} style={{ background:'rgba(30,41,59,0.5)', border:'1px solid rgba(99,102,241,0.15)', borderRadius:14, padding:'1.75rem 1.4rem', textAlign:'left' }}>
                  <div style={{ fontSize:'1.75rem', fontWeight:800, color:'rgba(249,115,22,0.25)', fontFamily:'monospace', marginBottom:'.75rem' }}>{s.n}</div>
                  <div style={{ fontSize:'.9rem', fontWeight:600, color:'#e2e8f0', marginBottom:'.4rem' }}>{s.title}</div>
                  <div style={{ fontSize:'.8rem', color:'#94a3b8', lineHeight:1.65 }}>{s.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign:'center', padding:'5rem 2rem 6rem', borderTop:'1px solid rgba(99,102,241,0.12)' }}>
          <h2 style={{ fontSize:'2rem', fontWeight:700, letterSpacing:'-.02em', marginBottom:'.75rem' }}>Start detecting threats faster</h2>
          <p style={{ color:'#94a3b8', fontSize:'.9rem', marginBottom:'2rem' }}>Free to use. Bring your own API key. No credit card required.</p>
          <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', fontSize:'1rem', fontWeight:700, padding:'1rem 2.5rem', borderRadius:10, boxShadow:'0 4px 16px rgba(249,115,22,.35)', display:'inline-block' }}>
            Create free account
          </Link>
        </div>

        {/* Footer */}
        <div style={{ borderTop:'1px solid rgba(99,102,241,0.1)', padding:'1.5rem 2.5rem', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <div style={{ width:22, height:22, background:'#f97316', borderRadius:5, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'.55rem', color:'#fff', fontFamily:'monospace' }}>SD</div>
            <span style={{ fontSize:'.8rem', color:'#475569' }}>SentinelDetect — Built by Amanpreet Singh Matharu</span>
          </div>
          <div style={{ display:'flex', gap:'1.25rem' }}>
            <a href="https://github.com/Amanpreet-Ramgharia/sentineldetect" target="_blank" rel="noopener" style={{ fontSize:'.78rem', color:'#475569', textDecoration:'none' }}>GitHub</a>
            <a href="https://www.linkedin.com/in/amanpreets94/" target="_blank" rel="noopener" style={{ fontSize:'.78rem', color:'#475569', textDecoration:'none' }}>LinkedIn</a>
          </div>
        </div>

      </div>
    </div>
  )
}
