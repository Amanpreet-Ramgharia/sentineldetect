// app/api/soc/alerts/route.ts
// GET  — list alerts with filters
// POST — manually submit an alert (from the UI paste box)

import { NextRequest, NextResponse }  from 'next/server'
import { createClient }               from '@/lib/supabase/server'
import { runAI, parseJSON }           from '@/lib/ai'
import { TRIAGE_SYSTEM, TRIAGE_USER, type TriageResult } from '@/lib/ai/triage'
import type { Provider }              from '@/lib/types'

// ── GET — alert queue ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status   = searchParams.get('status')    // new|investigating|resolved|false_positive|all
  const severity = searchParams.get('severity')  // Critical|High|Medium|Low
  const limit    = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset   = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('soc_alerts')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') query = query.eq('status', status)
  if (severity)                   query = query.eq('severity', severity)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ alerts: data, total: count })
}

// ── POST — manual alert submission from UI ───────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { alert_text, provider = 'gemini' } = body as {
    alert_text: string
    provider?: Provider
  }

  if (!alert_text || alert_text.trim().length < 5) {
    return NextResponse.json({ error: 'Alert text is required' }, { status: 400 })
  }

  const { raw, model_used } = await runAI(
    TRIAGE_SYSTEM,
    TRIAGE_USER(alert_text),
    provider as Provider,
    user.id
  )

  const triage = parseJSON<TriageResult>(raw)

  const { data: profile } = await supabase
    .from('profiles')
    .select('active_team_id')
    .eq('id', user.id)
    .maybeSingle()

  const { data: saved, error: saveError } = await supabase
    .from('soc_alerts')
    .insert({
      user_id:              user.id,
      team_id:              profile?.active_team_id ?? null,
      raw_payload:          { alert_text },
      source:               'manual',
      source_system:        triage.source_system || null,
      title:                triage.title          || 'Untitled Alert',
      severity:             triage.severity       || 'Medium',
      severity_score:       triage.severity_score  ?? 5,
      summary:              triage.summary         || '',
      mitre_technique:      triage.mitre_technique || '',
      mitre_tactic:         triage.mitre_tactic    || '',
      mitre_name:           triage.mitre_name      || '',
      iocs:                 triage.iocs            || [],
      investigation_steps:  triage.investigation_steps || [],
      response_actions:     triage.response_actions    || [],
      is_false_positive:    triage.is_false_positive   ?? false,
      false_positive_reason: triage.false_positive_reason || '',
      escalate:             triage.escalate         ?? false,
      escalation_reason:    triage.escalation_reason || '',
      status:               triage.is_false_positive ? 'false_positive' : 'new',
    })
    .select()
    .single()

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 500 })
  return NextResponse.json({ alert: saved, model_used })
}
