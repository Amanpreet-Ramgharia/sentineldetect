// app/api/validate/route.ts
// Comprehensive structural validator for Sigma YAML and other SIEM rule formats

import { NextRequest, NextResponse } from 'next/server'
import { createClient }             from '@/lib/supabase/server'

interface ValidationResult {
  valid:       boolean
  score:       number       // 0-100
  errors:      string[]
  warnings:    string[]
  suggestions: string[]
  fields: {
    title: boolean; description: boolean; logsource: boolean
    detection: boolean; condition: boolean; mitre_tags: boolean
    status: boolean; level: boolean
  }
}

function validateSigma(content: string): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  const fields = { title:false, description:false, logsource:false,
                   detection:false, condition:false, mitre_tags:false,
                   status:false, level:false }

  // ── Parse basic YAML structure ───────────────────────────────────────────
  const lines   = content.split('\n')
  const topKeys: Record<string, string> = {}
  for (const line of lines) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/)
    if (m) topKeys[m[1]] = m[2].trim()
  }

  // ── Required fields ──────────────────────────────────────────────────────
  if (!topKeys.title || topKeys.title.length < 5) {
    errors.push('title is required (min 5 chars)')
  } else { fields.title = true }

  if (!topKeys.description || topKeys.description.length < 10) {
    warnings.push('description is missing or too short — required for SigmaHQ submission')
  } else { fields.description = true }

  if (!topKeys.status) {
    warnings.push('status is missing — should be: stable | experimental | test | deprecated')
  } else {
    if (!['stable','experimental','test','deprecated'].includes(topKeys.status)) {
      errors.push(`status "${topKeys.status}" is invalid — use: stable, experimental, test, or deprecated`)
    } else { fields.status = true }
  }

  if (!topKeys.level) {
    warnings.push('level is missing — should be: informational | low | medium | high | critical')
  } else {
    if (!['informational','low','medium','high','critical'].includes(topKeys.level)) {
      errors.push(`level "${topKeys.level}" is invalid — use: informational, low, medium, high, or critical`)
    } else { fields.level = true }
  }

  // ── Logsource block ──────────────────────────────────────────────────────
  const logsourceIdx = lines.findIndex(l => l.match(/^logsource:/))
  if (logsourceIdx === -1) {
    errors.push('logsource block is required')
  } else {
    fields.logsource = true
    const logsourceLines = []
    for (let i = logsourceIdx + 1; i < lines.length; i++) {
      if (lines[i].match(/^\S/) && !lines[i].match(/^\s/)) break
      logsourceLines.push(lines[i].trim())
    }
    const lsStr = logsourceLines.join('\n')
    if (!lsStr.includes('product:') && !lsStr.includes('category:') && !lsStr.includes('service:')) {
      errors.push('logsource must have at least one of: product, category, or service')
      fields.logsource = false
    }
  }

  // ── Detection block ──────────────────────────────────────────────────────
  const detectionIdx = lines.findIndex(l => l.match(/^detection:/))
  if (detectionIdx === -1) {
    errors.push('detection block is required')
  } else {
    fields.detection = true
    // Find selection names and condition
    const detectionLines = []
    for (let i = detectionIdx + 1; i < lines.length; i++) {
      if (lines[i].match(/^\S/) && !lines[i].match(/^\s/)) break
      detectionLines.push(lines[i])
    }
    const selectionNames: string[] = []
    let conditionLine = ''
    for (const dl of detectionLines) {
      const selMatch = dl.match(/^\s+([a-z_][a-z0-9_]*):/i)
      if (selMatch) {
        if (selMatch[1] === 'condition') {
          conditionLine = dl.replace(/^\s+condition:\s*/, '').trim()
          fields.condition = true
        } else if (selMatch[1] !== 'timeframe') {
          selectionNames.push(selMatch[1])
        }
      }
    }

    if (!conditionLine) {
      errors.push('detection.condition is required')
    } else {
      fields.condition = true
      // Check condition references exist
      const condRefs = conditionLine.match(/\b([a-z_][a-z0-9_]*)\b/gi) || []
      const keywords = ['and','or','not','all','of','them','1','count','near','within']
      for (const ref of condRefs) {
        if (!keywords.includes(ref.toLowerCase()) && !/^\d+$/.test(ref)) {
          if (!selectionNames.includes(ref)) {
            errors.push(`condition references "${ref}" which is not defined in detection selections`)
          }
        }
      }
    }

    if (selectionNames.length === 0 && !conditionLine.includes('filter')) {
      errors.push('detection must have at least one selection block')
      fields.detection = false
    }

    // Warn on overly broad selections
    const fullContent = content.toLowerCase()
    if (fullContent.includes('*|contains|all:') || fullContent.includes("'*'")) {
      warnings.push('Wildcard-only matches may cause excessive false positives — add more specific conditions')
    }
  }

  // ── Tags / MITRE mapping ─────────────────────────────────────────────────
  const tagsIdx = lines.findIndex(l => l.match(/^tags:/))
  if (tagsIdx === -1) {
    suggestions.push('Add MITRE ATT&CK tags (e.g. attack.t1059.001, attack.execution) to improve searchability')
  } else {
    const tagLines = []
    for (let i = tagsIdx + 1; i < lines.length; i++) {
      if (!lines[i].match(/^\s+-/)) break
      tagLines.push(lines[i].replace(/^\s+-\s*/, '').trim())
    }
    const mitreT = tagLines.filter(t => t.startsWith('attack.t'))
    const mitreTA = tagLines.filter(t => t.startsWith('attack.') && !t.startsWith('attack.t'))
    if (mitreT.length > 0) fields.mitre_tags = true
    if (mitreT.length === 0 && mitreTA.length > 0) {
      suggestions.push('Add technique-level tags (attack.tXXXX) in addition to tactic tags')
    }
    // Validate tag format
    for (const tag of tagLines) {
      if (tag.startsWith('attack.t') && !tag.match(/^attack\.[t][0-9]{4}(\.[0-9]{3})?$/i)) {
        warnings.push(`Tag "${tag}" may have incorrect format — expected attack.TXXXX or attack.TXXXX.XXX`)
      }
    }
  }

  // ── Quality suggestions ──────────────────────────────────────────────────
  if (!topKeys.author)   suggestions.push('Add an author field to credit the rule creator')
  if (!topKeys.date)     suggestions.push('Add a date field (YYYY-MM-DD format)')
  if (!topKeys.modified) suggestions.push('Add a modified field when updating existing rules')

  const falsePositivesIdx = lines.findIndex(l => l.match(/^falsepositives:/))
  if (falsePositivesIdx === -1) {
    suggestions.push('Add a falsepositives section to document known benign triggers')
  }

  if (topKeys.title && topKeys.title.length > 80) {
    warnings.push('Title is very long (>80 chars) — consider shortening for readability in SIEM alert names')
  }

  // ── Score calculation ────────────────────────────────────────────────────
  const fieldCount = Object.values(fields).filter(Boolean).length
  const maxFields  = Object.keys(fields).length
  const fieldScore = Math.round((fieldCount / maxFields) * 60)  // 60 pts for fields
  const errorPenalty = errors.length * 15
  const warnPenalty  = warnings.length * 5
  const suggBonus    = Math.max(0, 15 - suggestions.length * 3)  // bonus for fewer gaps

  let score = Math.max(0, Math.min(100, fieldScore + suggBonus + 25 - errorPenalty - warnPenalty))
  if (errors.length > 0) score = Math.min(score, 60)  // cap at 60 if errors exist

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
    suggestions,
    fields,
  }
}

