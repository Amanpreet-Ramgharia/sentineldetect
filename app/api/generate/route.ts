import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { GENERATE_SYSTEM, GENERATE_USER } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { GenerateRequest, DetectionRule } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please sign in' }, { status: 401 })

    const body: GenerateRequest = await req.json()
    const { scenario, platform, focus, provider = 'gemini' } = body

    if (!scenario || scenario.trim().length < 10) {
      return NextResponse.json({ error: 'Scenario must be at least 10 characters' }, { status: 400 })
    }

    // Pass user.id so runAI checks user's own key first (BYOK)
    const { raw, model_used } = await runAI(
      GENERATE_SYSTEM(platform),
      GENERATE_USER(scenario, platform, focus),
      provider,
      user.id
    )

    const ruleData = parseJSON<DetectionRule>(raw)

    const rule: DetectionRule = {
      title:           ruleData.title           || 'Detection Rule',
      mitre_id:        ruleData.mitre_id        || '',
      mitre_name:      ruleData.mitre_name      || '',
      tactic:          ruleData.tactic          || '',
      severity:        ruleData.severity        || 'Medium',
      confidence:      typeof ruleData.confidence === 'number' ? Math.min(100, Math.max(0, ruleData.confidence)) : undefined,
      data_source:     ruleData.data_source     || '',
      platform,
      rule:            ruleData.rule            || '',
      description:     ruleData.description     || '',
      false_positives: Array.isArray(ruleData.false_positives) ? ruleData.false_positives : [],
      tuning_tips:     Array.isArray(ruleData.tuning_tips)     ? ruleData.tuning_tips     : [],
      response_steps:  Array.isArray(ruleData.response_steps)  ? ruleData.response_steps  : [],
      scenario,
      user_id: user.id,
    }

    const { data: saved } = await supabase
      .from('rules')
      .insert({ ...rule, team_id: null })
      .select()
      .single()

    return NextResponse.json({ rule: saved ?? rule, model_used })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    console.error('[/api/generate]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
