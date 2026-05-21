import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VT_BASE = 'https://www.virustotal.com/api/v3'

function isIP(s: string)   { return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(s) && !s.startsWith('192.168') && !s.startsWith('10.') && !s.startsWith('172.') }
function isHash(s: string) { return /^[a-fA-F0-9]{32}$/.test(s) || /^[a-fA-F0-9]{40}$/.test(s) || /^[a-fA-F0-9]{64}$/.test(s) }

async function vtLookup(apiKey: string, type: 'ip' | 'file', value: string) {
  const endpoint = type === 'ip'
    ? `${VT_BASE}/ip_addresses/${encodeURIComponent(value)}`
    : `${VT_BASE}/files/${encodeURIComponent(value)}`

  const res = await fetch(endpoint, {
    headers: { 'x-apikey': apiKey },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return null
  const data = await res.json()
  const stats = data?.data?.attributes?.last_analysis_stats
  if (!stats) return null

  const total     = Object.values(stats as Record<string, number>).reduce((a, b) => a + b, 0)
  const malicious = (stats.malicious as number) || 0
  const suspicious = (stats.suspicious as number) || 0
  const country   = data?.data?.attributes?.country || null
  const asOwner   = data?.data?.attributes?.as_owner || null

  return {
    value,
    type,
    malicious,
    suspicious,
    total,
    reputation: malicious > 5 ? 'malicious' : malicious > 0 ? 'suspicious' : suspicious > 0 ? 'suspicious' : 'clean',
    score: `${malicious + suspicious}/${total}`,
    country,
    as_owner: asOwner,
    vt_link: type === 'ip'
      ? `https://www.virustotal.com/gui/ip-address/${value}`
      : `https://www.virustotal.com/gui/file/${value}`,
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    let user = null
    try {
      const { data } = await supabase.auth.getUser()
      user = data.user
    } catch {
      const { data } = await supabase.auth.getSession()
      user = data.session?.user ?? null
    }
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { indicators } = await req.json() as { indicators: string[] }
    if (!indicators?.length) return NextResponse.json({ results: [] })

    // Get user's VT API key
    const sb = createServiceClient()
    const { data: keyData } = await sb
      .from('user_api_keys')
      .select('api_key')
      .eq('user_id', user.id)
      .eq('provider', 'virustotal')
      .maybeSingle()

    const vtKey = keyData?.api_key || process.env.VIRUSTOTAL_API_KEY
    if (!vtKey) return NextResponse.json({ error: 'No VirusTotal API key. Add one in Settings.', results: [] })

    // Filter and classify indicators
    const toCheck = indicators
      .map(i => i.trim())
      .filter(i => i.length > 0)
      .slice(0, 5) // Max 5 per request to respect rate limits
      .map(i => ({ value: i, type: isIP(i) ? 'ip' as const : isHash(i) ? 'file' as const : null }))
      .filter(i => i.type !== null) as { value: string; type: 'ip' | 'file' }[]

    if (!toCheck.length) return NextResponse.json({ results: [] })

    // Look up each with a small delay to respect rate limits
    const results = []
    for (const item of toCheck) {
      const result = await vtLookup(vtKey, item.type, item.value)
      if (result) results.push(result)
      if (toCheck.indexOf(item) < toCheck.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    return NextResponse.json({ results })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Enrichment failed'
    return NextResponse.json({ error: msg, results: [] }, { status: 500 })
  }
}
