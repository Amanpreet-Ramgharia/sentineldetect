import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null
    try { const { data } = await supabase.auth.getUser(); user = data.user }
    catch { const { data } = await supabase.auth.getSession(); user = data.session?.user ?? null }
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { action, webhook_url, webhook_type, message } = await req.json()

    if (action === 'save') {
      await supabase.from('profiles').update({ webhook_url, webhook_type }).eq('id', user.id)
      return NextResponse.json({ success: true })
    }

    if (action === 'test') {
      const { data: profile } = await supabase.from('profiles').select('webhook_url,webhook_type').eq('id', user.id).single()
      if (!profile?.webhook_url) return NextResponse.json({ error: 'No webhook URL saved' }, { status: 400 })
      await sendWebhook(profile.webhook_url, profile.webhook_type, {
        text: 'SentinelDetect test message — your webhook is working correctly.',
      })
      return NextResponse.json({ success: true })
    }

    if (action === 'send' && webhook_url && message) {
      await sendWebhook(webhook_url, webhook_type || 'slack', message)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

async function sendWebhook(url: string, type: string, payload: Record<string, unknown>) {
  const body = type === 'teams'
    ? JSON.stringify({ type: 'message', attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { type: 'AdaptiveCard', body: [{ type: 'TextBlock', text: String(payload.text || ''), wrap: true }] } }] })
    : JSON.stringify({ text: payload.text, blocks: payload.blocks })
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body })
  if (!res.ok) throw new Error(`Webhook returned ${res.status}`)
}
