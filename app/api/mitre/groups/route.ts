import { NextResponse }        from 'next/server'
import { createClient }        from '@/lib/supabase/server'
import { THREAT_GROUPS }       from '@/lib/mitre/threat-groups'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Load user's covered techniques
  const { data: rules } = await supabase
    .from('rules').select('mitre_id').eq('user_id', user.id)

  const covered = new Set<string>(
    (rules || []).flatMap((r: any) => r.mitre_id
      ? [r.mitre_id.toUpperCase(), r.mitre_id.split('.')[0].toUpperCase()]
      : []
    )
  )

  // For each group, calculate coverage stats
  const groups = THREAT_GROUPS.map(g => {
    const total    = g.techniques.length
    const coveredT = g.techniques.filter(t =>
      covered.has(t.toUpperCase()) || covered.has(t.split('.')[0].toUpperCase())
    ).length
    return {
      ...g,
      coverage_count: coveredT,
      coverage_pct:   Math.round((coveredT / total) * 100),
      covered_techniques: g.techniques.filter(t =>
        covered.has(t.toUpperCase()) || covered.has(t.split('.')[0].toUpperCase())
      ),
      gap_techniques: g.techniques.filter(t =>
        !covered.has(t.toUpperCase()) && !covered.has(t.split('.')[0].toUpperCase())
      ),
    }
  })

  return NextResponse.json({ groups })
}
