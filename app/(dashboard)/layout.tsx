'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Theme } from '@/lib/types'

const NAV = [
  { href:'/home',         label:'Dashboard'       },
  { href:'/soc',          label:'SOC'             },
  { href:'/generate',     label:'Generate'        },
  { href:'/rules',        label:'My Rules'        },
  { href:'/matrix',       label:'ATT&CK Coverage' },
  { href:'/analyser',     label:'Log Analyser'    },
  { href:'/sigma',        label:'Sigma Import'    },
  { href:'/threats',      label:'Live Threats'    },
  { href:'/templates',    label:'Templates'       },
  { href:'/integrations', label:'Integrations'    },
  { href:'/api-docs',     label:'API Access'      },
  { href:'/teams',        label:'Teams'           },
  { href:'/profile',      label:'Profile'         },
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

const BUG_URL = 'https://github.com/Amanpreet-Ramgharia/sentineldetect/issues/new?template=bug_report.md&title=Bug+report&body=**Page:**%0A%0A**What+happened:**%0A%0A**Expected:**%0A'

const PAGE_TITLES: Record<string, string> = {
  '/home':         'Dashboard',
  '/soc':          'SOC — Alert Queue',
  '/generate':     'Generate Detection Rule',
  '/rules':        'My Rules',
  '/matrix':       'ATT&CK Coverage',
  '/analyser':     'Log Analyser',
  '/sigma':        'Sigma Import',
  '/threats':      'Live Threats',
  '/templates':    'Templates',
  '/integrations': 'Integrations',
  '/api-docs':     'API Access',
  '/teams':        'Teams',
  '/settings':     'Settings',
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [theme,      setTheme]      = useState<Theme>('cyber')
  const [userName,   setUserName]   = useState('')
  const [sidebarOpen,setSidebarOpen]= useState(false)
  const [isMobile,   setIsMobile]   = useState(false)

  useEffect(() => {
    const saved = (localStorage.getItem('sd_theme') || 'cyber') as Theme
    applyTheme(saved)
  }, [])

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => { setSidebarOpen(false) }, [pathname])

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

  const sidebarW = isMobile ? '100%' : 210

  const sidebar = (
    <aside style={{
      width: isMobile ? '80vw' : sidebarW,
      maxWidth: isMobile ? 300 : sidebarW,
      flexShrink: 0,
      background:'var(--bg4)',
      borderRight:'1px solid var(--border)',
      display:'flex',
      flexDirection:'column',
      height:'100vh',
      overflowY:'auto',
      position: isMobile ? 'fixed' : 'sticky',
      top: 0,
      left: 0,
      zIndex: isMobile ? 200 : 10,
      transform: isMobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
      transition: 'transform .25s ease',
      boxShadow: isMobile && sidebarOpen ? '4px 0 24px rgba(0,0,0,.4)' : 'none',
    }}>
      {/* Logo */}
      <div style={{ padding:'1.1rem 1rem .85rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
          <div style={{ width:28, height:28, background:'#f97316', borderRadius:7, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontSize:'.6rem', fontWeight:700, color:'#fff', boxShadow:'0 2px 8px rgba(249,115,22,.35)', flexShrink:0 }}>SD</div>
          <div>
            <div style={{ fontSize:'.82rem', fontWeight:700, color:'var(--text)', letterSpacing:'-.01em' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></div>
            <div style={{ fontSize:'.58rem', color:'var(--muted2)', fontFamily:'monospace' }}>v4.0</div>
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setSidebarOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--muted)', fontSize:'1.2rem', padding:'.2rem', lineHeight:1 }}>&times;</button>
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding:'.6rem .65rem', flex:1 }}>
        <div style={{ fontSize:'.58rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', padding:'.1rem .38rem .45rem' }}>Navigation</div>
        {NAV.map(item => {
          const active = pathname === item.href || (item.href !== '/home' && pathname.startsWith(item.href))
          const isSOC  = item.href === '/soc'
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration:'none', display:'block' }}>
              <div style={{
                padding:'.48rem .75rem',
                borderRadius:6,
                marginBottom:'.15rem',
                fontSize:'.77rem',
                fontWeight: active ? 600 : 400,
                color: active ? '#f97316' : 'var(--muted)',
                background: active ? 'rgba(249,115,22,.1)' : 'transparent',
                border: active ? '1px solid rgba(249,115,22,.2)' : '1px solid transparent',
                transition:'all .15s',
                display:'flex',
                alignItems:'center',
                justifyContent:'space-between',
              }}>
                {item.label}
                {/* NEW badge on SOC until first visit */}
                {isSOC && !active && (
                  <span style={{ fontSize:'.55rem', fontWeight:700, background:'rgba(249,115,22,.15)', color:'#f97316', borderRadius:4, padding:'.1rem .35rem', letterSpacing:'.05em' }}>NEW</span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Theme */}
      <div style={{ padding:'.75rem .85rem', borderTop:'1px solid var(--border)' }}>
        <div style={{ fontSize:'.6rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', marginBottom:'.4rem' }}>Theme</div>
        <select value={theme} onChange={e => applyTheme(e.target.value as Theme)}
          style={{ background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:6, padding:'.3rem .55rem', color:'var(--text)', fontSize:'.72rem', outline:'none', fontFamily:'inherit', cursor:'pointer', width:'100%' }}>
          {THEMES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Attribution */}
      <div style={{ padding:'.6rem .85rem', borderTop:'1px solid var(--border)', background:'rgba(249,115,22,.03)' }}>
        <div style={{ fontSize:'.62rem', color:'var(--muted2)', marginBottom:'.25rem' }}>Built by</div>
        <div style={{ fontSize:'.72rem', fontWeight:600, color:'var(--text)', marginBottom:'.3rem' }}>Amanpreet Singh Matharu</div>
        <div style={{ display:'flex', gap:'.65rem', flexWrap:'wrap' }}>
          <a href="https://www.linkedin.com/in/amanpreets94/" target="_blank" rel="noopener" style={{ fontSize:'.65rem', color:'#f97316', textDecoration:'none' }}>LinkedIn</a>
          <a href="https://github.com/Amanpreet-Ramgharia/sentineldetect" target="_blank" rel="noopener" style={{ fontSize:'.65rem', color:'var(--muted)', textDecoration:'none' }}>GitHub</a>
          <a href={BUG_URL} target="_blank" rel="noopener" style={{ fontSize:'.65rem', color:'var(--muted)', textDecoration:'none' }}>Report bug</a>
        </div>
      </div>

      {/* User */}
      <div style={{ padding:'.65rem .85rem', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:'.72rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{userName}</span>
        <button onClick={signOut} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'.72rem', color:'var(--muted2)', padding:'.2rem .3rem', borderRadius:4, fontFamily:'inherit' }}
          onMouseEnter={e => (e.target as HTMLElement).style.color='var(--red)'}
          onMouseLeave={e => (e.target as HTMLElement).style.color='var(--muted2)'}>
          Sign out
        </button>
      </div>
    </aside>
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', position:'relative', zIndex:1 }}>
      {isMobile && sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', zIndex:199 }}/>
      )}

      {sidebar}

      <main style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>
        <div style={{ height:48, borderBottom:'1px solid var(--border)', background:'var(--header-bg)', backdropFilter:'blur(12px)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 1rem', flexShrink:0, position:'sticky', top:0, zIndex:50, gap:'.75rem' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'.75rem', minWidth:0 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer', color:'var(--muted)', padding:'.3rem .5rem', fontFamily:'inherit', fontSize:'.8rem', flexShrink:0 }}>
                ☰
              </button>
            )}
            <span style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pageTitle}</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'.5rem', fontSize:'.68rem', color:'var(--muted)', fontFamily:'monospace', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:999, padding:'.22rem .65rem', flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:'var(--green)' }}/>
            Ready
          </div>
        </div>
        <div style={{ flex:1, overflowY:'auto' }}>{children}</div>
      </main>
    </div>
  )
}
