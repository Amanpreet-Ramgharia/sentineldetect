// app/api/soc/alerts/[id]/correlate/route.ts
// Finds alerts that correlate with the given alert based on:
//   - Same MITRE technique (strong signal)
//   - Overlapping IOCs / same device IP (strong signal)
//   - Same source system within 24h (weak signal)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

interface P { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the source alert
  const { data: src } = await supabase
    .from('soc_alerts')
    .select('mitre_technique, iocs, source_system, severity, created_at')
    .eq('id', id).eq('user_id', user.id).single()

  if (!src) return NextResponse.json({ correlations: [] })

  // Fetch candidate alerts (last 7 days, not this alert, not resolved/FP)
  const since = new Date(); since.setDate(since.getDate() - 7)
  const { data: candidates } = await supabase
    .from('soc_alerts')
    .select('id, title, severity, status, mitre_technique, iocs, source_system, created_at')
    .eq('user_id', user.id)
    .neq('id', id)
    .not('status', 'in', '("resolved","false_positive")')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (!candidates?.length) return NextResponse.json({ correlations: [] })

  const srcIocs = new Set<string>(
    (src.iocs as string[] || []).map((i: string) => i.toLowerCase())
  )

  // Score each candidate
  const scored = candidates.map(c => {
    let score = 0
    const reasons: string[] = []

    // Same MITRE technique
    if (src.mitre_technique && c.mitre_technique === src.mitre_technique) {
      score += 40; reasons.push(`Same technique (${c.mitre_technique})`)
    }

    // Overlapping IOCs
    const cIocs = (c.iocs as string[] || []).map((i: string) => i.toLowerCase())
    const overlap = cIocs.filter((i: string) => srcIocs.has(i))
    if (overlap.length > 0) {
      score += overlap.length * 20
      reasons.push(`${overlap.length} shared IOC${overlap.length > 1 ? 's' : ''}: ${overlap.slice(0, 2).join(', ')}`)
    }

    // Same source system within 24h
    const hoursDiff = Math.abs(new Date(src.created_at).getTime() - new Date(c.created_at).getTime()) / 3600000
    if (src.source_system && c.source_system === src.source_system && hoursDiff < 24) {
      score += 10; reasons.push(`Same source (${c.source_system}) within 24h`)
    }

    return { ...c, score, reasons }
  })

  // Return only meaningful correlations (score >= 20), sorted by score
  const correlations = scored
    .filter(c => c.score >= 20)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ score, reasons, ...alert }) => ({ ...alert, correlation_score: score, correlation_reasons: reasons }))

  return NextResponse.json({ correlations })
}
