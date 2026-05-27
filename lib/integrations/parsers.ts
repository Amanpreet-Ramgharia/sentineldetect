// lib/integrations/parsers.ts
// Auto-detect SIEM source and normalise payload to clean text before AI triage.
// This dramatically improves AI accuracy — it sees structured English instead of raw JSON.

export type SIEMSource =
  | 'splunk' | 'sentinel' | 'elastic' | 'datadog' | 'wazuh' | 'crowdstrike' | 'generic'

export function detectSource(payload: Record<string, unknown>): SIEMSource {
  // Microsoft Sentinel
  if (payload.WorkspaceId || payload.AlertName || payload.SystemAlertId) return 'sentinel'
  if (payload.properties && (payload.properties as any).alertDisplayName)  return 'sentinel'

  // Splunk (alert webhook or HEC)
  if (payload.search_name || (payload.result && payload.results_link)) return 'splunk'
  if (payload.app && payload.owner && payload.results_file)             return 'splunk'

  // Elastic Security
  if ((payload.signal && (payload.signal as any).rule)) return 'elastic'
  if (payload['kibana.alert.rule.name'])                 return 'elastic'
  if (payload._source && (payload._source as any)['kibana.alert.rule']) return 'elastic'

  // Datadog
  if (payload.event_type && payload.url && (payload.title || payload.body)) return 'datadog'

  // Wazuh
  if (payload.rule && (payload.rule as any).description &&
      payload.agent && (payload.agent as any).name) return 'wazuh'

  // CrowdStrike Falcon
  if (payload.DetectId || payload.Tactic || payload.FalconHostLink) return 'crowdstrike'

  return 'generic'
}

export function normalizePayload(
  payload: Record<string, unknown>,
  source: SIEMSource
): string {
  try {
    switch (source) {
      case 'splunk':      return normalizeSplunk(payload)
      case 'sentinel':    return normalizeSentinel(payload)
      case 'elastic':     return normalizeElastic(payload)
      case 'datadog':     return normalizeDatadog(payload)
      case 'wazuh':       return normalizeWazuh(payload)
      case 'crowdstrike': return normalizeCrowdStrike(payload)
      default:            return JSON.stringify(payload, null, 2)
    }
  } catch {
    return JSON.stringify(payload, null, 2)
  }
}

function normalizeSplunk(p: any): string {
  const r = p.result || p
  return lines([
    'SIEM: Splunk',
    p.search_name   && `Alert name: ${p.search_name}`,
    r.host          && `Host: ${r.host}`,
    r.source        && `Source: ${r.source}`,
    r.sourcetype    && `Sourcetype: ${r.sourcetype}`,
    r.user          && `User: ${r.user}`,
    r.src_ip        && `Source IP: ${r.src_ip}`,
    r.dest_ip       && `Dest IP: ${r.dest_ip}`,
    r.dest          && `Dest: ${r.dest}`,
    r.EventCode     && `Event code: ${r.EventCode}`,
    r.EventID       && `Event ID: ${r.EventID}`,
    r.CommandLine   && `Command: ${r.CommandLine}`,
    r.ParentProcess && `Parent process: ${r.ParentProcess}`,
    (r.Message || r._raw) && `Event: ${String(r.Message || r._raw).slice(0, 800)}`,
    p.results_link  && `Results: ${p.results_link}`,
  ])
}

function normalizeSentinel(p: any): string {
  const props = p.properties || p
  const ents  = props.entities || props.Entities
  return lines([
    'SIEM: Microsoft Sentinel',
    (props.alertDisplayName || props.AlertName) &&
      `Alert: ${props.alertDisplayName || props.AlertName}`,
    props.severity          && `Severity: ${props.severity}`,
    props.description        && `Description: ${props.description}`,
    props.compromisedEntity  && `Compromised entity: ${props.compromisedEntity}`,
    ents                     && `Entities: ${JSON.stringify(ents).slice(0, 400)}`,
    props.tactics            && `Tactics: ${Array.isArray(props.tactics) ? props.tactics.join(', ') : props.tactics}`,
    props.techniques         && `Techniques: ${Array.isArray(props.techniques) ? props.techniques.join(', ') : props.techniques}`,
    props.remediationSteps   && `Remediation: ${props.remediationSteps}`,
    props.extendedProperties && `Details: ${JSON.stringify(props.extendedProperties).slice(0, 400)}`,
  ])
}

