import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'
interface P { params: Promise<{id:string}> }

export async function GET(_req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('soc_playbooks').select('*').eq('id', id).eq('user_id', user.id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ playbook: data })
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await supabase.from('soc_playbooks').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
