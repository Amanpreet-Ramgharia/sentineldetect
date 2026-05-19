'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface KEV { cveID: string; vendorProject: string; product: string; vulnerabilityName: string; dateAdded: string; shortDescription: string; requiredAction: string }

export default function ThreatsPage() {
  const [threats,   setThreats]   = useState<KEV[]>([])
  const [filtered,  setFiltered]  = useState<KEV[]>([])
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [error,     setError]     = useState('')
  const router = useRouter()

  useEffect(() => {
    fetch('/api/threats')
      .then(r => r.json())
      .then(d => { setThreats(d.threats || []); setFiltered(d.threats || []) })
      .catch(() => setError('Failed to load threat feed'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!search) { setFiltered(threats); return }
    const q = search.toLowerCase()
    setFiltered(threats.filter(t => t.vendorProject.toLowerCase().includes(q) || t.product.toLowerCase().includes(q) || t.vulnerabilityName.toLowerCase().includes(q) || t.cveID.toLowerCase().includes(q)))
  }, [search, threats])

  function generateRule(t: KEV) {
    const scenario = `Detect exploitation of ${t.vulnerabilityName} (${t.cveID}) affecting ${t.vendorProject} ${t.product}. ${t.shortDescription}`
    router.push('/generate?prefill=' + encodeURIComponent(scenario))
  }

  return (
    <div style={{ padding:'1.5rem', maxWidth:1100, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.25rem' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
          <div>
            <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}> CISA Known Exploited Vulnerabilities</h1>
            <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Live feed from CISA KEV catalogue — click any vulnerability to generate a detection rule</p>
          </div>
          <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener" style={{ fontSize:'.75rem', color:'#f97316', textDecoration:'none', display:'flex', alignItems:'center', gap:'.3rem', flexShrink:0 }}>View CISA catalogue</a>
        </div>
      </div>

      <div style={{ marginBottom:'1rem' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by vendor, product, CVE ID, or vulnerability name..."
          style={{ width:'100%', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:9, padding:'.65rem 1rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit', transition:'border-color .2s' }}
          onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
          onBlur={e => e.target.style.borderColor='var(--border)'}/>
      </div>

      {loading && <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Loading CISA KEV feed...</div>}
      {error   && <div style={{ background:'var(--red-bg)', border:'1px solid var(--red-bd)', borderRadius:10, padding:'1rem', color:'var(--red)', fontSize:'.82rem' }}>{error}</div>}

      {!loading && !error && (
        <>
          <div style={{ fontSize:'.72rem', color:'var(--muted2)', fontFamily:'var(--font-mono)', marginBottom:'.75rem' }}>
            Showing {filtered.length} of {threats.length} vulnerabilities
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'.5rem' }}>
            {filtered.slice(0, 50).map(t => (
              <div key={t.cveID} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:10, padding:'.85rem 1rem', display:'flex', alignItems:'flex-start', gap:'1rem', transition:'border-color .15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor='rgba(249,115,22,.3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor='var(--border)'}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', flexWrap:'wrap', marginBottom:'.3rem' }}>
                    <span style={{ fontSize:'.72rem', fontFamily:'var(--font-mono)', background:'var(--red-bg)', color:'var(--red)', border:'1px solid var(--red-bd)', padding:'.1rem .45rem', borderRadius:4, fontWeight:600 }}>{t.cveID}</span>
                    <span style={{ fontSize:'.72rem', color:'var(--text)', fontWeight:500 }}>{t.vendorProject} — {t.product}</span>
                    <span style={{ fontSize:'.65rem', color:'var(--muted2)', fontFamily:'var(--font-mono)', marginLeft:'auto' }}>Added {t.dateAdded}</span>
                  </div>
                  <div style={{ fontSize:'.8rem', color:'var(--text2)', fontWeight:500, marginBottom:'.2rem' }}>{t.vulnerabilityName}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6 }}>{t.shortDescription}</div>
                </div>
                <button onClick={() => generateRule(t)} style={{ padding:'.4rem .85rem', borderRadius:7, border:'none', background:'#f97316', color:'#fff', fontSize:'.72rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap' }}>
                  Generate rule
                </button>
              </div>
            ))}
            {filtered.length > 50 && <div style={{ textAlign:'center', fontSize:'.78rem', color:'var(--muted)', padding:'1rem' }}>Showing first 50 results — use search to narrow down</div>}
          </div>
        </>
      )}
    </div>
  )
}
