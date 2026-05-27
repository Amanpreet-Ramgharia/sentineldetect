import { NextRequest, NextResponse } from 'next/server'
import { sendSlackTest }            from '@/lib/integrations/slack'

export async function POST(req: NextRequest) {
  const { webhook_url } = await req.json()
  if (!webhook_url?.startsWith('https://hooks.slack.com/')) {
    return NextResponse.json({ error: 'Invalid Slack webhook URL' }, { status: 400 })
  }
  const ok = await sendSlackTest(webhook_url)
  if (!ok) return NextResponse.json({ error: 'Failed to send test message' }, { status: 500 })
  return NextResponse.json({ success: true })
}
