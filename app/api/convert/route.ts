import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import {
  CONVERT_SYSTEM, CONVERT_USER,
  IMPROVE_SYSTEM, IMPROVE_USER,
  EXPLAIN_SYSTEM, EXPLAIN_USER,
} from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { DetectionRule, RuleExplanation, Platform } from '@/lib/types'

type Action = 'convert' | 'improve' | 'explain'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body = await req.json()
    const { action, rule, provider = 'gemini', ...rest }: {
      action: Action
      rule: DetectionRule
      provider?: string
      to_platform?: Platform
      improvements?: string[]
      custom_instructions?: string
    } = body

    switch (action) {
      case 'convert': {
        const target = rest.to_platform as Platform
        if (!target) return NextResponse.json({ error: 'to_platform required' }, { status: 400 })
        const { raw, model_used } = await runAI(CONVERT_SYSTEM(target), CONVERT_USER(rule, target), provider as never)
        const converted = parseJSON<DetectionRule>(raw)
        converted.platform = target
        return NextResponse.json({ rule: converted, model_used })
      }
      case 'improve': {
        const improvements = rest.improvements ?? []
        if (!improvements.length) return NextResponse.json({ error: 'improvements required' }, { status: 400 })
        const { raw, model_used } = await runAI(IMPROVE_SYSTEM(rule.platform), IMPROVE_USER(rule, improvements, rest.custom_instructions), provider as never)
        const improved = parseJSON<DetectionRule>(raw)
        improved.platform = rule.platform
        return NextResponse.json({ rule: improved, model_used })
      }
      case 'explain': {
        const { raw, model_used } = await runAI(EXPLAIN_SYSTEM, EXPLAIN_USER(rule), provider as never)
        const explanation = parseJSON<RuleExplanation>(raw)
        return NextResponse.json({ explanation, model_used })
      }
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Action failed'
    console.error('[/api/convert]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
