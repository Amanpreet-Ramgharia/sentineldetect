import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { CONVERT_SYSTEM, CONVERT_USER, IMPROVE_SYSTEM, IMPROVE_USER, EXPLAIN_SYSTEM, EXPLAIN_USER } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { DetectionRule, Platform } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      const { data } = await supabase.auth.getSession()
      user = data.session?.user ?? null
    }
    if (!user) return NextResponse.json({ error: 'Session expired — please sign in again' }, { status: 401 })

    const body = await req.json()
    const { action, rule, provider = 'gemini' } = body as {
      action: 'convert' | 'improve' | 'explain'
      rule: DetectionRule
      provider?: string
      to_platform?: Platform
      improvements?: string[]
      custom_instructions?: string
    }

    if (!rule) return NextResponse.json({ error: 'Rule required' }, { status: 400 })

    if (action === 'convert') {
      const target = body.to_platform as Platform
      if (!target) return NextResponse.json({ error: 'to_platform required' }, { status: 400 })
      const { raw, model_used } = await runAI(CONVERT_SYSTEM(target), CONVERT_USER(rule, target), provider as never, user.id)
      const converted = parseJSON<DetectionRule>(raw)
      if (!converted.rule) throw new Error('Conversion returned empty rule. Please try again.')
      converted.platform = target
      return NextResponse.json({ rule: { ...rule, ...converted, platform: target }, model_used })
    }

    if (action === 'improve') {
      const improvements = body.improvements as string[] ?? []
      if (!improvements.length) return NextResponse.json({ error: 'Select at least one improvement' }, { status: 400 })

      const { raw, model_used } = await runAI(IMPROVE_SYSTEM(rule.platform), IMPROVE_USER(rule, improvements, body.custom_instructions), provider as never, user.id)
      const improved = parseJSON<DetectionRule>(raw)
      if (!improved.rule) throw new Error('Improvement returned empty rule. Please try again.')

      const mergedRule = { ...rule, ...improved, platform: rule.platform }

      // Save version snapshot before updating
      if (rule.id) {
        // Get current version count
        const { data: versions } = await supabase
          .from('rule_versions')
          .select('version')
          .eq('rule_id', rule.id)
          .order('version', { ascending: false })
          .limit(1)

        const nextVersion = ((versions?.[0]?.version ?? 0) as number) + 1

        await supabase.from('rule_versions').insert({
          rule_id:      rule.id,
          user_id:      user.id,
          rule_data:    rule,
          version:      nextVersion,
          improvements: improvements,
          created_at:   new Date().toISOString(),
        })

        // Update the live rule
        await supabase.from('rules').update({
          rule:            improved.rule,
          title:           improved.title           || rule.title,
          description:     improved.description     || rule.description,
          false_positives: improved.false_positives || rule.false_positives,
          tuning_tips:     improved.tuning_tips     || rule.tuning_tips,
          response_steps:  improved.response_steps  || rule.response_steps,
          confidence:      improved.confidence      ?? rule.confidence,
          updated_at:      new Date().toISOString(),
        }).eq('id', rule.id)
      }

      return NextResponse.json({ rule: mergedRule, model_used })
    }

    if (action === 'explain') {
      const { raw, model_used } = await runAI(EXPLAIN_SYSTEM, EXPLAIN_USER(rule), provider as never, user.id)
      const explanation = parseJSON<Record<string, unknown>>(raw)
      return NextResponse.json({ explanation, model_used })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed'
    console.error('[/api/convert]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
