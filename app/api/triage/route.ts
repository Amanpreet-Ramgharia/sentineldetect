// app/api/triage/route.ts
// Public endpoint — authenticated via sd_ API key, no session needed.
// Accepts any JSON alert payload, runs AI triage, saves to soc_alerts.
//
// Usage:
//   POST /api/triage
//   Authorization: Bearer sd_your_key_here
//   Content-Type: application/json
//   Body: any JSON alert (raw Splunk alert, Sentinel incident, etc.)
//
//   Or wrap it: { "alert": {...}, "source": "splunk", "provider": "gemini" }

import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON }          from '@/lib/ai'
import { TRIAGE_SYSTEM, TRIAGE_USER, type TriageResult } from '@/lib/ai/triage'
import { createServiceClient }       from '@/lib/supabase/server'
import { createHash }                from 'crypto'
import type { Provider }             from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ────────────────────────────────────────────────────────────────
    const auth   = req.headers.get('authorization') || ''
    const rawKey = auth.replace('Bearer ', '').trim()

    if (!rawKey.startsWith('sd_')) {
      return NextResponse.json(
        { error: 'Invalid API key format. Key must start with sd_. Get one at Settings → API Keys.' },
        { status: 401 }
      )
    }

    const hash = createHash('sha256').update(rawKey).digest('hex')
    const sb   = createServiceClient()

    const { data: keyRecord } = await sb
      .from('sd_api_keys')
      .select('id, user_id')
      .eq('key_hash', hash)
      .maybeSingle()

    if (!keyRecord) {
      return NextResponse.json({ error: 'Invalid or revoked API key' }, { status: 401 })
    }

    await sb
      .from('sd_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)

    // ── Parse payload ────────────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    // Normalise alert text — accept any shape
    let alertText: string
    if (body.alert && typeof body.alert === 'string') {
      alertText = body.alert
    } else if (body.alert && typeof body.alert === 'object') {
      alertText = JSON.stringify(body.alert, null, 2)
    } else {
      // Treat the whole body as the alert payload
      alertText = JSON.stringify(body, null, 2)
    }

    if (alertText.trim().length < 5) {
      return NextResponse.json({ error: 'Alert payload is empty' }, { status: 400 })
    }

    const provider  = (body.provider as Provider) || 'gemini'
    const sourceTag = (body.source as string)     || 'api'

    // ── AI triage ────────────────────────────────────────────────────────────
    const { raw, model_used } = await runAI(
      TRIAGE_SYSTEM,
      TRIAGE_USER(alertText),
      provider,
      keyRecord.user_id
    )

    const triage = parseJSON<TriageResult>(raw)

    // ── Get user's active team ────────────────────────────────────────────────
    const { data: profile } = await sb
      .from('profiles')
      .select('active_team_id')
      .eq('id', keyRecord.user_id)
      .maybeSingle()

    // ── Save alert ────────────────────────────────────────────────────────────
    const { data: saved, error: saveError } = await sb
      .from('soc_alerts')
      .insert({
        user_id:              keyRecord.user_id,
        team_id:              profile?.active_team_id ?? null,
        raw_payload:          body,
        source:               sourceTag,
        source_system:        triage.source_system || (body.source_system as string) || null,
        title:                triage.title         || 'Untitled Alert',
        severity:             triage.severity      || 'Medium',
        severity_score:       triage.severity_score ?? 5,
        summary:              triage.summary        || '',
        mitre_technique:      triage.mitre_technique || '',
        mitre_tactic:         triage.mitre_tactic    || '',
        mitre_name:           triage.mitre_name      || '',
        iocs:                 triage.iocs            || [],
        investigation_steps:  triage.investigation_steps || [],
        response_actions:     triage.response_actions    || [],
        is_false_positive:    triage.is_false_positive   ?? false,
        false_positive_reason: triage.false_positive_reason || '',
        escalate:             triage.escalate             ?? false,
        escalation_reason:    triage.escalation_reason    || '',
        status:               triage.is_false_positive ? 'false_positive' : 'new',
        alert_time:           (body.timestamp as string) || new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) {
      console.error('[triage] DB save error:', saveError.message)
    }

    return NextResponse.json({
      alert:       saved ?? { ...triage },
      model_used,
    })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Triage failed'
    console.error('[triage] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
