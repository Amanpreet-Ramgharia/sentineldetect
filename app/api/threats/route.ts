import { NextResponse } from 'next/server'

const CISA_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'

export async function GET() {
  try {
    const res = await fetch(CISA_URL, {
      next: { revalidate: 3600 }, // cache for 1 hour
      headers: { 'User-Agent': 'SentinelDetect/1.0' },
    })
    if (!res.ok) throw new Error('CISA feed unavailable')
    const data = await res.json()
    // Return most recent 200, newest first
    const threats = (data.vulnerabilities || [])
      .sort((a: any, b: any) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, 200)
    return NextResponse.json({ threats, total: data.vulnerabilities?.length || 0 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to fetch threats'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
