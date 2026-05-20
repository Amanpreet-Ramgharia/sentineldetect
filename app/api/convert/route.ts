import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { DetectionRule, Platform } from '@/lib/types'

type Action = 'convert' | 'improve' | 'explain'

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
      action: Action
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

      const system = `You are a senior SIEM detection engineer.
Convert the given ${rule.platform} detection rule to ${target} syntax.
CRITICAL: Respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks.
Use this exact schema:
{"title":string,"mitre_id":string,"mitre_name":string,"tactic":string,"severity":string,"data_source":string,"platform":"${target}","rule":string,"description":string,"false_positives":string[],"tuning_tips":string[],"response_steps":string[],"confidence":number}`

      const userMsg = `Convert this rule from ${rule.platform} to ${target}:

Title: ${rule.title}
MITRE: ${rule.mitre_id} - ${rule.mitre_name}
Tactic: ${rule.tactic}

Rule code:
${rule.rule}

Return the complete converted rule as JSON.`

      const { raw, model_used } = await runAI(system, userMsg, provider as never, user.id)
      const converted = parseJSON<DetectionRule>(raw)
      if (!converted.rule) throw new Error('Conversion returned empty rule. Please try again.')
      converted.platform = target
      return NextResponse.json({ rule: converted, model_used })
    }

    if (action === 'improve') {
      const improvements = body.improvements as string[] ?? []
      if (!improvements.length) return NextResponse.json({ error: 'Select at least one improvement' }, { status: 400 })

      const system = `You are a senior SIEM detection engineer specialising in ${rule.platform}.
Improve the given detection rule based on the specific instructions.
CRITICAL: Respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks.
You MUST return the complete improved rule including the "rule" field with the full detection query.
Use this exact schema:
{"title":string,"mitre_id":string,"mitre_name":string,"tactic":string,"severity":string,"data_source":string,"platform":"${rule.platform}","rule":string,"description":string,"false_positives":string[],"tuning_tips":string[],"response_steps":string[],"confidence":number}`

      const userMsg = `Improve this ${rule.platform} detection rule.

Current rule:
${rule.rule}

Title: ${rule.title}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Tactic: ${rule.tactic}
Severity: ${rule.severity}

Improvements to apply:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}
${body.custom_instructions ? `\nAdditional instructions: ${body.custom_instructions}` : ''}

Return the complete improved rule as a JSON object. The "rule" field must contain the full improved detection query.`

      const { raw, model_used } = await runAI(system, userMsg, provider as never, user.id)
      const improved = parseJSON<DetectionRule>(raw)
      if (!improved.rule) throw new Error('Improvement returned empty rule. Please try again.')
      improved.platform = rule.platform

      // Save improved version to DB
      if (rule.id) {
        await supabase.from('rules').update({
          rule: improved.rule,
          title: improved.title || rule.title,
          description: improved.description || rule.description,
          false_positives: improved.false_positives || rule.false_positives,
          tuning_tips: improved.tuning_tips || rule.tuning_tips,
          response_steps: improved.response_steps || rule.response_steps,
          confidence: improved.confidence ?? rule.confidence,
        }).eq('id', rule.id)
      }

      return NextResponse.json({ rule: { ...rule, ...improved, platform: rule.platform }, model_used })
    }

    if (action === 'explain') {
      const system = `You are a senior SOC analyst explaining detection rules to non-technical staff.
CRITICAL: Respond with ONLY a valid JSON object. No markdown, no explanation, no code blocks.
Use this exact schema:
{"title":string,"summary":string,"how_it_works":string,"what_it_catches":string,"limitations":string,"analogy":string}`

      const userMsg = `Explain this detection rule in plain English for a non-technical audience:

Title: ${rule.title}
Platform: ${rule.platform}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Tactic: ${rule.tactic}

Rule:
${rule.rule}

Description: ${rule.description}`

      const { raw, model_used } = await runAI(system, userMsg, provider as never, user.id)
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
