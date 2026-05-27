import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
import { runAI, parseJSON }         from '@/lib/ai'
import type { Provider }            from '@/lib/types'

const PLAYBOOK_SYSTEM = `You are a senior incident responder writing a structured response playbook. Be specific, actionable, and concise. Always respond with valid JSON only.`

const PLAYBOOK_USER = (technique: string, tactic: string, context: string) => `
Write an incident response playbook for:
MITRE Technique: ${technique}
MITRE Tactic: ${tactic}
${context ? `Alert context: ${context}` : ''}

Return this exact JSON:
{
  "title": "Playbook title (max 60 chars)",
  "overview": "2-3 sentence overview of the threat this playbook addresses",
  "triage": ["step 1","step 2","step 3"],
  "investigation": ["step 1","step 2","step 3","step 4"],
  "containment": ["action 1","action 2","action 3"],
  "eradication": ["action 1","action 2"],
  "evidence_to_collect": ["artifact 1","artifact 2","artifact 3"],
  "escalation_criteria": ["criterion 1","criterion 2"]
}`

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const mitre = searchParams.get('mitre')

  let query = supabase.from('soc_playbooks').select('*')
    .eq('user_id', user.id).order('created_at', { ascending: false })
  if (mitre) query = query.eq('mitre_technique', mitre)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playbooks: data || [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { mitre_technique, mitre_tactic = '', context = '',
          provider = 'gemini', alert_id, rule_id } = body

  if (!mitre_technique) return NextResponse.json({ error: 'mitre_technique required' }, { status: 400 })

  const { raw, model_used } = await runAI(
    PLAYBOOK_SYSTEM, PLAYBOOK_USER(mitre_technique, mitre_tactic, context),
    provider as Provider, user.id
  )

  const pb = parseJSON<any>(raw)
  const { data: profile } = await supabase.from('profiles')
    .select('active_team_id').eq('id', user.id).maybeSingle()

  const { data: saved, error } = await supabase.from('soc_playbooks').insert({
    user_id:         user.id,
    team_id:         profile?.active_team_id ?? null,
    mitre_technique, mitre_tactic,
    title:           pb.title || `Playbook: ${mitre_technique}`,
    overview:        pb.overview || '',
    steps:           { triage: pb.triage||[], investigation: pb.investigation||[],
                       containment: pb.containment||[], eradication: pb.eradication||[],
                       evidence_to_collect: pb.evidence_to_collect||[],
                       escalation_criteria: pb.escalation_criteria||[] },
    source:          'ai',
    alert_id:        alert_id || null,
    rule_id:         rule_id  || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ playbook: saved, model_used }, { status: 201 })
}
