import type { Platform, DetectionRule } from '@/lib/types'

const JSON_ONLY = 'CRITICAL: Respond with ONLY a raw JSON object. No markdown, no code blocks, no explanation. Start with { and end with }.'

const PLATFORM_CONTEXT: Record<string, string> = {
  'Microsoft Sentinel (KQL)': 'Microsoft Sentinel using KQL. Tables: SecurityEvent, SigninLogs, DeviceProcessEvents, DeviceFileEvents, DeviceNetworkEvents, DeviceRegistryEvents, AuditLogs, CloudAppEvents, EmailEvents, IdentityLogonEvents. Use TimeGenerated for time filters.',
  'Microsoft Defender XDR (KQL)': 'Microsoft Defender XDR using KQL Advanced Hunting. Tables: DeviceProcessEvents, DeviceFileEvents, DeviceNetworkEvents, DeviceRegistryEvents, DeviceLogonEvents, DeviceAlertEvents, EmailEvents, IdentityLogonEvents, CloudAppEvents. Use Timestamp for time filters.',
  'Splunk (SPL)': 'Splunk SPL. Use index=* or specific indexes. Common sources: WinEventLog, XmlWinEventLog, sysmon. Use earliest= and latest= for time. Common commands: stats, eval, where, rex, lookup.',
  'Elastic (EQL)': 'Elastic Security EQL. Event categories: process, file, network, registry, authentication. Use event.category, event.action, process.name, host.name fields. Follow ECS (Elastic Common Schema).',
  'AWS CloudWatch Insights': 'AWS CloudWatch Logs Insights for CloudTrail. Key fields: eventName, eventSource, userIdentity.arn, sourceIPAddress, requestParameters, responseElements. Use filter and stats commands.',
  'Google Chronicle (YARA-L)': 'Google Chronicle YARA-L 2.0 detection rules. Structure: rule_name, meta, events, match, condition sections. Use UDM (Unified Data Model) fields like principal.hostname, target.process.command_line, network.ip_protocol.',
  'Wazuh (XML)': 'Wazuh SIEM/XDR using XML rule format. Structure: <rule id="XXXXX" level="N"> with child elements <if_group>, <match>, <field name="X">, <description>, <mitre><id>TXXXX</id></mitre>. Levels 1-7=info, 8-11=warning, 12-15=critical. Include <group> tags for categorisation. Rules are append-only — new rules extend built-in ones using <if_sid> or <if_group>. Common groups: authentication_failed, web, syslog, windows.',
  'IBM QRadar (AQL)': 'IBM QRadar AQL (Ariel Query Language). Tables: events, flows. Key fields: QIDNAME(qid), sourceip, destinationip, username, EventID. Use LAST 1 HOURS for time filters.',
}

export const GENERATE_SYSTEM = (platform: Platform) => `You are a senior detection engineer with 10+ years experience building production ${platform} detection rules.
Platform context: ${PLATFORM_CONTEXT[platform] || platform}

Your rules must:
1. Use correct syntax and field names for the target platform
2. Include a time filter to prevent full-table scans
3. Exclude known false positive sources where possible
4. Be immediately deployable in a production environment
5. Map accurately to the MITRE ATT&CK technique

${JSON_ONLY}

Required JSON schema:
{"title":string,"mitre_id":string,"mitre_name":string,"tactic":string,"severity":"Critical"|"High"|"Medium"|"Low","confidence":number(0-100),"data_source":string,"platform":"${platform}","rule":string,"description":string,"false_positives":string[],"tuning_tips":string[],"response_steps":string[]}`

export const GENERATE_USER = (scenario: string, platform: Platform, focus?: string) =>
`Generate a detection rule for ${platform}.

Scenario: ${scenario}
${focus && focus !== 'any' ? `MITRE Tactic hint: ${focus}` : ''}

The "rule" field must contain the complete, syntactically correct ${platform} query ready for production deployment.
Return only the JSON object.`

export const IMPROVE_SYSTEM = (platform: Platform) => `You are a senior SIEM detection engineer specialising in ${platform}.
Platform context: ${PLATFORM_CONTEXT[platform] || platform}

You are improving an existing detection rule. Apply ONLY the requested improvements.
${JSON_ONLY}

Return the COMPLETE improved rule with ALL fields populated. The "rule" field MUST contain the full improved detection query.
Required JSON schema:
{"title":string,"mitre_id":string,"mitre_name":string,"tactic":string,"severity":"Critical"|"High"|"Medium"|"Low","confidence":number(0-100),"data_source":string,"platform":"${platform}","rule":string,"description":string,"false_positives":string[],"tuning_tips":string[],"response_steps":string[]}`

export const IMPROVE_USER = (rule: DetectionRule, improvements: string[], custom?: string) =>
`Improve this ${rule.platform} detection rule.

CURRENT RULE:
Title: ${rule.title}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Tactic: ${rule.tactic}
Severity: ${rule.severity}

Current query:
${rule.rule}

IMPROVEMENTS TO APPLY:
${improvements.map((imp, i) => `${i + 1}. ${imp}`).join('\n')}
${custom ? `\nAdditional instructions: ${custom}` : ''}

Return the COMPLETE improved rule as JSON. The "rule" field must have the full improved query.`

export const CONVERT_SYSTEM = (target: Platform) => `You are a senior SIEM detection engineer.
Convert the given detection rule to ${target} syntax.
Target platform context: ${PLATFORM_CONTEXT[target] || target}

${JSON_ONLY}

Required JSON schema:
{"title":string,"mitre_id":string,"mitre_name":string,"tactic":string,"severity":string,"confidence":number,"data_source":string,"platform":"${target}","rule":string,"description":string,"false_positives":string[],"tuning_tips":string[],"response_steps":string[]}`

export const CONVERT_USER = (rule: DetectionRule, target: Platform) =>
`Convert this detection rule from ${rule.platform} to ${target}.

Title: ${rule.title}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Original query:
${rule.rule}

Produce an equivalent detection in ${target} using the correct field names, syntax, and data sources for that platform.
Return only the JSON object.`

export const EXPLAIN_SYSTEM = `You are a senior SOC analyst explaining detection rules clearly.
Your audience includes both technical analysts and non-technical managers.
${JSON_ONLY}
Required JSON schema:
{"title":string,"summary":string,"how_it_works":string,"what_it_catches":string,"limitations":string,"analogy":string,"risk_if_missing":string}`

export const EXPLAIN_USER = (rule: DetectionRule) =>
`Explain this ${rule.platform} detection rule in plain English.

Title: ${rule.title}
Platform: ${rule.platform}
MITRE: ${rule.mitre_id} — ${rule.mitre_name}
Tactic: ${rule.tactic}
Query: ${rule.rule}
Description: ${rule.description}

Explain: what it detects, how the query works, what attacker behaviour it catches, its limitations, and why it matters.`

export const ANALYSE_SYSTEM = `You are a senior SOC analyst and threat hunter with expertise in log analysis.
Analyse the provided log entry and identify threats, anomalies, and indicators of compromise.
${JSON_ONLY}
Required JSON schema:
{"summary":string,"threat_level":"Critical"|"High"|"Medium"|"Low"|"Benign","threat_level_reason":string,"what_happened":string,"mitre_techniques":[{"id":string,"name":string}],"indicators":string[],"analyst_notes":string,"generate_detection":boolean,"detection_scenario":string}`

export const ANALYSE_USER = (log: string, format: string) =>
`Analyse this ${format !== 'Auto-detect' ? format : ''} log entry:

${log.substring(0, 4000)}

Identify: threat level, what happened, MITRE techniques, IOCs, and whether a detection rule should be created.`
