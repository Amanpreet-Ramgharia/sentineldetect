import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days    = parseInt(new URL(req.url).searchParams.get('days') || '30')
  const since   = new Date(); since.setDate(since.getDate() - days)
  const sinceISO = since.toISOString()

  const { data: alerts } = await supabase
    .from('soc_alerts')
    .select('severity,status,mitre_technique,source_system,is_false_positive,created_at,alert_time')
    .eq('user_id', user.id).gte('created_at', sinceISO)

  const all   = alerts || []
  const total = all.length
  const fps   = all.filter(a => a.is_false_positive).length

  const mttdValues = all.filter(a => a.alert_time && a.created_at)
    .map(a => (new Date(a.created_at).getTime() - new Date(a.alert_time).getTime()) / 60000)
    .filter(v => v >= 0 && v < 10080)
  const avgMttd = mttdValues.length
    ? Math.round(mttdValues.reduce((s,v) => s+v,0) / mttdValues.length) : 0

  const { data: cases } = await supabase
    .from('soc_cases').select('opened_at,resolved_at')
    .eq('user_id', user.id).not('resolved_at','is',null).gte('created_at', sinceISO)
  const mttrValues = (cases||[]).map(c =>
    (new Date(c.resolved_at!).getTime()-new Date(c.opened_at).getTime())/60000).filter(v=>v>0)
  const avgMttr = mttrValues.length
    ? Math.round(mttrValues.reduce((s,v)=>s+v,0)/mttrValues.length) : 0

  // Volume per day
  const volumeMap: Record<string,number> = {}
  for (let i = days-1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate()-i)
    volumeMap[d.toISOString().split('T')[0]] = 0
  }
  for (const a of all) {
    const day = a.created_at.split('T')[0]
    if (day in volumeMap) volumeMap[day]++
  }
  const volume = Object.entries(volumeMap).map(([date, count]) => ({ date: date.slice(5), count }))

  const sevMap: Record<string,number> = {Critical:0,High:0,Medium:0,Low:0}
  for (const a of all) if (a.severity in sevMap) sevMap[a.severity]++
  const bySeverity = Object.entries(sevMap).map(([severity,count])=>({severity,count})).filter(e=>e.count>0)

  const mitreMap: Record<string,number> = {}
  for (const a of all) if (a.mitre_technique) mitreMap[a.mitre_technique] = (mitreMap[a.mitre_technique]||0)+1
  const byMitre = Object.entries(mitreMap).sort((a,b)=>b[1]-a[1]).slice(0,8)
    .map(([technique,count])=>({technique,count}))

  const srcMap: Record<string,number> = {}
  for (const a of all) { const s = a.source_system||'unknown'; srcMap[s]=(srcMap[s]||0)+1 }
  const bySource = Object.entries(srcMap).sort((a,b)=>b[1]-a[1]).slice(0,6)
    .map(([source,count])=>({source,count}))

  return NextResponse.json({
    overview: { total, resolved: all.filter(a=>a.status==='resolved').length,
      fps, fpRate: total>0?Math.round(fps/total*100):0, avgMttd, avgMttr },
    volume, bySeverity, byMitre, bySource,
  })
}
