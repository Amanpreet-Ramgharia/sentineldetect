// app/api/soc/cases/[id]/summary/route.ts
// POST — generate AI incident narrative from linked alerts

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { runAI, parseJSON }         from '@/lib/ai'
import type { Provider }            from '@/lib/types'

interface P { params: Promise<{ id: string }> }

const SUMMARY_SYSTEM = `You are a senior SOC analyst writing a concise incident narrative for stakeholders and compliance records. Write clearly, factually, and without unnecessary jargon. Always respond with valid JSON only.`

const SUMMARY_USER = (caseTitle: string, alerts: any[]) => {
  const alertsText = alerts.map((a, i) =>
    `Alert ${i + 1}: ${a.title} | Severity: ${a.severity} | MITRE: ${a.mitre_technique || 'unknown'} | ${a.summary}`
  ).join('\n')

  return `Write an incident narrative for this security case.

Case: "${caseTitle}"
Alerts (${alerts.length}):
${alertsText}

Respond with this JSON:
{
  "narrative": "3-5 paragraph incident narrative covering: what happened, attack chain/progression, affected assets, current status, and recommended next steps",
  "attack_chain": ["step 1", "step 2", "step 3"],
  "key_mitre_techniques": ["T1234 — Name", "T5678 — Name"],
  "affected_assets": ["asset 1", "asset 2"],
  "severity_assessment": "one sentence justifying the overall case severity",
  "recommended_next_steps": ["step 1", "step 2", "step 3"]
}`
}

export async function POST(req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify case ownership
  const { data: scase } = await supabase
    .from('soc_cases').select('title').eq('id', id).eq('user_id', user.id).single()
  if (!scase) return NextResponse.json({ error: 'Case not found' }, { status: 404 })

  // Get linked alerts
  const { data: links } = await supabase
    .from('soc_case_alerts')
    .select('soc_alerts(title, severity, summary, mitre_technique, mitre_tactic, iocs)')
    .eq('case_id', id)

  const alerts = (links || []).map((l: any) => l.soc_alerts).filter(Boolean)

  if (alerts.length === 0) {
    return NextResponse.json({ error: 'Link at least one alert before generating a summary' }, { status: 400 })
  }

  const body  = await req.json().catch(() => ({}))
  const provider = (body.provider as Provider) || 'gemini'

  const { raw, model_used } = await runAI(
    SUMMARY_SYSTEM,
    SUMMARY_USER(scase.title, alerts),
    provider,
    user.id
  )

  const result = parseJSON<{
    narrative: string
    attack_chain: string[]
    key_mitre_techniques: string[]
    affected_assets: string[]
    severity_assessment: string
    recommended_next_steps: string[]
  }>(raw)

  // Save to case
  const summary = result.narrative || ''
  await supabase.from('soc_cases').update({
    ai_summary:    summary,
    ai_summary_at: new Date().toISOString(),
  }).eq('id', id)

  // Log event
  await supabase.from('soc_case_events').insert({
    case_id: id, user_id: user.id,
    event_type: 'ai_summary',
    content:    'AI incident narrative generated',
    metadata:   { model_used },
  })

  return NextResponse.json({ summary: result, model_used })
}