function normalizeElastic(p: any): string {
  const signal = p.signal || {}
  const rule   = signal.rule || p['kibana.alert.rule'] || {}
  const src    = p._source || p
  const threat = rule.threat || []
  const mitre  = threat.flatMap((t: any) =>
    (t.technique || []).map((tech: any) => `${tech.id} ${tech.name}`)
  )
  return lines([
    'SIEM: Elastic Security',
    rule.name           && `Rule: ${rule.name}`,
    rule.description    && `Description: ${rule.description}`,
    rule.severity       && `Severity: ${rule.severity}`,
    mitre.length > 0    && `MITRE: ${mitre.join(', ')}`,
    src['source.ip']    && `Source IP: ${src['source.ip']}`,
    src['destination.ip'] && `Dest IP: ${src['destination.ip']}`,
    src['user.name']    && `User: ${src['user.name']}`,
    src['host.name']    && `Host: ${src['host.name']}`,
    src['event.action'] && `Action: ${src['event.action']}`,
    src['process.name'] && `Process: ${src['process.name']}`,
    src['process.command_line'] && `Command: ${src['process.command_line']}`,
    src.message         && `Message: ${String(src.message).slice(0, 500)}`,
  ])
}

function normalizeDatadog(p: any): string {
  return lines([
    'SIEM: Datadog',
    p.title       && `Alert: ${p.title}`,
    p.body        && `Body: ${String(p.body).slice(0, 500)}`,
    p.priority    && `Priority: ${p.priority}`,
    p.alert_type  && `Type: ${p.alert_type}`,
    p.tags        && `Tags: ${Array.isArray(p.tags) ? p.tags.join(', ') : p.tags}`,
    p.host        && `Host: ${p.host}`,
    p.url         && `URL: ${p.url}`,
  ])
}

function normalizeWazuh(p: any): string {
  const rule  = p.rule  || {}
  const agent = p.agent || {}
  const data  = p.data  || {}
  return lines([
    'SIEM: Wazuh',
    rule.description    && `Rule: ${rule.description}`,
    rule.id             && `Rule ID: ${rule.id}`,
    rule.level          && `Level: ${rule.level}/15`,
    rule.groups         && `Groups: ${(rule.groups || []).join(', ')}`,
    agent.name          && `Agent: ${agent.name} (${agent.ip || 'IP unknown'})`,
    p.manager?.name     && `Manager: ${p.manager.name}`,
    data.srcip          && `Source IP: ${data.srcip}`,
    data.dstip          && `Dest IP: ${data.dstip}`,
    data.dstuser        && `Target user: ${data.dstuser}`,
    data.srcuser        && `Source user: ${data.srcuser}`,
    data.command        && `Command: ${data.command}`,
    p.full_log          && `Log: ${String(p.full_log).slice(0, 600)}`,
  ])
}

function normalizeCrowdStrike(p: any): string {
  return lines([
    'SIEM: CrowdStrike Falcon',
    p.DetectDescription && `Detection: ${p.DetectDescription}`,
    p.Severity          && `Severity: ${p.Severity}`,
    p.Tactic            && `Tactic: ${p.Tactic}`,
    p.Technique         && `Technique: ${p.Technique}`,
    p.ComputerName      && `Host: ${p.ComputerName}`,
    p.UserName          && `User: ${p.UserName}`,
    p.FileName          && `File: ${p.FileName}`,
    p.FilePath          && `Path: ${p.FilePath}`,
    p.CommandLine       && `Command: ${p.CommandLine}`,
    p.ParentImageFileName && `Parent: ${p.ParentImageFileName}`,
    p.FalconHostLink    && `Link: ${p.FalconHostLink}`,
  ])
}

function lines(parts: (string | false | undefined | null)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join('\n')
}
