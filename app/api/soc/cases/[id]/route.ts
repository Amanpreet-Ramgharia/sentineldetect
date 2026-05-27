// app/api/soc/cases/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

interface P { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Case + linked alerts + timeline in one shot
  const [caseRes, alertsRes, eventsRes] = await Promise.all([
    supabase.from('soc_cases').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('soc_case_alerts')
      .select('alert_id, linked_at, soc_alerts(*)')
      .eq('case_id', id)
      .order('linked_at', { ascending: true }),
    supabase.from('soc_case_events')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (caseRes.error || !caseRes.data) {
    return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  }

  return NextResponse.json({
    case:   caseRes.data,
    alerts: (alertsRes.data || []).map((r: any) => ({ ...r.soc_alerts, linked_at: r.linked_at })),
    events: eventsRes.data || [],
  })
}

export async function PATCH(req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowed = ['title', 'description', 'status', 'severity', 'assigned_to']
  const update: Record<string, unknown> = {}
  for (const k of allowed) if (k in body) update[k] = body[k]

  // Track SLA timestamps
  if (body.status === 'contained') update.contained_at = new Date().toISOString()
  if (body.status === 'resolved')  update.resolved_at  = new Date().toISOString()

  const { data, error } = await supabase
    .from('soc_cases').update(update).eq('id', id).eq('user_id', user.id).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log event if status changed
  if (body.status) {
    await supabase.from('soc_case_events').insert({
      case_id: id, user_id: user.id,
      event_type: 'status_change',
      content: `Status changed to ${body.status}`,
      metadata: { status: body.status },
    })
  }

  return NextResponse.json({ case: data })
}
