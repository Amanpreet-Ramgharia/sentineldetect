// app/api/triage/route.ts — updated for Phase 3
// Added: SIEM payload normalisation + Slack notification

import { NextRequest, NextResponse }  from 'next/server'
import { runAI, parseJSON }           from '@/lib/ai'
import { TRIAGE_SYSTEM, TRIAGE_USER, type TriageResult } from '@/lib/ai/triage'
import { createServiceClient }        from '@/lib/supabase/server'
import { detectSource, normalizePayload } from '@/lib/integrations/parsers'
import { sendSlackAlert }             from '@/lib/integrations/slack'
import { createHash }                 from 'crypto'
import type { Provider }              from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const auth   = req.headers.get('authorization') || ''
    const rawKey = auth.replace('Bearer ', '').trim()

    if (!rawKey.startsWith('sd_')) {
      return NextResponse.json(
        { error: 'Invalid API key. Key must start with sd_. Get one at Settings → API Keys.' },
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

    await sb.from('sd_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)

    // ── Parse payload ────────────────────────────────────────────────────────
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 })
    }

    const provider  = (body.provider as Provider) || 'gemini'
    const sourceTag = (body.source as string)     || 'api'

    // Extract the actual alert data (support { alert: {...} } wrapper or raw payload)
    let alertPayload: Record<string, unknown>
    let rawAlertText: string | null = null

    if (body.alert && typeof body.alert === 'string') {
      rawAlertText = body.alert
      alertPayload = body
    } else if (body.alert && typeof body.alert === 'object') {
      alertPayload = body.alert as Record<string, unknown>
    } else {
      alertPayload = body
    }

    // ── SIEM normalisation ───────────────────────────────────────────────────
    // Auto-detect the source SIEM and normalise to clean structured text
    // This dramatically improves AI triage quality vs raw JSON dumps
    let alertText: string
    let detectedSource = sourceTag

    if (rawAlertText) {
      alertText = rawAlertText
    } else {
      const siem = detectSource(alertPayload)
      if (siem !== 'generic') detectedSource = siem
      alertText = normalizePayload(alertPayload, siem)
    }

    if (!alertText || alertText.trim().length < 5) {
      return NextResponse.json({ error: 'Alert payload is empty' }, { status: 400 })
    }

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
        source:               detectedSource,
        source_system:        triage.source_system || (body.source_system as string) || detectedSource !== 'api' ? detectedSource : null,
        title:                triage.title          || 'Untitled Alert',
        severity:             triage.severity       || 'Medium',
        severity_score:       triage.severity_score  ?? 5,
        summary:              triage.summary         || '',
        mitre_technique:      triage.mitre_technique || '',
        mitre_tactic:         triage.mitre_tactic    || '',
        mitre_name:           triage.mitre_name      || '',
        iocs:                 triage.iocs            || [],
        investigation_steps:  triage.investigation_steps || [],
        response_actions:     triage.response_actions    || [],
        is_false_positive:    triage.is_false_positive   ?? false,
        false_positive_reason: triage.false_positive_reason || '',
        escalate:             triage.escalate         ?? false,
        escalation_reason:    triage.escalation_reason || '',
        status:               triage.is_false_positive ? 'false_positive' : 'new',
        alert_time:           (body.timestamp as string) || new Date().toISOString(),
      })
      .select()
      .single()

    if (saveError) {
      console.error('[triage] DB save error:', saveError.message)
    }

    // ── Slack notification (async — don't block response) ─────────────────────
    if (saved) {
      sendSlackAlert(keyRecord.user_id, {
        id:              saved.id,
        title:           saved.title,
        severity:        saved.severity,
        summary:         saved.summary,
        mitre_technique: saved.mitre_technique,
        mitre_tactic:    saved.mitre_tactic,
        source_system:   saved.source_system,
        escalate:        saved.escalate,
        is_false_positive: saved.is_false_positive,
      }).catch(e => console.error('[triage] Slack notification failed:', e))
    }

    return NextResponse.json({ alert: saved ?? triage, model_used })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Triage failed'
    console.error('[triage] error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
