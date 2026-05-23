import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'

/**
 * POST /api/change-password
 *
 * Body: { password: string, isReset?: boolean }
 *
 * - Validates the new password against the last HISTORY_LIMIT stored hashes.
 * - If no match, updates the password via the admin API and stores the new hash.
 * - Used by both the reset-password page (isReset: true) and the profile
 *   security tab (normal authenticated change).
 *
 * SETUP REQUIRED:
 *   npm install bcryptjs
 *   npm install -D @types/bcryptjs
 *   Run password-history-migration.sql in the Supabase SQL editor first.
 */

const HISTORY_LIMIT = 5 // Reject reuse of the last N passwords
const BCRYPT_ROUNDS = 12

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)

  if (!body || typeof body.password !== 'string') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { password } = body as { password: string; isReset?: boolean }

  // Basic length validation (UI should also enforce this)
  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters.' },
      { status: 400 }
    )
  }

  // 1. Verify caller is authenticated
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  // 2. Admin client for password update + history reads
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 3. Fetch recent password hashes for this user
  const { data: history, error: historyError } = await admin
    .from('password_history')
    .select('id, password_hash')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (historyError) {
    console.error('Failed to read password history:', historyError)
    return NextResponse.json(
      { error: 'Unable to validate password. Please try again.' },
      { status: 500 }
    )
  }

  // 4. Check new password against stored hashes
  if (history && history.length > 0) {
    for (const entry of history) {
      const isReused = await bcrypt.compare(password, entry.password_hash)
      if (isReused) {
        return NextResponse.json(
          {
            error: `You cannot reuse any of your last ${HISTORY_LIMIT} passwords. Please choose a different one.`,
          },
          { status: 400 }
        )
      }
    }
  }

  // 5. Update the password via the admin API
  const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
    password,
  })

  if (updateError) {
    console.error('Failed to update password:', updateError)
    return NextResponse.json(
      { error: 'Failed to update password. Please try again.' },
      { status: 500 }
    )
  }

  // 6. Store the new hash in password_history
  const newHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  const { error: insertError } = await admin.from('password_history').insert({
    user_id: user.id,
    password_hash: newHash,
  })

  if (insertError) {
    // Non-fatal: password was updated, history insert failed. Log but don't error.
    console.error('Failed to insert password history entry:', insertError)
  }

  // 7. Prune entries beyond the limit so the table stays lean
  //    (keep most recent HISTORY_LIMIT, delete the rest)
  const { data: overflow } = await admin
    .from('password_history')
    .select('id')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(HISTORY_LIMIT, 999)

  if (overflow && overflow.length > 0) {
    await admin
      .from('password_history')
      .delete()
      .in(
        'id',
        overflow.map((r: { id: string }) => r.id)
      )
  }

  return NextResponse.json({ success: true })
}
