'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team { id: string; name: string; created_at: string; plan: string; role: string }

export default function TeamsPage() {
  const [teams,    setTeams]    = useState<Team[]>([])
  const [loading,  setLoading]  = useState(true)
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState<string|null>(null)
  const [teamName, setTeamName] = useState('')
  const [email,    setEmail]    = useState('')
  const [openInvite, setOpenInvite] = useState<string|null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'ok'|'err' }|null>(null)

  const showMsg = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: memberships, error: mErr } = await sb
      .from('team_members').select('team_id, role').eq('user_id', user.id)

    if (mErr || !memberships?.length) { setTeams([]); setLoading(false); return }

    const ids = memberships.map((m: any) => m.team_id)
    const { data: teamsData, error: tErr } = await sb.from('teams').select('*').in('id', ids)

    if (tErr) { setTeams([]); setLoading(false); return }

    setTeams((teamsData || []).map((t: any) => ({
      ...t,
      role: memberships.find((m: any) => m.team_id === t.id)?.role ?? 'member',
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createTeam() {
    if (!teamName.trim()) return
    setCreating(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setCreating(false); return }

    const { data: team, error: tErr } = await sb
      .from('teams')
      .insert({ name: teamName.trim(), created_by: user.id })
      .select().single()

    if (tErr) { showMsg(tErr.message, 'err'); setCreating(false); return }

    const { error: mErr } = await sb
      .from('team_members')
      .insert({ team_id: team.id, user_id: user.id, role: 'owner' })

    if (mErr) { showMsg(mErr.message, 'err'); setCreating(false); return }

    setTeamName('')
    showMsg(`Team "${team.name}" created`)
    setCreating(false)
    // Small delay before reloading to allow DB to settle
    setTimeout(load, 500)
  }

  async function inviteMember(teamId: string) {
    if (!email.trim()) return
    setInviting(teamId)
    try {
      const res = await fetch('/api/teams', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', team_id: teamId, email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      showMsg(`Invited ${email}`)
      setEmail(''); setOpenInvite(null)
    } catch (e: unknown) {
      showMsg(e instanceof Error ? e.message : 'Invite failed', 'err')
    }
    setInviting(null)
  }

  const inp: React.CSSProperties = { flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit' }

  return (
    <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.25rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Team Workspaces</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>Create a team to share your rule library and see combined ATT&CK coverage</p>
      </div>

      {msg && (
        <div style={{ background: msg.type==='ok' ? 'var(--green-bg)' : 'var(--red-bg)', border:`1px solid ${msg.type==='ok' ? 'var(--green-bd)' : 'var(--red-bd)'}`, borderRadius:8, padding:'.65rem 1rem', fontSize:'.8rem', color: msg.type==='ok' ? 'var(--green)' : 'var(--red)', marginBottom:'1rem' }}>
          {msg.text}
        </div>
      )}

      {/* Create team */}
      <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'1.1rem', marginBottom:'1.25rem' }}>
        <div style={{ fontSize:'.82rem', fontWeight:600, color:'var(--text)', marginBottom:'.6rem' }}>Create a team</div>
        <div style={{ display:'flex', gap:'.65rem' }}>
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Team name"
            style={inp} onKeyDown={e => e.key === 'Enter' && createTeam()}
            onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
            onBlur={e => e.target.style.borderColor='var(--border2)'}/>
          <button onClick={createTeam} disabled={creating || !teamName.trim()}
            style={{ padding:'.5rem 1.1rem', background: teamName.trim() && !creating ? '#f97316' : 'var(--muted2)', border:'none', borderRadius:8, color:'#fff', fontSize:'.82rem', fontWeight:600, cursor: teamName.trim() && !creating ? 'pointer' : 'not-allowed', fontFamily:'inherit', flexShrink:0 }}>
            {creating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>

      {/* Teams list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)', fontSize:'.85rem' }}>Loading teams...</div>
      ) : teams.length === 0 ? (
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'3rem', textAlign:'center' }}>
          <div style={{ fontSize:'.9rem', fontWeight:500, color:'var(--text2)', marginBottom:'.4rem' }}>No teams yet</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted)' }}>Create a team above to start collaborating</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {teams.map(team => (
            <div key={team.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'.9rem 1.1rem', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom: openInvite===team.id ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'.5rem', marginBottom:'.2rem' }}>
                    <span style={{ fontSize:'.88rem', fontWeight:600, color:'var(--text)' }}>{team.name}</span>
                    <span style={{ fontSize:'.62rem', padding:'.1rem .4rem', borderRadius:4, background: team.role==='owner' ? 'rgba(249,115,22,.12)' : 'var(--blue-bg)', color: team.role==='owner' ? '#f97316' : 'var(--blue)', border:`1px solid ${team.role==='owner' ? 'rgba(249,115,22,.3)' : 'var(--blue-bd)'}`, fontWeight:600 }}>
                      {team.role}
                    </span>
                  </div>
                  <div style={{ fontSize:'.68rem', color:'var(--muted2)', fontFamily:'monospace' }}>Created {new Date(team.created_at).toLocaleDateString()}</div>
                </div>
                {(team.role === 'owner' || team.role === 'admin') && (
                  <button onClick={() => setOpenInvite(openInvite===team.id ? null : team.id)}
                    style={{ padding:'.38rem .85rem', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit' }}>
                    Invite member
                  </button>
                )}
              </div>
              {openInvite === team.id && (
                <div style={{ padding:'.85rem 1.1rem', background:'rgba(249,115,22,.03)', display:'flex', gap:'.65rem' }}>
                  <input value={email} onChange={e => setEmail(e.target.value)} placeholder="member@company.com"
                    style={inp} type="email" onKeyDown={e => e.key === 'Enter' && inviteMember(team.id)}
                    onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                    onBlur={e => e.target.style.borderColor='var(--border2)'}/>
                  <button onClick={() => inviteMember(team.id)} disabled={inviting===team.id || !email.trim()}
                    style={{ padding:'.5rem 1rem', background: email.trim() && !inviting ? '#f97316' : 'var(--muted2)', border:'none', borderRadius:8, color:'#fff', fontSize:'.8rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                    {inviting===team.id ? 'Inviting...' : 'Invite'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
