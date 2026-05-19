import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { action, team_id, email } = await req.json()

    if (action === 'invite') {
      // Find user by email
      const { data: profile } = await supabase
        .from('profiles').select('id').eq('email', email).single()

      if (!profile) return NextResponse.json({ error: `No account found for ${email}. They need to sign up first.` }, { status: 404 })

      // Check if already a member
      const { data: existing } = await supabase
        .from('team_members').select('user_id').eq('team_id', team_id).eq('user_id', profile.id).single()

      if (existing) return NextResponse.json({ error: 'User is already a team member' }, { status: 400 })

      // Add member
      const { error } = await supabase.from('team_members').insert({ team_id, user_id: profile.id, role: 'member' })
      if (error) throw error

      return NextResponse.json({ success: true, message: `${email} added to team` })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Team operation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
