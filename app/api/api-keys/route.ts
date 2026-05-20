import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { randomBytes, createHash } from 'crypto'

function generateKey(): { key: string; hash: string; preview: string } {
  const raw    = 'sd_' + randomBytes(32).toString('hex')
  const hash   = createHash('sha256').update(raw).digest('hex')
  const preview = raw.substring(0, 10)
  return { key: raw, hash, preview }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { name } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Key name required' }, { status: 400 })

    const { key, hash, preview } = generateKey()
    const sb = createServiceClient()
    const { error } = await sb.from('sd_api_keys').insert({
      user_id:     user.id,
      name:        name.trim(),
      key_hash:    hash,
      key_preview: preview,
    })
    if (error) throw error

    return NextResponse.json({ key })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    const { data } = await supabase.from('sd_api_keys').select('id,name,key_preview,created_at,last_used_at').eq('user_id', user.id)
    return NextResponse.json({ keys: data || [] })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Failed' }, { status: 500 })
  }
}
