// app/api/soc/cases/route.ts
// GET  — list cases with alert counts
// POST — create a new case (optionally linked to an alert)

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const limit  = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
  const offset = parseInt(searchParams.get('offset') || '0')

  let query = supabase
    .from('soc_cases')
    .select(`*, soc_case_alerts(count)`, { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') query = query.eq('status', status)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten alert count
  const cases = (data || []).map((c: any) => ({
    ...c,
    alert_count: Array.isArray(c.soc_case_alerts)
      ? c.soc_case_alerts[0]?.count ?? 0
      : 0,
    soc_case_alerts: undefined,
  }))

  return NextResponse.json({ cases, total: count })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { title, severity = 'Medium', description = '', alert_id } = body as {
    title: string; severity?: string; description?: string; alert_id?: string
  }

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Case title is required' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('profiles').select('active_team_id').eq('id', user.id).maybeSingle()

  // Create case
  const { data: newCase, error: caseErr } = await supabase
    .from('soc_cases')
    .insert({
      user_id:     user.id,
      team_id:     profile?.active_team_id ?? null,
      title:       title.trim(),
      severity,
      description,
      status:      'open',
    })
    .select().single()

  if (caseErr || !newCase) {
    return NextResponse.json({ error: caseErr?.message ?? 'Failed to create case' }, { status: 500 })
  }

  // Link initial alert if provided
  if (alert_id) {
    await supabase.from('soc_case_alerts').insert({ case_id: newCase.id, alert_id })
    await supabase.from('soc_case_events').insert({
      case_id:    newCase.id,
      user_id:    user.id,
      event_type: 'alert_linked',
      content:    'Initial alert linked at case creation',
      metadata:   { alert_id },
    })
  }

  // Log case created event
  await supabase.from('soc_case_events').insert({
    case_id:    newCase.id,
    user_id:    user.id,
    event_type: 'status_change',
    content:    'Case opened',
    metadata:   { status: 'open' },
  })

  return NextResponse.json({ case: newCase }, { status: 201 })
}
