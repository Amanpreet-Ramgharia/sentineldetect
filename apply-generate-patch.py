
import re

with open("app/(dashboard)/generate/page.tsx") as f:
    src = f.read()

# 1. Add state variables after "// Convert"
old1 = "  // Convert\n  const [converting, setConverting] = useState(false)"
new1 = """  // Convert
  const [converting, setConverting] = useState(false)

  // Environment context
  const [showContext, setShowContext] = useState(false)
  const [ctxOS,    setCtxOS]    = useState('')
  const [ctxLogs,  setCtxLogs]  = useState<string[]>([])
  const [ctxSize,  setCtxSize]  = useState('')

  const LOG_SOURCES = [
    'Sysmon','Windows Security Event Log','Windows System Event Log',
    'DNS Query Logs','PowerShell Script Block Logging','EDR Telemetry',
    'Network Flow / NetFlow','CloudTrail (AWS)','Azure AD Sign-in Logs',
    'Firewall / Proxy Logs','Linux Audit / auditd','macOS Unified Log',
  ]

  function buildScenarioWithContext(): string {
    if (!ctxOS && !ctxLogs.length && !ctxSize) return scenario
    const lines: string[] = [scenario, '', 'Environment context (use to improve field accuracy):']
    if (ctxOS)           lines.push(`- Target environment: ${ctxOS}`)
    if (ctxLogs.length)  lines.push(`- Available log sources: ${ctxLogs.join(', ')}`)
    if (ctxSize)         lines.push(`- Scale: ${ctxSize}`)
    return lines.join('\\n')
  }"""

if old1 in src:
    src = src.replace(old1, new1)
    print("State variables injected")
else:
    print("WARN: state target not found")

# 2. Modify generate() to use buildScenarioWithContext()
old2 = "      const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenario, platform, focus}) })"
new2 = "      const enrichedScenario = buildScenarioWithContext()\n      const res = await fetch('/api/generate', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({scenario: enrichedScenario, platform, focus}) })"
if old2 in src:
    src = src.replace(old2, new2)
    print("Generate call updated")
else:
    print("WARN: generate call target not found")

# 3. Add context panel before the Options section title
old3 = "        {/* Options */}\n        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>"
new3 = """        {/* Environment context */}
        <div style={{borderBottom:'1px solid var(--border)'}}>
          <button onClick={()=>setShowContext(!showContext)}
            style={{width:'100%',padding:'.75rem 1.25rem',background:'none',border:'none',cursor:'pointer',textAlign:'left',fontFamily:'inherit',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'.5rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.5rem'}}>
              <span style={{fontSize:'.62rem',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'var(--muted)'}}>Environment Context</span>
              {(ctxOS||ctxLogs.length>0||ctxSize) && <span style={{fontSize:'.62rem',padding:'.1rem .45rem',borderRadius:4,background:'rgba(249,115,22,.12)',color:'#f97316',border:'1px solid rgba(249,115,22,.3)'}}>Active</span>}
            </div>
            <span style={{fontSize:'.7rem',color:'var(--muted2)',transform:showContext?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>›</span>
          </button>
          {showContext && (
            <div style={{padding:'.15rem 1.25rem 1rem'}}>
              <div style={{fontSize:'.72rem',color:'var(--muted)',lineHeight:1.5,marginBottom:'.65rem'}}>Improves field name accuracy and event ID relevance in generated rules.</div>
              <div style={{marginBottom:'.65rem'}}>
                <div style={{fontSize:'.67rem',color:'var(--muted)',marginBottom:'.28rem'}}>Target environment</div>
                <select value={ctxOS} onChange={e=>setCtxOS(e.target.value)} style={{...s.inp,cursor:'pointer'}}>
                  <option value=''>Not specified</option>
                  <option>Windows Active Directory (Domain-joined)</option>
                  <option>Windows Workstation (Standalone)</option>
                  <option>Windows Server</option>
                  <option>Linux Server</option>
                  <option>macOS Endpoint</option>
                  <option>AWS Cloud</option><option>Azure Cloud</option>
                  <option>Google Cloud Platform</option>
                  <option>Hybrid (On-prem + Cloud)</option>
                  <option>OT / Industrial Environment</option>
                </select>
              </div>
              <div style={{marginBottom:'.65rem'}}>
                <div style={{fontSize:'.67rem',color:'var(--muted)',marginBottom:'.35rem'}}>Available log sources</div>
                <div style={{display:'flex',flexDirection:'column',gap:'.3rem',maxHeight:160,overflowY:'auto',background:'var(--bg)',border:'1px solid var(--border)',borderRadius:7,padding:'.5rem .65rem'}}>
                  {LOG_SOURCES.map(ls=>(
                    <label key={ls} style={{display:'flex',alignItems:'center',gap:'.45rem',fontSize:'.73rem',color:'var(--text)',cursor:'pointer'}}>
                      <input type='checkbox' checked={ctxLogs.includes(ls)} onChange={e=>setCtxLogs(prev=>e.target.checked?[...prev,ls]:prev.filter(l=>l!==ls))} style={{accentColor:'#f97316',width:13,height:13,flexShrink:0}}/>
                      {ls}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{marginBottom:'.5rem'}}>
                <div style={{fontSize:'.67rem',color:'var(--muted)',marginBottom:'.28rem'}}>Environment scale</div>
                <select value={ctxSize} onChange={e=>setCtxSize(e.target.value)} style={{...s.inp,cursor:'pointer'}}>
                  <option value=''>Not specified</option>
                  <option>SMB (&lt;500 users)</option>
                  <option>Mid-market (500–5,000 users)</option>
                  <option>Enterprise (5,000+ users)</option>
                  <option>MSSP / Multi-tenant</option>
                </select>
              </div>
              {(ctxOS||ctxLogs.length>0||ctxSize) && (
                <button onClick={()=>{setCtxOS('');setCtxLogs([]);setCtxSize('')}}
                  style={{background:'none',border:'none',cursor:'pointer',color:'var(--muted2)',fontSize:'.72rem',fontFamily:'inherit',padding:0}}>
                  Clear context
                </button>
              )}
            </div>
          )}
        </div>

        {/* Options */}
        <div style={{padding:'1rem 1.25rem', borderBottom:'1px solid var(--border)'}}>"""

if old3 in src:
    src = src.replace(old3, new3)
    print("Context panel injected")
else:
    print("WARN: options section target not found")

with open("app/(dashboard)/generate/page.tsx", "w") as f:
    f.write(src)
print("Done")
