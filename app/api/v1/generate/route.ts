import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { GENERATE_SYSTEM, GENERATE_USER } from '@/lib/ai/prompts'
import { createServiceClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'
import type { DetectionRule, Platform } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    // Authenticate via API key
    const auth = req.headers.get('authorization') || ''
    const rawKey = auth.replace('Bearer ', '').trim()
    if (!rawKey.startsWith('sd_')) {
      return NextResponse.json({ error: 'Invalid API key format. Key must start with sd_' }, { status: 401 })
    }

    const hash = createHash('sha256').update(rawKey).digest('hex')
    const sb = createServiceClient()
    const { data: keyRecord } = await sb
      .from('sd_api_keys')
      .select('id, user_id')
      .eq('key_hash', hash)
      .maybeSingle()

    if (!keyRecord) return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })

    // Update last used
    await sb.from('sd_api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id)

    // Parse request
    const body = await req.json()
    const { scenario, platform = 'Microsoft Sentinel (KQL)', focus, provider = 'gemini' } = body as {
      scenario: string; platform?: Platform; focus?: string; provider?: string
    }

    if (!scenario || scenario.trim().length < 10) {
      return NextResponse.json({ error: 'scenario must be at least 10 characters' }, { status: 400 })
    }

    const { raw, model_used } = await runAI(
      GENERATE_SYSTEM(platform as Platform),
      GENERATE_USER(scenario, platform as Platform, focus),
      provider as never,
      keyRecord.user_id
    )

    const ruleData = parseJSON<DetectionRule>(raw)
    const rule: DetectionRule = {
      title:           ruleData.title           || 'Detection Rule',
      mitre_id:        ruleData.mitre_id        || '',
      mitre_name:      ruleData.mitre_name      || '',
      tactic:          ruleData.tactic          || '',
      severity:        ruleData.severity        || 'Medium',
      confidence:      typeof ruleData.confidence === 'number' ? ruleData.confidence : undefined,
      data_source:     ruleData.data_source     || '',
      platform:        platform as Platform,
      rule:            ruleData.rule            || '',
      description:     ruleData.description     || '',
      false_positives: Array.isArray(ruleData.false_positives) ? ruleData.false_positives : [],
      tuning_tips:     Array.isArray(ruleData.tuning_tips)     ? ruleData.tuning_tips     : [],
      response_steps:  Array.isArray(ruleData.response_steps)  ? ruleData.response_steps  : [],
      scenario,
      user_id: keyRecord.user_id,
    }

    const { data: saved } = await sb.from('rules').insert({ ...rule, team_id: null }).select().single()

    return NextResponse.json({ rule: saved ?? rule, model_used })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
