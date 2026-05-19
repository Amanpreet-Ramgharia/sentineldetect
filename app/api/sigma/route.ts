import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { DetectionRule, Platform } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { sigma, target } = await req.json() as { sigma: string; target: Platform }
    if (!sigma?.trim()) return NextResponse.json({ error: 'Sigma YAML required' }, { status: 400 })

    const system = `You are a SIEM detection engineer. Convert the given Sigma rule to ${target} syntax.
Respond with ONLY a raw JSON object. No markdown. Required fields:
{ "title": string, "mitre_id": string, "mitre_name": string, "tactic": string, "severity": string, "data_source": string, "platform": "${target}", "rule": string, "description": string, "false_positives": string[], "tuning_tips": string[], "response_steps": string[] }`

    const { raw, model_used } = await runAI(system, `Convert this Sigma rule to ${target}:\n\n${sigma.substring(0, 3000)}`)
    const rule = parseJSON<DetectionRule>(raw)
    rule.platform = target
    await supabase.from('rules').insert({ ...rule, user_id: user.id, team_id: null })
    return NextResponse.json({ rule, model_used })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Conversion failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
