// lib/integrations/slack.ts
// Sends Block Kit alert cards to a Slack incoming webhook URL.
// The webhook URL is stored in user_api_keys with provider='slack_webhook'.

import { createServiceClient } from '@/lib/supabase/server'

const SEV_EMOJI: Record<string, string> = {
  Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🔵',
}

export async function getSlackWebhook(userId: string): Promise<string | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('user_api_keys')
    .select('api_key')
    .eq('user_id', userId)
    .eq('provider', 'slack_webhook')
    .maybeSingle()
  return data?.api_key || null
}

export async function sendSlackAlert(userId: string, alert: {
  id: string
  title: string
  severity: string
  summary: string
  mitre_technique: string
  mitre_tactic: string
  source_system: string | null
  escalate: boolean
  is_false_positive: boolean
}): Promise<void> {
  const webhookUrl = await getSlackWebhook(userId)
  if (!webhookUrl) return // Slack not configured — silent no-op

  if (alert.is_false_positive) return // Don't spam for FPs

  const emoji  = SEV_EMOJI[alert.severity] || '⚪'
  const header = `${emoji}${alert.escalate ? ' ⚑ ESCALATED —' : ''} ${alert.title}`.slice(0, 150)

  const fields: any[] = []
  fields.push({ type: 'mrkdwn', text: `*Severity*\n${alert.severity}` })
  if (alert.mitre_technique) {
    fields.push({
      type: 'mrkdwn',
      text: `*MITRE*\n${alert.mitre_technique}${alert.mitre_tactic ? ` · ${alert.mitre_tactic}` : ''}`,
    })
  }
  if (alert.source_system) {
    fields.push({ type: 'mrkdwn', text: `*Source*\n${alert.source_system}` })
  }
  fields.push({ type: 'mrkdwn', text: `*Status*\nNew — needs triage` })

  const blocks: any[] = [
    { type: 'header', text: { type: 'plain_text', text: header, emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: alert.summary || '_No summary_' } },
    { type: 'section', fields: fields.slice(0, 4) },
    { type: 'divider' },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View in SOC →', emoji: true },
          url:  'https://smartswingalerts.com/soc',
          style: 'primary',
        },
      ],
    },
  ]

  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ blocks }),
    })
    if (!res.ok) {
      console.error('[slack] Webhook returned', res.status, await res.text())
    }
  } catch (e) {
    console.error('[slack] Failed to send notification:', e)
  }
}

export async function sendSlackTest(webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '✅ *SentinelDetect SOC* is connected to this channel.\nYou will receive alert notifications here.',
            },
          },
        ],
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
