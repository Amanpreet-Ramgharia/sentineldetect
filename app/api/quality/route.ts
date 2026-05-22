import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { createClient } from '@/lib/supabase/server'
import type { DetectionRule } from '@/lib/types'

const QUALITY_SYSTEM = `You are a senior detection engineer reviewing rule quality.
Score the given detection rule on four dimensions. Be honest and critical.
CRITICAL: Return ONLY a JSON object, no markdown.
Schema: {"specificity":number,"fp_risk":number,"coverage":number,"implementation":number,"overall":number,"summary":string,"improvements":string[]}`

const QUALITY_USER = (rule: DetectionRule) => `Score this ${rule.platform} detection rule:

Title: ${rule.title}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Tactic: ${rule.tactic}

Query:
${rule.rule}

Description: ${rule.description}
False positives noted: ${rule.false_positives?.join(', ') || 'none'}

Score each dimension 1-10:
- specificity: How precisely does it target the attack? (10 = very precise, minimal noise)
- fp_risk: How high is false positive risk? (10 = very high FP risk, 1 = very low)
- coverage: How many attacker variants/TTPs does it catch? (10 = broad coverage)
- implementation: Is the query syntactically correct and production-ready? (10 = perfect)
- overall: Weighted overall quality score
- summary: One sentence assessment
- improvements: Top 2-3 specific improvements`

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null
    try { const { data } = await supabase.auth.getUser(); user = data.user }
    catch { const { data } = await supabase.auth.getSession(); user = data.session?.user ?? null }
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { rule, provider = 'gemini' } = await req.json() as { rule: DetectionRule; provider?: string }
    if (!rule?.rule) return NextResponse.json({ error: 'Rule required' }, { status: 400 })

    const { raw, model_used } = await runAI(QUALITY_SYSTEM, QUALITY_USER(rule), provider as never, user.id)
    const quality = parseJSON<Record<string, unknown>>(raw)

    // Save to DB if rule has an ID
    if (rule.id) {
      await supabase.from('rules').update({
        quality_score:   quality.overall,
        quality_details: quality,
      }).eq('id', rule.id)
    }

    return NextResponse.json({ quality, model_used })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Scoring failed' }, { status: 500 })
  }
}
