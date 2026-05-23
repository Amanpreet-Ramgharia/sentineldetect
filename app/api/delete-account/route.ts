import { NextResponse } from 'next/server'
import { createClient } from '@/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

/**
 * DELETE /api/delete-account
 *
 * Permanently removes the user from auth.users (not just the profiles table).
 * The profiles row and all FK-related rows cascade-delete automatically.
 *
 * WHY THIS ROUTE EXISTS:
 * Calling supabase.from('profiles').delete() from the client only removes
 * the profile row. The auth.users record survives, so the user can simply
 * sign back in with the same credentials. This route uses the service-role
 * admin API to delete the auth record too.
 */
export async function DELETE() {
  // 1. Verify the caller is authenticated
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Create an admin client using the service-role key
  //    (never expose this key to the browser)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // 3. Optionally: clean up Storage avatars first
  //    (auth.users deletion cascades DB rows but NOT storage objects)
  try {
    const { data: files } = await admin.storage
      .from('avatars')
      .list(user.id)

    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`)
      await admin.storage.from('avatars').remove(paths)
    }
  } catch {
    // Non-fatal — storage cleanup failure shouldn't block account deletion
    console.warn('Avatar cleanup failed for user', user.id)
  }

  // 4. Delete the user from auth.users
  //    This cascades to: profiles, rules, rule_versions, team_members,
  //    user_api_keys, sd_api_keys, custom_templates, usage_stats, password_history
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    console.error('Failed to delete user from auth.users:', deleteError)
    return NextResponse.json(
      { error: 'Failed to delete account. Please contact support.' },
      { status: 500 }
    )
  }

  // 5. Sign out the current session (best-effort; user record is gone anyway)
  await supabase.auth.signOut()

  return NextResponse.json({ success: true })
}
