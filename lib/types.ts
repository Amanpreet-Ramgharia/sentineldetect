export type Severity    = 'Critical' | 'High' | 'Medium' | 'Low'
export type Platform    =
  | 'Microsoft Sentinel (KQL)'
  | 'Microsoft Defender XDR (KQL)'
  | 'Splunk (SPL)'
  | 'Elastic (EQL)'
  | 'AWS CloudWatch Insights'
  | 'Google Chronicle (YARA-L)'
  | 'IBM QRadar (AQL)'
  | 'Wazuh (XML)'
export type Provider    = 'gemini' | 'openai' | 'anthropic' | 'groq'
export type ThreatLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Benign'
export type Theme       = 'cyber' | 'terminal' | 'clean' | 'midnight' | 'rose' | 'ocean'

export interface DetectionRule {
  id?: string
  title: string
  mitre_id: string
  mitre_name: string
  tactic: string
  severity: Severity
  data_source: string
  platform: Platform
  rule: string
  description: string
  false_positives: string[]
  tuning_tips: string[]
  response_steps: string[]
  confidence?: number
  scenario?: string
  note?: string | null
  user_id?: string
  team_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface DbRule {
  id: string
  user_id: string
  team_id: string | null
  title: string
  mitre_id: string
  mitre_name: string
  tactic: string
  severity: Severity
  data_source: string
  platform: Platform
  rule: string
  description: string
  false_positives: string[]
  tuning_tips: string[]
  response_steps: string[]
  confidence: number | null
  scenario: string | null
  note: string | null
  is_favourite: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export interface RuleVersion {
  id: string
  rule_id: string
  rule_data: DbRule
  version: number
  improvements: string[]
  created_at: string
}

export interface LogAnalysis {
  summary: string
  threat_level: ThreatLevel
  threat_level_reason: string
  what_happened: string
  mitre_techniques: { id: string; name: string }[]
  indicators: string[]
  analyst_notes: string
  generate_detection: boolean
  detection_scenario?: string
}

export interface RuleExplanation {
  title: string; summary: string; how_it_works: string
  what_it_catches: string; limitations: string; analogy: string
}

export interface GenerateRequest {
  scenario: string; platform: Platform; focus?: string; provider?: Provider
}

export interface AnalyseRequest {
  log: string; format: string; provider?: Provider
}

export interface Team {
  id: string; name: string; created_by: string
  created_at: string; plan: 'free' | 'pro' | 'enterprise'; role?: string
}

export interface Profile {
  id: string; email: string; full_name: string | null
  avatar_url: string | null; active_team_id: string | null; created_at: string
}
