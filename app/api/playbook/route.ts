import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { rule } = await req.json()
    if (!rule) return NextResponse.json({ error: 'Rule required' }, { status: 400 })

    const system = `You are a senior SOC analyst creating incident response playbooks.
Respond with ONLY a raw JSON object. Required fields:
{
  "title": string,
  "overview": string,
  "severity": string,
  "triage": string[],
  "investigation": string[],
  "containment": string[],
  "eradication": string[],
  "recovery": string[],
  "evidence_to_collect": string[],
  "escalation_criteria": string[],
  "prevention": string[]
}`

    const userPrompt = `Create a full incident response playbook for this detection rule:
Title: ${rule.title}
MITRE: ${rule.mitre_id} - ${rule.mitre_name}
Tactic: ${rule.tactic}
Severity: ${rule.severity}
Description: ${rule.description}`

    const { raw, model_used } = await runAI(system, userPrompt)
    const playbook = parseJSON<Record<string, unknown>>(raw)
    return NextResponse.json({ playbook, model_used })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Playbook generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
