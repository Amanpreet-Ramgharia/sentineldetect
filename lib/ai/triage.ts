// lib/ai/triage.ts
// AI prompts and types for SOC alert triage

export interface TriageResult {
  title: string
  severity: 'Critical' | 'High' | 'Medium' | 'Low'
  severity_score: number
  summary: string
  mitre_technique: string
  mitre_tactic: string
  mitre_name: string
  source_system: string
  iocs: string[]
  investigation_steps: string[]
  response_actions: string[]
  is_false_positive: boolean
  false_positive_reason: string
  escalate: boolean
  escalation_reason: string
}

export const TRIAGE_SYSTEM = `You are an expert SOC (Security Operations Center) analyst with 10+ years of incident response experience. Triage security alerts rapidly and accurately.

Rules:
- Accuracy over completeness — get severity right above all else
- Steps must be specific and immediately executable, not vague
- Map to MITRE ATT&CK only when confident; leave blank if uncertain
- Many alerts are false positives — flag them clearly with reasoning
- IOCs must be prefixed: ip:1.2.3.4  domain:evil.com  hash:abc123  user:jdoe  file:malware.exe

Respond with valid JSON only. No markdown, no text outside the JSON object.`

export const TRIAGE_USER = (alertText: string) => `Triage this security alert:

---
${alertText.slice(0, 8000)}
---

Return this exact JSON structure:
{
  "title": "Concise descriptive title, max 80 chars",
  "severity": "Critical|High|Medium|Low",
  "severity_score": <integer 1-10, 10 = most critical>,
  "summary": "2-3 sentences: what happened, who/what is affected, why it matters",
  "mitre_technique": "T1234 if confident, empty string if not",
  "mitre_tactic": "tactic name if confident, empty string if not",
  "mitre_name": "technique name if confident, empty string if not",
  "source_system": "detected product/SIEM name or empty string",
  "iocs": ["prefixed IOC strings"],
  "investigation_steps": [
    "Step 1 — specific executable action",
    "Step 2 — specific executable action",
    "Step 3 — specific executable action"
  ],
  "response_actions": [
    "Immediate containment/response action 1",
    "Immediate containment/response action 2"
  ],
  "is_false_positive": false,
  "false_positive_reason": "explain if true, empty string if false",
  "escalate": false,
  "escalation_reason": "explain if true, empty string if false"
}`
