import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null
    try { const { data } = await supabase.auth.getUser(); user = data.user }
    catch { const { data } = await supabase.auth.getSession(); user = data.session?.user ?? null }
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { rule_id, is_public } = await req.json()
    const { error } = await supabase.from('rules')
      .update({ is_public })
      .eq('id', rule_id)
      .eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true, url: is_public ? `/share/${rule_id}` : null })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
