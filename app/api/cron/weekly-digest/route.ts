import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }
  const sb = createServiceClient()
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

  const { data: profiles } = await sb.from('profiles').select('id,email,full_name,notification_preferences').not('notification_preferences','is',null)
  const subscribers = (profiles||[]).filter((p:any) => p.notification_preferences?.weekly_digest === true)
  let sent = 0

  for (const profile of subscribers) {
    try {
      const { data: rules } = await sb.from('rules').select('id,title,severity,mitre_id,created_at').eq('user_id',profile.id).order('created_at',{ascending:false})
      const all     = rules||[]
      const weekAgo = new Date(Date.now()-7*24*60*60*1000)
      const newR    = all.filter((r:any) => new Date(r.created_at) > weekAgo)
      const covered = new Set(all.filter((r:any)=>r.mitre_id).map((r:any)=>r.mitre_id)).size
      const name    = profile.full_name?.split(' ')[0] || 'there'

      await fetch('https://api.resend.com/emails', {
        method:'POST',
        headers:{ Authorization:`Bearer ${resendKey}`, 'Content-Type':'application/json' },
        body: JSON.stringify({
          from:'SentinelDetect <noreply@smartswingalerts.com>',
          to:[profile.email],
          subject:`Weekly digest — ${newR.length} new rule${newR.length!==1?'s':''} this week`,
          html:`<div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:2rem;"><div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1.5rem;"><div style="width:36px;height:36px;background:#f97316;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-family:monospace;font-size:.75rem;">SD</div><span style="font-size:1.1rem;font-weight:700;">SentinelDetect</span></div><h1 style="font-size:1.25rem;margin:0 0 .5rem;">Hi ${name},</h1><p style="color:#6b7280;margin:0 0 1.5rem;">Your weekly detection engineering summary.</p><div style="display:flex;gap:1rem;margin-bottom:1.5rem;">${[['Total rules',all.length],['New this week',newR.length],['Techniques',covered]].map(([l,n])=>`<div style="border:1px solid #e5e7eb;border-radius:8px;padding:.75rem 1rem;text-align:center;flex:1;"><div style="font-size:1.4rem;font-weight:800;color:#f97316;">${n}</div><div style="font-size:.7rem;color:#9ca3af;">${l}</div></div>`).join('')}</div>${newR.length>0?`<h3 style="font-size:.88rem;margin:0 0 .5rem;">New this week</h3>${newR.slice(0,5).map((r:any)=>`<div style="border:1px solid #e5e7eb;border-radius:6px;padding:.55rem .8rem;margin-bottom:.4rem;"><span style="font-size:.83rem;">${r.title}</span></div>`).join('')}`:'<p style="color:#9ca3af;font-size:.83rem;">No new rules this week.</p>'}<br/><a href="https://smartswingalerts.com/home" style="background:#f97316;color:#fff;text-decoration:none;padding:.7rem 1.4rem;border-radius:8px;font-weight:600;font-size:.88rem;">View dashboard</a><p style="font-size:.7rem;color:#d1d5db;margin-top:1.25rem;"><a href="https://smartswingalerts.com/profile" style="color:#f97316;">Manage preferences</a></p></div>`,
        }),
      })
      sent++
    } catch { /* continue */ }
  }
  return NextResponse.json({ sent, total: subscribers.length })
}
