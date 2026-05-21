'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

const STEPS = [
  { n:1, title:'Generate your first rule', desc:'Describe an attack in plain English — the AI writes the detection logic for you.', action:'Go to Generate', href:'/generate' },
  { n:2, title:'Check your ATT&CK coverage', desc:'See which MITRE techniques you have covered and which gaps remain.', action:'View matrix', href:'/matrix' },
  { n:3, title:'Add your API key', desc:'Add your own Gemini or OpenAI key in Settings for dedicated usage.', action:'Go to Settings', href:'/settings' },
]

export default function HomePage() {
  const [rules,         setRules]         = useState<any[]>([])
  const [loading,       setLoading]       = useState(true)
  const [user,          setUser]          = useState<any>(null)
  const [showOnboarding,setShowOnboarding]= useState(false)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    setUser(user)
    if (!user) { setLoading(false); return }

    // Check if onboarding dismissed
    const dismissed = localStorage.getItem(`sd_onboarded_${user.id}`)
    if (!dismissed) setShowOnboarding(true)

    const { data } = await sb.from('rules').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setRules(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function dismissOnboarding() {
    if (user) localStorage.setItem(`sd_onboarded_${user.id}`, '1')
    setShowOnboarding(false)
  }

  const tactics: Record<string,number> = {}
  rules.forEach(r => { if (r.tactic) tactics[r.tactic] = (tactics[r.tactic]||0)+1 })
  const covered = new Set(rules.map(r => r.mitre_id).filter(Boolean)).size
  const pct = rules.length > 0 ? Math.round(covered / 60 * 100) : 0
  const weekAgo = new Date(Date.now() - 7*24*60*60*1000)
  const thisWeek = rules.filter(r => new Date(r.created_at) > weekAgo).length
  const topTactics = Object.entries(tactics).sort((a,b)=>b[1]-a[1]).slice(0,5)
  const SEV: Record<string,string> = { High:'var(--red)', Critical:'var(--red)', Medium:'#f97316', Low:'var(--blue)' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:1100, margin:'0 auto' }}>

      {/* Onboarding wizard */}
      {showOnboarding && (
        <div style={{ background:'var(--bg4)', border:'1px solid rgba(249,115,22,.3)', borderRadius:14, padding:'1.5rem', marginBottom:'1.75rem', position:'relative', boxShadow:'0 4px 24px rgba(249,115,22,.08)' }}>
          <button onClick={dismissOnboarding} style={{ position:'absolute', top:'.85rem', right:'1rem', background:'none', border:'none', cursor:'pointer', fontSize:'1rem', color:'var(--muted)', padding:'.2rem .4rem', borderRadius:4, fontFamily:'inherit' }} title="Dismiss">
            &times;
          </button>
          <div style={{ fontSize:'.7rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'#f97316', marginBottom:'.4rem' }}>Getting started</div>
          <h2 style={{ fontSize:'1.05rem', fontWeight:700, color:'var(--text)', margin:'0 0 1rem' }}>
            Welcome to SentinelDetect{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}
          </h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))', gap:'.85rem', marginBottom:'1rem' }}>
            {STEPS.map(step => {
              const done = step.n === 1 ? rules.length > 0 : step.n === 3 ? false : covered > 0
              return (
                <div key={step.n} style={{ background:'var(--bg)', border:`1px solid ${done ? 'var(--green-bd)' : 'var(--border)'}`, borderRadius:10, padding:'1rem', position:'relative', overflow:'hidden' }}>
                  {done && <div style={{ position:'absolute', top:0, right:0, background:'var(--green)', color:'#fff', fontSize:'.58rem', fontWeight:700, padding:'.18rem .5rem', borderRadius:'0 0 0 6px' }}>Done</div>}
                  <div style={{ fontSize:'.72rem', fontFamily:'monospace', color:'#f97316', fontWeight:700, marginBottom:'.4rem' }}>Step {step.n}</div>
                  <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>{step.title}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.55, marginBottom:'.75rem' }}>{step.desc}</div>
                  <Link href={step.href} style={{ fontSize:'.75rem', color:'#f97316', textDecoration:'none', fontWeight:600 }}>{step.action} →</Link>
                </div>
              )
            })}
          </div>
          <button onClick={dismissOnboarding} style={{ fontSize:'.75rem', color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0 }}>
            Dismiss — I know what I am doing
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.75rem', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text)', margin:0 }}>
            {user?.user_metadata?.full_name ? `Welcome back, ${user.user_metadata.full_name.split(' ')[0]}` : 'Dashboard'}
          </h1>
          <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>
            {loading ? 'Loading...' : `${rules.length} rules · ${covered} MITRE techniques · ${pct}% coverage`}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding:'.45rem .9rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg4)', color:'var(--muted)', fontSize:'.78rem', cursor:loading?'not-allowed':'pointer', fontFamily:'inherit', flexShrink:0 }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(145px,1fr))', gap:'.85rem', marginBottom:'1.75rem' }}>
        {[
          { n:rules.length, l:'Total rules',     c:'#f97316'        },
          { n:thisWeek,     l:'This week',        c:'var(--green)'   },
          { n:`${pct}%`,    l:'ATT&CK coverage',  c:'var(--blue)'    },
          { n:Object.keys(tactics).length, l:'Tactics covered', c:'var(--purple)' },
          { n:covered,      l:'Techniques',       c:'var(--green)'   },
        ].map((s,i)=>(
          <div key={i} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'.9rem 1.1rem' }}>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:s.c, letterSpacing:'-.02em' }}>{s.n}</div>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginTop:'.15rem' }}>{s.l}</div>
          </div>
        ))}
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'.9rem 1.1rem', gridColumn:'span 2' }}>
          <div style={{ fontSize:'.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'.5rem' }}>Coverage progress</div>
          <div style={{ background:'var(--bg3)', borderRadius:999, height:8, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#f97316', borderRadius:999, transition:'width .6s' }}/>
          </div>
          <div style={{ fontSize:'.72rem', color:'var(--muted2)', marginTop:'.35rem' }}>{covered} of 60 tracked ATT&CK techniques</div>
        </div>
      </div>

      {rules.length === 0 && !loading && (
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'3rem', textAlign:'center', marginBottom:'1.75rem' }}>
          <div style={{ fontSize:'.95rem', fontWeight:600, color:'var(--text2)', marginBottom:'.5rem' }}>No rules yet</div>
          <div style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:'1.25rem' }}>Generate your first detection rule to see your dashboard populate</div>
          <Link href="/generate" style={{ background:'#f97316', color:'#fff', textDecoration:'none', padding:'.65rem 1.5rem', borderRadius:9, fontSize:'.85rem', fontWeight:700 }}>Generate first rule</Link>
        </div>
      )}

      {rules.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.75rem' }}>
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Recent rules</span>
              <Link href="/rules" style={{ fontSize:'.72rem', color:'#f97316', textDecoration:'none' }}>View all</Link>
            </div>
            {rules.slice(0,8).map(r=>(
              <div key={r.id} style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'.65rem' }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:SEV[r.severity]||'var(--muted)',flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.78rem', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize:'.63rem', color:'var(--muted2)', fontFamily:'monospace' }}>{r.mitre_id} · {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Top tactics</span>
            </div>
            {topTactics.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>Generate rules to see tactic coverage</div>
            ) : topTactics.map(([tactic, count])=>{
              const max = Math.max(...Object.values(tactics))
              return (
                <div key={tactic} style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'.75rem' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.78rem', color:'var(--text)', fontWeight:500, marginBottom:'.25rem' }}>{tactic}</div>
                    <div style={{ background:'var(--bg3)', borderRadius:999, height:5, overflow:'hidden' }}>
                      <div style={{ width:`${(count/max)*100}%`, height:'100%', background:'#f97316', borderRadius:999 }}/>
                    </div>
                  </div>
                  <span style={{ fontSize:'.72rem', fontFamily:'monospace', color:'var(--muted)', flexShrink:0 }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1rem 1.25rem' }}>
        <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.75rem' }}>Quick actions</div>
        <div style={{ display:'flex', gap:'.6rem', flexWrap:'wrap' }}>
          {[
            { href:'/generate',  label:'Generate rule'     },
            { href:'/sigma',     label:'Import Sigma'      },
            { href:'/threats',   label:'Latest threats'    },
            { href:'/matrix',    label:'ATT&CK gaps'       },
            { href:'/analyser',  label:'Analyse log'       },
            { href:'/api-docs',  label:'API access'        },
            { href:'/teams',     label:'Team workspace'    },
            { href:'/templates', label:'My templates'      },
            { href:'/report',    label:'Export PDF',      target:'_blank' },
          ].map(a=>(
            <Link key={a.href} href={a.href} style={{ padding:'.5rem 1rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', textDecoration:'none', fontSize:'.78rem', transition:'all .15s' }}>
              {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
