import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Known Sentinel tables for field validation
const SENTINEL_TABLES = ['DeviceProcessEvents','DeviceFileEvents','DeviceNetworkEvents','SecurityEvent','SigninLogs','AuditLogs','DeviceRegistryEvents','EmailEvents','CloudAppEvents','IdentityLogonEvents','DeviceImageLoadEvents','DeviceAlertEvents','Syslog']
const KQL_KEYWORDS   = ['where','project','extend','summarize','join','union','let','count','distinct','top','limit','order','sort','ago','now','between','has_any','has','contains','in','and','or','not','startswith','endswith','matches regex']

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { rule, platform } = await req.json()
    if (!rule) return NextResponse.json({ error: 'Rule required' }, { status: 400 })

    const issues: string[] = []
    const warnings: string[] = []
    const suggestions: string[] = []

    if (platform?.includes('KQL')) {
      // Check for valid table names
      const lines = rule.split('\n')
      const firstLine = lines[0]?.trim()
      if (firstLine && !firstLine.startsWith('//') && !firstLine.startsWith('let')) {
        const tableName = firstLine.split('|')[0].trim()
        if (tableName && !SENTINEL_TABLES.some(t => tableName.includes(t))) {
          warnings.push(`Table "${tableName}" is not a standard Sentinel table. Verify it exists in your workspace.`)
        }
      }
      // Check for time filter
      if (!rule.includes('ago(') && !rule.includes('TimeGenerated')) {
        warnings.push('No time filter found. Consider adding | where TimeGenerated > ago(1h) to prevent query timeouts.')
      }
      // Check for summarize without bin
      if (rule.includes('summarize') && !rule.includes('bin(')) {
        suggestions.push('Consider using bin(TimeGenerated, 1h) in your summarize to bucket results by time.')
      }
      // Check for missing count
      if (rule.includes('summarize') && !rule.includes('count()') && !rule.includes('dcount(')) {
        suggestions.push('Your summarize clause might benefit from count() to aggregate events.')
      }
    }

    if (platform?.includes('SPL')) {
      if (!rule.includes('index=')) warnings.push('No index specified. Add index=* or a specific index for better performance.')
      if (!rule.includes('earliest=') && !rule.includes('latest=')) suggestions.push('Consider adding time modifiers (earliest=-1h) for production use.')
    }

    // General checks
    if (rule.length < 50)  issues.push('Rule seems too short to be effective.')
    if (rule.length > 5000) warnings.push('Rule is very long. Consider breaking into multiple rules.')

    const score = Math.max(0, 100 - (issues.length * 25) - (warnings.length * 10) - (suggestions.length * 5))

    return NextResponse.json({
      valid: issues.length === 0,
      score,
      issues,
      warnings,
      suggestions,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Validation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
