'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Theme } from '@/lib/types'

const NAV = [
  { href:'/home',         label:'Dashboard'       },
  { href:'/generate',     label:'Generate'        },
  { href:'/rules',        label:'My Rules'        },
  { href:'/matrix',       label:'ATT&CK Coverage' },
  { href:'/analyser',     label:'Log Analyser'    },
  { href:'/sigma',        label:'Sigma Import'    },
  { href:'/threats',      label:'Live Threats'    },
  { href:'/templates',    label:'Templates'       },
  { href:'/integrations', label:'Integrations'    },
  { href:'/teams',        label:'Teams'           },
  { href:'/settings',     label:'Settings'        },
]

const THEMES: { value: Theme; label: string }[] = [
  { value:'cyber',    label:'Cyber Slate'   },
  { value:'terminal', label:'Dark Terminal' },
  { value:'midnight', label:'Midnight Neon' },
  { value:'ocean',    label:'Ocean Blue'    },
  { value:'rose',     label:'Rose Dark'     },
  { value:'clean',    label:'Clean Light'   },
]

const PAGE_TITLES: Record<string, string> = {
  '/home':'/home', '/generate':'Generate Detection Rule',
  '/rules':'My Rules', '/matrix':'ATT&CK Coverage Matrix',
  '/analyser':'Log Analyser', '/sigma':'Sigma Import',
  '/threats':'Live Threats — CISA KEV', '/templates':'Detection Templates',
  '/integrations':'Integrations', '/teams':'Team Workspaces',
  '/settings':'Settings',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [theme,    setTheme]    = useState<Theme>('cyber')
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const saved = (localStorage.getItem('sd_theme') || 'cyber') as Theme
    applyTheme(saved)
  }, [])

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserName(user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0] || 'User')
    })
  }, [])

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('sd_theme', t)
    setTheme(t)
  }

  async function signOut() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const pageTitle = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] || 'SentinelDetect'

  const inp: React.CSSProperties = { background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'.3rem .55rem', color:'var(--text)', fontSize:'.72rem', outline:'none', fontFamily:'inherit', cursor:'pointer', width:'100%' }

  return (
    <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>

      {/* Sidebar */}
      <aside style={{ width:210, flexShrink:0, background:'var(--bg4)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', position:'sticky', top:0, height:'100vh', overflowY:'auto' }}>
        {/* Logo */}
        <div style={{ padding:'1.1rem 1rem .85rem', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
            <div style={{ width:28, height:28, background:'#f97316', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:'.6rem', fontWeight:700, color:'#fff', boxShadow:'0 2px 8px rgba(249,115,22,.35)', flexShrink:0 }}>SD</div>
            <div>
              <div style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text)', letterSpacing:'-.01em' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></div>
              <div style={{ fontSize:'.58rem', color:'var(--muted2)', fontFamily:'monospace' }}>v4.0</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding:'.6rem .65rem', flex:1 }}>
          <div style={{ fontSize:'.58rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', padding:'.1rem .38rem .45rem' }}>Navigation</div>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration:'none', display:'block' }}>
                <div style={{ padding:'.48rem .75rem', borderRadius:6, marginBottom:'.15rem', fontSize:'.77rem', fontWeight: active ? 600 : 400, color: active ? '#f97316' : 'var(--muted)', background: active ? 'rgba(249,115,22,.1)' : 'transparent', border: active ? '1px solid rgba(249,115,22,.2)' : '1px solid transparent', transition:'all .15s' }}>
                  {item.label}
                </div>
              </Link>
            )
          })}
        </nav>

        {/* Theme selector */}
        <div style={{ padding:'.75rem .85rem', borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', marginBottom:'.4rem' }}>Theme</div>
          <select value={theme} onChange={e => applyTheme(e.target.value as Theme)} style={inp}>
            {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* User */}
        <div style={{ padding:'.75rem .85rem', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span style={{ fontSize:'.72rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{userName}</span>
          <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--muted2)', padding:'.2rem .3rem', borderRadius:4, fontFamily:'inherit' }}
            onMouseEnter={e => (e.target as HTMLElement).style.color='var(--red)'}
            onMouseLeave={e => (e.target as HTMLElement).style.color='var(--muted2)'}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ height:48, borderBottom:'1px solid var(--border)', background:'var(--header-bg)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1.5rem', flexShrink:0, position:'sticky', top:0, zIndex:50 }}>
          <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>{pageTitle}</span>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem', fontSize:'.68rem', color:'var(--muted)', fontFamily:'monospace', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:999, padding:'.22rem .65rem' }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)' }}/>
            Ready
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>{children}</div>
      </main>
    </div>
  )
}
