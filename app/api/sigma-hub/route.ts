// app/api/sigma-hub/route.ts
// Proxies SigmaHQ GitHub API and parses YAML rule files

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

// In-memory cache: key → { data, ts }
const cache = new Map<string, { data: any; ts: number }>()
const CACHE_TTL = 60 * 60 * 1000  // 1 hour

async function cachedFetch(url: string, opts?: RequestInit) {
  const now = Date.now()
  const hit = cache.get(url)
  if (hit && now - hit.ts < CACHE_TTL) return hit.data
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': 'SentinelDetect/4.0', ...(opts?.headers || {}) } })
  if (!r.ok) throw new Error(`GitHub API ${r.status}`)
  const data = await r.json()
  cache.set(url, { data, ts: now })
  return data
}

// SigmaHQ category → GitHub path + display label
// Verified against SigmaHQ main branch May 2026
const CATEGORIES: Record<string, string> = {
  'windows/process_creation': 'rules/windows/process_creation',
  'windows/registry':         'rules/windows/registry_event',
  'windows/network':          'rules/windows/network_connection',
  'windows/file':             'rules/windows/file_event',
  'windows/powershell':       'rules/windows/powershell',
  'linux/process':            'rules/linux/process_creation',
  'cloud/aws':                'rules/cloud/aws',
  'cloud/azure':              'rules/cloud/azure',
  'network/dns':              'rules/network/dns',
  'web/webserver':            'rules/web/apache',
}

// Fallback paths if primary 404s
const CATEGORY_FALLBACKS: Record<string, string[]> = {
  'windows/registry': ['rules/windows/registry_event','rules/windows/registry_add','rules/windows/registry_set','rules/windows/registry'],
  'linux/process':    ['rules/linux/process_creation','rules/linux/auditd'],
  'web/webserver':    ['rules/web/apache','rules/web/iis','rules/web/webserver','rules/web'],
  'cloud/aws':        ['rules/cloud/aws','rules/cloud/aws/cloudtrail'],
}

const GH_BASE = 'https://api.github.com/repos/SigmaHQ/sigma'

// Minimal YAML parser — extracts key fields from Sigma YAML without full parser
function parseSigmaYaml(yaml: string): Record<string, any> {
  const result: Record<string, any> = {}
  const lines = yaml.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^(\w+):\s*(.+)$/)
    if (!m) continue
    const [, key, val] = m
    if (['title','status','description','author','date','level'].includes(key)) {
      result[key] = val.replace(/^['"]|['"]$/g, '').trim()
    }
    if (key === 'tags') {
      // Collect list items
      const tags: string[] = []
      let j = i + 1
      while (j < lines.length && lines[j].match(/^\s+-\s+/)) {
        tags.push(lines[j].replace(/^\s+-\s+/, '').trim())
        j++
      }
      result.tags = tags
    }
    if (key === 'logsource') {
      const ls: Record<string, string> = {}
      let j = i + 1
      while (j < lines.length && lines[j].match(/^\s+\w+:/)) {
        const lm = lines[j].trim().match(/^(\w+):\s*(.+)$/)
        if (lm) ls[lm[1]] = lm[2].trim()
        j++
      }
      result.logsource = ls
    }
  }
  // Extract MITRE tags
  const mitreTags = (result.tags || []).filter((t: string) => t.startsWith('attack.t'))
  result.mitre_ids = mitreTags.map((t: string) => t.replace('attack.','').toUpperCase())
  return result
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const action   = searchParams.get('action') || 'list'    // list | fetch
  const category = searchParams.get('category') || 'windows/process_creation'
  const file     = searchParams.get('file')                 // for action=fetch
  const search   = searchParams.get('search') || ''

  try {
    if (action === 'list') {
      const primaryPath = CATEGORIES[category] || CATEGORIES['windows/process_creation']
      const fallbacks   = CATEGORY_FALLBACKS[category] || []
      const pathsToTry  = [primaryPath, ...fallbacks.filter(p => p !== primaryPath)]
      
      let items: any = null
      let lastError = ''
      for (const path of pathsToTry) {
        try {
          items = await cachedFetch(`${GH_BASE}/contents/${path}`)
          break  // success
        } catch (e: any) {
          lastError = e.message
          cache.delete(`${GH_BASE}/contents/${path}`)  // clear bad cache entry
          continue
        }
      }
      if (!items) throw new Error(lastError || 'All paths returned 404')

      let rules = (Array.isArray(items) ? items : [])
        .filter((f: any) => f.name?.endsWith('.yml') || f.name?.endsWith('.yaml'))
        .map((f: any) => ({
          name:         f.name,
          path:         f.path,
          download_url: f.download_url,
          sha:          f.sha,
        }))
        .slice(0, 100)

      // Search filter (filename only for performance)
      if (search) {
        const q = search.toLowerCase()
        rules = rules.filter((r: any) => r.name.toLowerCase().includes(q))
      }

      return NextResponse.json({ rules, category, total: rules.length })
    }

    if (action === 'fetch' && file) {
      // YAML files are plain text — must NOT use cachedFetch (which calls .json())
      const now = Date.now()
      const hit = cache.get('raw:' + file)
      let yamlStr: string
      if (hit && now - hit.ts < CACHE_TTL) {
        yamlStr = hit.data as string
      } else {
        const r = await fetch(file, { headers: { 'User-Agent': 'SentinelDetect/4.0' } })
        if (!r.ok) throw new Error(`Failed to fetch rule file: ${r.status}`)
        yamlStr = await r.text()
        cache.set('raw:' + file, { data: yamlStr, ts: now })
      }
      const parsed = parseSigmaYaml(yamlStr)
      return NextResponse.json({ parsed, raw: yamlStr })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (e: any) {
    if (e.message?.includes('403')) {
      return NextResponse.json({ error: 'GitHub API rate limit reached. Try again in a few minutes.', rate_limited: true }, { status: 429 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// POST — import a rule from SigmaHQ into the user's library
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { download_url, platform = 'Microsoft Sentinel (KQL)' } = await req.json()
  if (!download_url) return NextResponse.json({ error: 'download_url required' }, { status: 400 })

  // Fetch YAML
  const r    = await fetch(download_url, { headers: { 'User-Agent': 'SentinelDetect/4.0' } })
  const yaml = await r.text()
  const meta = parseSigmaYaml(yaml)

  const { data: profile } = await supabase.from('profiles')
    .select('active_team_id').eq('id', user.id).maybeSingle()

  // Save as a Sigma rule (platform = Sigma, rule = raw YAML)
  const { data: saved, error } = await supabase.from('rules').insert({
    user_id:         user.id,
    team_id:         profile?.active_team_id ?? null,
    title:           meta.title || 'Imported Sigma Rule',
    mitre_id:        meta.mitre_ids?.[0] || '',
    mitre_name:      '',
    tactic:          '',
    severity:        meta.level === 'critical' ? 'Critical' : meta.level === 'high' ? 'High' : meta.level === 'medium' ? 'Medium' : 'Low',
    data_source:     Object.values(meta.logsource || {}).join(', '),
    platform:        'Sigma',
    rule:            yaml,
    description:     meta.description || '',
    false_positives: [],
    tuning_tips:     [],
    response_steps:  [],
    confidence:      75,
    scenario:        `Imported from SigmaHQ: ${meta.title}`,
    tags:            meta.mitre_ids || [],
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: saved }, { status: 201 })
}
