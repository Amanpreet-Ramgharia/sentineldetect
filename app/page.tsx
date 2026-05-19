import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/home')

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0f172a', color:'#e2e8f0', fontFamily:'system-ui,sans-serif' }}>
      <div style={{ textAlign:'center', padding:'2rem' }}>
        <div style={{ width:52, height:52, background:'#f97316', borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'monospace', fontWeight:700, color:'#fff', fontSize:'1rem', margin:'0 auto 1rem', boxShadow:'0 4px 16px rgba(249,115,22,.4)' }}>SD</div>
        <h1 style={{ fontSize:'2rem', fontWeight:700, margin:'0 0 .5rem' }}>Sentinel<span style={{ color:'#f97316' }}>Detect</span></h1>
        <p style={{ color:'#94a3b8', marginBottom:'2rem' }}>AI-powered SIEM detection rule generator</p>
        <div style={{ display:'flex', gap:'1rem', justifyContent:'center' }}>
          <Link href="/signup" style={{ background:'#f97316', color:'#fff', textDecoration:'none', padding:'.75rem 1.75rem', borderRadius:9, fontWeight:700 }}>Get started free</Link>
          <Link href="/login" style={{ color:'#94a3b8', textDecoration:'none', padding:'.75rem 1.75rem', borderRadius:9, border:'1px solid rgba(99,102,241,0.25)' }}>Sign in</Link>
        </div>
      </div>
    </div>
  )
}
