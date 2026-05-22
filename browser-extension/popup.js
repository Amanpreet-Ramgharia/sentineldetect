const API = 'https://smartswingalerts.com/api/v1/generate'

async function getKey() {
  return new Promise(res => chrome.storage.local.get('sd_api_key', d => res(d.sd_api_key || '')))
}

async function setKey(k) {
  return new Promise(res => chrome.storage.local.set({ sd_api_key: k }, res))
}

document.addEventListener('DOMContentLoaded', async () => {
  const key = await getKey()
  if (!key) {
    document.getElementById('settingsView').style.display = 'block'
    document.getElementById('mainView').style.display = 'none'
  }

  document.getElementById('settingsBtn').onclick = () => {
    document.getElementById('settingsView').style.display = 'block'
    document.getElementById('mainView').style.display = 'none'
  }

  document.getElementById('backBtn').onclick = () => {
    document.getElementById('settingsView').style.display = 'none'
    document.getElementById('mainView').style.display = 'block'
  }

  document.getElementById('saveKey').onclick = async () => {
    const k = document.getElementById('apiKeyInput').value.trim()
    if (!k.startsWith('sd_')) { alert('Key must start with sd_'); return }
    await setKey(k)
    document.getElementById('settingsView').style.display = 'none'
    document.getElementById('mainView').style.display = 'block'
  }

  document.getElementById('generateBtn').onclick = async () => {
    const scenario = document.getElementById('scenario').value.trim()
    const platform = document.getElementById('platform').value
    const key      = await getKey()
    const btn      = document.getElementById('generateBtn')
    const errEl    = document.getElementById('error')
    const resEl    = document.getElementById('result')

    errEl.style.display = 'none'
    if (!scenario || scenario.length < 10) { errEl.textContent = 'Enter a scenario (min 10 characters)'; errEl.style.display = 'block'; return }
    if (!key) { errEl.textContent = 'Add your API key in Settings first'; errEl.style.display = 'block'; return }

    btn.disabled = true
    btn.innerHTML = '<span class="spinner"></span>Generating...'

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, platform })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      const rule = data.rule
      document.getElementById('resultTitle').textContent = rule.title || platform
      document.getElementById('resultCode').textContent  = rule.rule || ''
      document.getElementById('resultMeta').innerHTML = [
        rule.mitre_id ? `<span class="badge" style="background:rgba(129,140,248,.15);color:#818cf8;">${rule.mitre_id}</span>` : '',
        rule.severity ? `<span class="badge" style="background:rgba(249,115,22,.12);color:#f97316;">${rule.severity}</span>` : '',
        rule.confidence ? `<span style="color:#34d399;font-size:.65rem;">${rule.confidence}% confidence</span>` : '',
      ].filter(Boolean).join('')
      resEl.style.display = 'block'
    } catch (e) {
      errEl.textContent = e.message
      errEl.style.display = 'block'
    } finally {
      btn.disabled = false
      btn.innerHTML = 'Generate Detection Rule'
    }
  }

  document.getElementById('copyBtn').onclick = () => {
    const code = document.getElementById('resultCode').textContent
    navigator.clipboard.writeText(code).then(() => {
      document.getElementById('copyBtn').textContent = 'Copied!'
      setTimeout(() => document.getElementById('copyBtn').textContent = 'Copy', 2000)
    })
  }
})
