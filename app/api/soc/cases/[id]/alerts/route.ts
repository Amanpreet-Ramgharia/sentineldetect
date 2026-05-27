// app/api/soc/cases/[id]/alerts/route.ts
// POST   — link an alert to this case
// DELETE — unlink an alert

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

interface P { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: P) {
  const { id: case_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alert_id } = await req.json()
  if (!alert_id) return NextResponse.json({ error: 'alert_id required' }, { status: 400 })

  const { error } = await supabase
    .from('soc_case_alerts').insert({ case_id, alert_id })

  if (error?.code === '23505') {
    return NextResponse.json({ message: 'Alert already linked' })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get alert title for timeline
  const { data: alert } = await supabase
    .from('soc_alerts').select('title').eq('id', alert_id).single()

  await supabase.from('soc_case_events').insert({
    case_id, user_id: user.id,
    event_type: 'alert_linked',
    content: `Alert linked: ${alert?.title ?? alert_id}`,
    metadata: { alert_id, alert_title: alert?.title },
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: P) {
  const { id: case_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { alert_id } = await req.json()
  if (!alert_id) return NextResponse.json({ error: 'alert_id required' }, { status: 400 })

  await supabase.from('soc_case_alerts')
    .delete().eq('case_id', case_id).eq('alert_id', alert_id)

  await supabase.from('soc_case_events').insert({
    case_id, user_id: user.id,
    event_type: 'alert_unlinked',
    content: `Alert unlinked`,
    metadata: { alert_id },
  })

  return NextResponse.json({ success: true })
}
