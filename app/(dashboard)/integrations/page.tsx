'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Integration {
  id: string; name: string; description: string; type: string
  fields?: { key: string; label: string; placeholder: string; type: string }[]
}

const INTEGRATIONS: Integration[] = [
  {
    id: 'sentinel', name: 'Microsoft Sentinel',
    description: 'Deploy rules directly to Sentinel via Azure REST API. Requires a service principal with Sentinel Contributor role.',
    type: 'push',
    fields: [
      { key:'subscription_id', label:'Subscription ID',  placeholder:'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx', type:'text' },
      { key:'resource_group',  label:'Resource Group',   placeholder:'my-resource-group',                    type:'text' },
      { key:'workspace_name',  label:'Workspace Name',   placeholder:'my-sentinel-workspace',                type:'text' },
      { key:'client_id',       label:'Client ID',        placeholder:'App registration client ID',           type:'text' },
      { key:'client_secret',   label:'Client Secret',    placeholder:'App registration client secret',       type:'password' },
      { key:'tenant_id',       label:'Tenant ID',        placeholder:'Azure AD tenant ID',                   type:'text' },
    ],
  },
  {
    id: 'splunk', name: 'Splunk',
    description: 'Deploy saved searches to Splunk Enterprise or Cloud via REST API. Requires admin or power user role.',
    type: 'push',
    fields: [
      { key:'host',  label:'Splunk Host', placeholder:'https://splunk.company.com:8089', type:'text' },
      { key:'token', label:'API Token',   placeholder:'Splunk HEC or session token',     type:'password' },
      { key:'app',   label:'App Context', placeholder:'search',                          type:'text' },
    ],
  },
  {
    id: 'elastic', name: 'Elastic SIEM',
    description: 'Create detection rules in Elastic Security via the Detection Engine API.',
    type: 'push',
    fields: [
      { key:'url',     label:'Kibana URL', placeholder:'https://your-deployment.kb.us-east-1.aws.elastic-cloud.com', type:'text' },
      { key:'api_key', label:'API Key',    placeholder:'base64 encoded API key',    type:'password' },
      { key:'space',   label:'Space ID',   placeholder:'default',                   type:'text' },
    ],
  },
]

const SIEM_WEBHOOKS = [
  {
    id: 'splunk-wh', name: 'Splunk → SentinelDetect',
    description: 'Configure a Splunk alert action to POST to your triage webhook when a saved search fires.',
    code: (url: string) => `# In Splunk: Alert → Add Action → Webhook
# URL: ${url}
# Method: POST
# Content-Type: application/json
#
# Payload (use Splunk token substitution):
{
  "search_name": "$name$",
  "result": {
    "host": "$result.host$",
    "source": "$result.source$",
    "sourcetype": "$result.sourcetype$",
    "user": "$result.user$",
    "src_ip": "$result.src_ip$",
    "_raw": "$result._raw$"
  },
  "results_link": "$results_link$"
}`,
  },
  {
    id: 'sentinel-wh', name: 'Microsoft Sentinel → SentinelDetect',
    description: 'Use a Logic App to forward Sentinel incidents to your triage webhook.',
    code: (url: string) => `# Create a Logic App triggered by "Microsoft Sentinel Incident"
# Add an HTTP action:

POST ${url}
Content-Type: application/json
Authorization: Bearer sd_YOUR_API_KEY

{
  "WorkspaceId": "@{triggerBody()?['WorkspaceId']}",
  "AlertName": "@{triggerBody()?['properties']?['title']}",
  "severity": "@{triggerBody()?['properties']?['severity']}",
  "description": "@{triggerBody()?['properties']?['description']}",
  "entities": "@{triggerBody()?['properties']?['relatedEntities']}"
}`,
  },
  {
    id: 'elastic-wh', name: 'Elastic → SentinelDetect',
    description: 'Use Elastic Alerting to POST detections to your triage webhook.',
    code: (url: string) => `# In Kibana: Stack Management → Rules → Create Rule
# Action: Webhook connector → POST

POST ${url}
Content-Type: application/json
Authorization: Bearer sd_YOUR_API_KEY

{
  "signal": {
    "rule": {
      "name": "{{rule.name}}",
      "description": "{{rule.description}}",
      "severity": "{{rule.severity}}"
    }
  },
  "host": {"name": "{{host.name}}"},
  "user": {"name": "{{user.name}}"},
  "message": "{{message}}"
}`,
  },
  {
    id: 'wazuh-wh', name: 'Wazuh → SentinelDetect',
    description: 'Configure a Wazuh active response or integration to POST alerts.',
    code: (url: string) => `# In /var/ossec/etc/ossec.conf add:
<integration>
  <name>custom-webhook</name>
  <hook_url>${url}</hook_url>
  <level>10</level>
  <alert_format>json</alert_format>
</integration>

# Wazuh automatically formats the JSON payload.
# Add your API key header via a wrapper script if needed.`,
  },
  {
    id: 'datadog-wh', name: 'Datadog → SentinelDetect',
    description: 'Use Datadog Webhooks integration to forward security signals.',
    code: (url: string) => `# Datadog → Integrations → Webhooks → New Webhook
# URL: ${url}
# Headers:
#   Authorization: Bearer sd_YOUR_API_KEY
#   Content-Type: application/json
#
# Payload:
{
  "event_type": "$EVENT_TYPE",
  "title": "$EVENT_TITLE",
  "body": "$TEXT_ONLY_MSG",
  "priority": "$PRIORITY",
  "alert_type": "$ALERT_TYPE",
  "tags": "$TAGS",
  "url": "$LINK",
  "host": "$HOSTNAME"
}`,
  },
]

function CurlBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginTop:'.75rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'.35rem' }}>
        <span style={{ fontSize:'.7rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--muted)' }}>{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          style={{ fontSize:'.68rem', padding:'.18rem .55rem', borderRadius:5, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', cursor:'pointer', fontFamily:'inherit' }}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre style={{ background:'var(--code-bg)', padding:'.85rem 1rem', borderRadius:8, fontFamily:'monospace', fontSize:'.72rem', color:'var(--code-text)', overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-word', margin:0 }}>{code}</pre>
    </div>
  )
}

export default function IntegrationsPage() {
  const [open,     setOpen]     = useState<string|null>('splunk-wh')
  const [values,   setValues]   = useState<Record<string, Record<string, string>>>({})
  const [apiKey,   setApiKey]   = useState('sd_YOUR_API_KEY')

  useEffect(() => {
    // Try to load a real API key to pre-fill examples
    createClient().auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const sb = createClient()
      const { data } = await sb.from('sd_api_keys').select('key_prefix').eq('user_id', user.id).maybeSingle()
      if (data?.key_prefix) setApiKey(`${data.key_prefix}...`)
    })
  }, [])

  const webhookBase = 'https://smartswingalerts.com/api/triage'

  function set(id: string, key: string, val: string) {
    setValues(prev => ({ ...prev, [id]: { ...(prev[id]||{}), [key]: val } }))
  }
  function get(id: string, key: string) { return values[id]?.[key] || '' }

  function sentinelCurl() {
    const v = values['sentinel'] || {}
    return `# Step 1: Get access token
TOKEN=$(curl -s -X POST \\
  "https://login.microsoftonline.com/${v.tenant_id||'TENANT_ID'}/oauth2/v2.0/token" \\
  -d "client_id=${v.client_id||'CLIENT_ID'}&client_secret=${v.client_secret||'CLIENT_SECRET'}&grant_type=client_credentials&scope=https://management.azure.com/.default" \\
  | jq -r .access_token)

# Step 2: Create alert rule
curl -X PUT \\
  "https://management.azure.com/subscriptions/${v.subscription_id||'SUB_ID'}/resourceGroups/${v.resource_group||'RG'}/providers/Microsoft.OperationalInsights/workspaces/${v.workspace_name||'WORKSPACE'}/providers/Microsoft.SecurityInsights/alertRules/RULE_ID?api-version=2022-11-01-preview" \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"kind":"Scheduled","properties":{"displayName":"RULE_TITLE","severity":"High","enabled":true,"query":"YOUR_KQL_QUERY","queryFrequency":"PT1H","queryPeriod":"PT1H","triggerOperator":"GreaterThan","triggerThreshold":0}}'`
  }
  function splunkCurl() {
    const v = values['splunk'] || {}
    return `curl -k -X POST \\
  "${v.host||'https://splunk.company.com:8089'}/servicesNS/admin/${v.app||'search'}/saved/searches" \\
  -H "Authorization: Bearer ${v.token||'YOUR_TOKEN'}" \\
  -d "name=SentinelDetect-RuleName" \\
  -d "search=YOUR_SPL_QUERY" \\
  -d "cron_schedule=*/15 * * * *" \\
  -d "is_scheduled=1"`
  }
  function elasticCurl() {
    const v = values['elastic'] || {}
    return `curl -X POST \\
  "${v.url||'https://your-kibana.com'}/s/${v.space||'default'}/api/detection_engine/rules" \\
  -H "Authorization: ApiKey ${v.api_key||'YOUR_API_KEY'}" \\
  -H "Content-Type: application/json" -H "kbn-xsrf: true" \\
  -d '{"name":"RULE_TITLE","type":"eql","language":"eql","query":"YOUR_EQL_QUERY","enabled":true,"severity":"high","risk_score":75}'`
  }

  const curlFns: Record<string, () => string> = {
    sentinel: sentinelCurl, splunk: splunkCurl, elastic: elasticCurl,
  }

  const inp: React.CSSProperties = { flex:1, width:'100%', background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.8rem', outline:'none', fontFamily:'inherit', marginTop:'.28rem' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.25rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Integrations</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>
          Connect SentinelDetect to your SIEM — both for pushing rules out and pulling alerts in for SOC triage.
        </p>
      </div>

      {/* ── SOC Alert Ingestion ───────────────────────────────────────────── */}
      <div style={{ marginBottom:'1.5rem' }}>
        <div style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', marginBottom:'.65rem' }}>
          SOC — Alert Ingestion
        </div>
        <div style={{ background:'var(--bg4)', border:'1px solid rgba(249,115,22,.25)', borderRadius:12, padding:'1rem 1.1rem', marginBottom:'1rem' }}>
          <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)', marginBottom:'.35rem' }}>Your triage webhook URL</div>
          <div style={{ fontSize:'.78rem', color:'var(--muted)', marginBottom:'.65rem' }}>
            POST any alert JSON to this endpoint with your API key. SentinelDetect auto-detects
            Splunk, Sentinel, Elastic, Datadog, and Wazuh payloads — no transformation needed.
          </div>
          <code style={{ display:'block', fontFamily:'monospace', fontSize:'.78rem', background:'var(--bg)', padding:'.65rem .9rem', borderRadius:8, border:'1px solid var(--border)', color:'var(--text)', marginBottom:'.65rem', wordBreak:'break-all' }}>
            POST {webhookBase}
            {'\n'}Authorization: Bearer {apiKey}
          </code>
          <div style={{ fontSize:'.72rem', color:'var(--muted2)' }}>
            Get your API key from{' '}
            <a href="/api-docs" style={{ color:'#f97316', textDecoration:'none' }}>API Access →</a>
            {' '}Keys start with <code style={{ fontFamily:'monospace', fontSize:'.7rem' }}>sd_</code>
          </div>
        </div>

        {/* SIEM webhook setup examples */}
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {SIEM_WEBHOOKS.map(wh => (
            <div key={wh.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <button onClick={() => setOpen(open === wh.id ? null : wh.id)}
                style={{ width:'100%', padding:'.85rem 1.1rem', background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:'inherit' }}>
                <div>
                  <div style={{ fontSize:'.85rem', fontWeight:600, color:'var(--text)' }}>{wh.name}</div>
                  <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem' }}>{wh.description}</div>
                </div>
                <span style={{ color:'var(--muted)', fontSize:'.8rem', flexShrink:0, marginLeft:'1rem' }}>
                  {open === wh.id ? 'Collapse' : 'Show setup'}
                </span>
              </button>
              {open === wh.id && (
                <div style={{ padding:'0 1.1rem 1rem', borderTop:'1px solid var(--border)' }}>
                  <CurlBlock title="Configuration" code={wh.code(webhookBase)} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Rule Deployment ───────────────────────────────────────────────── */}
      <div style={{ fontSize:'.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--muted2)', marginBottom:'.65rem' }}>
        Rule Deployment
      </div>
      <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
        {INTEGRATIONS.map(intg => (
          <div key={intg.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <button onClick={() => setOpen(open === intg.id ? null : intg.id)}
              style={{ width:'100%', padding:'.9rem 1.1rem', background:'none', border:'none', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', justifyContent:'space-between', fontFamily:'inherit' }}>
              <div>
                <div style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>{intg.name}</div>
                <div style={{ fontSize:'.75rem', color:'var(--muted)', marginTop:'.2rem' }}>{intg.description}</div>
              </div>
              <span style={{ color:'var(--muted)', fontSize:'.8rem', flexShrink:0, marginLeft:'1rem' }}>{open === intg.id ? 'Collapse' : 'Configure'}</span>
            </button>
            {open === intg.id && (
              <div style={{ padding:'1rem 1.1rem', borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'.75rem', marginBottom:'.75rem' }}>
                  {(intg.fields||[]).map(f => (
                    <div key={f.key}>
                      <label style={{ fontSize:'.72rem', color:'var(--muted)', fontWeight:500 }}>{f.label}</label>
                      <input type={f.type} value={get(intg.id, f.key)} onChange={e => set(intg.id, f.key, e.target.value)}
                        placeholder={f.placeholder} style={inp}
                        onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                        onBlur={e => e.target.style.borderColor='var(--border2)'}/>
                    </div>
                  ))}
                </div>
                <CurlBlock title="Generated API command — copy, update rule content, run in terminal" code={curlFns[intg.id]()} />
                <div style={{ marginTop:'.75rem', padding:'.65rem .9rem', background:'rgba(249,115,22,.05)', border:'1px solid rgba(249,115,22,.15)', borderRadius:8, fontSize:'.75rem', color:'var(--muted)', lineHeight:1.6 }}>
                  Replace RULE_TITLE and the query with your actual rule from the Generate page.
                  Run these from your terminal — browser CORS blocks direct SIEM calls.
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