function validateKQL(rule: string): ValidationResult {
  const errors:   string[] = []
  const warnings: string[] = []
  const suggestions: string[] = []
  const fields = { title:true, description:true, logsource:true,
                   detection:rule.length > 10, condition:true,
                   mitre_tags:false, status:true, level:true }

  const upper = rule.toUpperCase()

  // Check for time filter
  if (!rule.includes('ago(') && !rule.includes('between(') && !rule.includes('TimeGenerated')) {
    warnings.push('No time filter detected — add a time bound (e.g. | where TimeGenerated > ago(1h)) to prevent full-table scans')
  }

  // Check for common syntax issues
  const brackets = (rule.match(/\(/g)||[]).length - (rule.match(/\)/g)||[]).length
  if (brackets !== 0) errors.push(`Unbalanced parentheses (${brackets > 0 ? 'missing' : 'extra'} closing bracket)`)

  const pipes = rule.split('|').length - 1
  if (pipes > 10) warnings.push(`${pipes} pipe operators — highly complex query may be slow in production`)

  // Expensive operations
  if (upper.includes('JOIN') && !upper.includes('LOOKUPJOIN')) warnings.push('join operations can be expensive — consider lookup tables where possible')
  if (upper.includes('MV-EXPAND')) suggestions.push('mv-expand can multiply rows significantly — ensure it is bounded by an earlier filter')
  if (upper.includes('UNION *')) warnings.push('union * queries all tables — specify the target table for better performance')

  // Missing table
  if (!rule.match(/^[A-Z][a-zA-Z]+(\s|\n|\|)/)) {
    warnings.push('Query does not start with a table name — KQL queries should begin with the source table')
  }

  const score = errors.length > 0 ? Math.max(30, 80 - errors.length * 20 - warnings.length * 5)
              : Math.max(60, 100 - warnings.length * 8 - suggestions.length * 3)

  return { valid: errors.length === 0, score, errors, warnings, suggestions, fields }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rule, platform } = await req.json()
  if (!rule) return NextResponse.json({ error: 'rule required' }, { status: 400 })

  let result: ValidationResult

  if (platform === 'Sigma' || rule.trim().startsWith('title:')) {
    result = validateSigma(rule)
  } else if (platform?.includes('KQL') || platform?.includes('Sentinel') || platform?.includes('Defender')) {
    result = validateKQL(rule)
  } else {
    // Generic validation for other platforms
    result = {
      valid:   rule.length > 10,
      score:   rule.length > 100 ? 70 : 50,
      errors:  rule.length < 10 ? ['Rule content is too short'] : [],
      warnings:  [],
      suggestions: ['Consider platform-specific validation for deeper analysis'],
      fields:  { title:true, description:true, logsource:true, detection:true,
                 condition:true, mitre_tags:false, status:true, level:true },
    }
  }

  return NextResponse.json(result)
}
