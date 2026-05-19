'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function HomePage() {
  const [rules,   setRules]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [user,    setUser]    = useState<any>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    setUser(user)
    if (!user) { setLoading(false); return }

    const { data, error } = await sb
      .from('rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) console.error('Rules load error:', error)
    setRules(data || [])
    setLastRefresh(new Date())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = rules.filter(r => new Date(r.created_at) > weekAgo).length

  const tactics: Record<string,number> = {}
  const platforms: Record<string,number> = {}
  rules.forEach(r => {
    if (r.tactic) tactics[r.tactic] = (tactics[r.tactic]||0) + 1
    if (r.platform) {
      const short = r.platform.split(' ')[0]
      platforms[short] = (platforms[short]||0) + 1
    }
  })
  const covered = new Set(rules.map(r => r.mitre_id).filter(Boolean)).size
  const TOTAL = 60
  const pct = rules.length > 0 ? Math.round(covered / TOTAL * 100) : 0
  const topTactics = Object.entries(tactics).sort((a,b) => b[1]-a[1]).slice(0,5)

  const SEV: Record<string,string> = { High:'var(--red)', Critical:'var(--red)', Medium:'#f97316', Low:'var(--blue)' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:1100, margin:'0 auto' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'1.75rem', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text)', margin:0 }}>
            Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''} 
          </h1>
          <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>
            {loading ? 'Loading...' : `${rules.length} rules in your account · Last updated ${lastRefresh.toLocaleTimeString()}`}
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{ padding:'.45rem .9rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg4)', color:'var(--muted)', fontSize:'.78rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily:'inherit', flexShrink:0 }}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))', gap:'.85rem', marginBottom:'1.75rem' }}>
        {[
          { n: rules.length, l:'Total rules',      c:'#f97316'         },
          { n: thisWeek,     l:'This week',         c:'var(--green)'    },
          { n: `${pct}%`,    l:'ATT&CK coverage',  c:'var(--blue)'     },
          { n: Object.keys(tactics).length, l:'Tactics covered', c:'var(--purple)' },
          { n: covered,      l:'Techniques',        c:'var(--green)'    },
        ].map((s,i) => (
          <div key={i} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'.9rem 1.1rem' }}>
            <div style={{ fontSize:'1.6rem', fontWeight:800, color:s.c, letterSpacing:'-.02em' }}>{s.n}</div>
            <div style={{ fontSize:'.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginTop:'.15rem' }}>{s.l}</div>
          </div>
        ))}

        {/* Coverage bar */}
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'.9rem 1.1rem', gridColumn:'span 2' }}>
          <div style={{ fontSize:'.65rem', color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'.5rem' }}>Coverage progress</div>
          <div style={{ background:'var(--bg3)', borderRadius:999, height:8, overflow:'hidden' }}>
            <div style={{ width:`${pct}%`, height:'100%', background:'#f97316', borderRadius:999, transition:'width .6s' }}/>
          </div>
          <div style={{ fontSize:'.72rem', color:'var(--muted2)', marginTop:'.35rem' }}>{covered} of {TOTAL} tracked ATT&CK techniques covered</div>
        </div>
      </div>

      {rules.length === 0 && !loading && (
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:14, padding:'3rem', textAlign:'center', marginBottom:'1.75rem' }}>
          <div style={{ fontSize:'2.5rem', opacity:.2, marginBottom:'1rem' }}></div>
          <div style={{ fontSize:'1rem', fontWeight:600, color:'var(--text2)', marginBottom:'.5rem' }}>No rules yet</div>
          <div style={{ fontSize:'.82rem', color:'var(--muted)', marginBottom:'1.25rem' }}>Generate your first detection rule to see your dashboard populate</div>
          <Link href="/generate" style={{ background:'#f97316', color:'#fff', textDecoration:'none', padding:'.65rem 1.5rem', borderRadius:9, fontSize:'.85rem', fontWeight:700 }}>Generate first rule</Link>
        </div>
      )}

      {rules.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem', marginBottom:'1.75rem' }}>

          {/* Recent rules */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Recent rules</span>
              <Link href="/rules" style={{ fontSize:'.72rem', color:'#f97316', textDecoration:'none' }}>View all →</Link>
            </div>
            {rules.slice(0, 8).map(r => (
              <div key={r.id} style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'.65rem' }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:SEV[r.severity]||'var(--muted)', flexShrink:0 }}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'.78rem', color:'var(--text)', fontWeight:500, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.title}</div>
                  <div style={{ fontSize:'.63rem', color:'var(--muted2)', fontFamily:'var(--font-mono)' }}>{r.mitre_id} · {new Date(r.created_at).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Top tactics */}
          <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ padding:'.75rem 1rem', borderBottom:'1px solid var(--border)' }}>
              <span style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)' }}>Top tactics covered</span>
            </div>
            {topTactics.length === 0 ? (
              <div style={{ padding:'2rem', textAlign:'center', color:'var(--muted)', fontSize:'.82rem' }}>Generate rules to see tactic coverage</div>
            ) : topTactics.map(([tactic, count]) => {
              const max = Math.max(...Object.values(tactics))
              return (
                <div key={tactic} style={{ padding:'.6rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'.75rem' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'.78rem', color:'var(--text)', fontWeight:500, marginBottom:'.25rem' }}>{tactic}</div>
                    <div style={{ background:'var(--bg3)', borderRadius:999, height:5, overflow:'hidden' }}>
                      <div style={{ width:`${(count/max)*100}%`, height:'100%', background:'#f97316', borderRadius:999 }}/>
                    </div>
                  </div>
                  <span style={{ fontSize:'.72rem', fontFamily:'var(--font-mono)', color:'var(--muted)', flexShrink:0 }}>{count}</span>
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
            { href:'/generate',  icon:'', label:'Generate rule'     },
            { href:'/sigma',     icon:'', label:'Import Sigma'      },
            { href:'/threats',   icon:'', label:'Latest threats'    },
            { href:'/matrix',    icon:'', label:'ATT&CK gaps'       },
            { href:'/analyser',  icon:'', label:'Analyse log'       },
            { href:'/teams',     icon:'', label:'Team workspace'    },
            { href:'/templates', icon:'', label:'My templates'      },
          ].map(a => (
            <Link key={a.href} href={a.href} style={{ padding:'.5rem 1rem', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text)', textDecoration:'none', fontSize:'.78rem', display:'flex', alignItems:'center', gap:'.4rem', transition:'all .15s' }}>
              {a.icon} {a.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
