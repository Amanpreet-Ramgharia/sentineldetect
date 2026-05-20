'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Team { id: string; name: string; created_at: string; plan: string; role: string }
interface Member { user_id: string; role: string; email: string; full_name: string | null }

export default function TeamsPage() {
  const [teams,      setTeams]      = useState<Team[]>([])
  const [loading,    setLoading]    = useState(true)
  const [creating,   setCreating]   = useState(false)
  const [teamName,   setTeamName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [inviting,   setInviting]   = useState<string|null>(null)
  const [openInvite, setOpenInvite] = useState<string|null>(null)
  const [members,    setMembers]    = useState<Record<string, Member[]>>({})
  const [renaming,   setRenaming]   = useState<string|null>(null)
  const [renameVal,  setRenameVal]  = useState('')
  const [deleting,   setDeleting]   = useState<string|null>(null)
  const [expanded,   setExpanded]   = useState<string|null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'ok'|'err' }|null>(null)

  const flash = (text: string, type: 'ok'|'err' = 'ok') => {
    setMsg({ text, type })
    setTimeout(() => setMsg(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: memberships } = await sb
      .from('team_members').select('team_id, role').eq('user_id', user.id)

    if (!memberships?.length) { setTeams([]); setLoading(false); return }

    const ids = memberships.map((m: any) => m.team_id)
    const { data: teamsData } = await sb.from('teams').select('*').in('id', ids)

    setTeams((teamsData || []).map((t: any) => ({
      ...t,
      role: memberships.find((m: any) => m.team_id === t.id)?.role ?? 'member',
    })))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadMembers(teamId: string) {
    const sb = createClient()
    const { data } = await sb
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)

    if (!data?.length) { setMembers(prev => ({ ...prev, [teamId]: [] })); return }

    // Get profiles for each member
    const { data: profiles } = await sb
      .from('profiles')
      .select('id, email, full_name')
      .in('id', data.map((m: any) => m.user_id))

    const enriched = data.map((m: any) => ({
      ...m,
      email:     profiles?.find((p: any) => p.id === m.user_id)?.email     ?? 'Unknown',
      full_name: profiles?.find((p: any) => p.id === m.user_id)?.full_name ?? null,
    }))
    setMembers(prev => ({ ...prev, [teamId]: enriched }))
  }

  function toggleExpand(teamId: string) {
    if (expanded === teamId) { setExpanded(null); return }
    setExpanded(teamId)
    loadMembers(teamId)
  }

  async function createTeam() {
    if (!teamName.trim()) return
    setCreating(true)
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setCreating(false); return }

    const { data: team, error } = await sb
      .from('teams').insert({ name: teamName.trim(), created_by: user.id }).select().single()

    if (error) { flash(error.message, 'err'); setCreating(false); return }

    await sb.from('team_members').insert({ team_id: team.id, user_id: user.id, role: 'owner' })
    setTeamName('')
    flash(`Team "${team.name}" created`)
    setCreating(false)
    setTimeout(load, 600)
  }

  async function renameTeam(teamId: string) {
    if (!renameVal.trim()) return
    const sb = createClient()
    const { error } = await sb.from('teams').update({ name: renameVal.trim() }).eq('id', teamId)
    if (error) { flash(error.message, 'err'); return }
    flash('Team renamed')
    setRenaming(null); setRenameVal('')
    load()
  }

  async function deleteTeam(teamId: string, teamName: string) {
    if (!confirm(`Delete team "${teamName}"? This cannot be undone.`)) return
    setDeleting(teamId)
    const sb = createClient()
    await sb.from('team_members').delete().eq('team_id', teamId)
    const { error } = await sb.from('teams').delete().eq('id', teamId)
    if (error) { flash(error.message, 'err'); setDeleting(null); return }
    flash(`Team "${teamName}" deleted`)
    setDeleting(null)
    load()
  }

  async function removeMember(teamId: string, userId: string) {
    if (!confirm('Remove this member from the team?')) return
    const sb = createClient()
    await sb.from('team_members').delete().eq('team_id', teamId).eq('user_id', userId)
    flash('Member removed')
    loadMembers(teamId)
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
      flash(`${email} added to team`)
      setEmail(''); setOpenInvite(null)
      loadMembers(teamId)
    } catch (e: unknown) {
      flash(e instanceof Error ? e.message : 'Invite failed', 'err')
    }
    setInviting(null)
  }

  const inp: React.CSSProperties = { flex:1, background:'var(--bg)', border:'1px solid var(--border2)', borderRadius:7, padding:'.5rem .8rem', color:'var(--text)', fontSize:'.82rem', outline:'none', fontFamily:'inherit' }
  const sBtn = (color = '#f97316'): React.CSSProperties => ({ padding:'.38rem .85rem', borderRadius:7, border:'none', background:color, color:'#fff', fontSize:'.75rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit', flexShrink:0 })
  const oBtn: React.CSSProperties = { padding:'.38rem .85rem', borderRadius:7, border:'1px solid var(--border)', background:'var(--bg)', color:'var(--muted)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit', flexShrink:0 }

  return (
    <div style={{ padding:'1.5rem', maxWidth:900, margin:'0 auto' }}>
      <div style={{ marginBottom:'1.25rem' }}>
        <h1 style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)', margin:0 }}>Team Workspaces</h1>
        <p style={{ fontSize:'.8rem', color:'var(--muted)', marginTop:'.3rem' }}>
          Share your rule library and see combined ATT&CK coverage with your team.
          Members must have a SentinelDetect account before being invited.
        </p>
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
          <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="e.g. SOC Team, Blue Team, Detection Engineering"
            style={inp} onKeyDown={e => e.key==='Enter' && createTeam()}
            onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
            onBlur={e => e.target.style.borderColor='var(--border2)'}/>
          <button onClick={createTeam} disabled={creating || !teamName.trim()} style={sBtn(teamName.trim() && !creating ? '#f97316' : 'var(--muted2)')}>
            {creating ? 'Creating...' : 'Create team'}
          </button>
        </div>
      </div>

      {/* Teams list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)', fontSize:'.85rem' }}>Loading...</div>
      ) : teams.length === 0 ? (
        <div style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, padding:'3rem', textAlign:'center' }}>
          <div style={{ fontSize:'.9rem', fontWeight:500, color:'var(--text2)', marginBottom:'.4rem' }}>No teams yet</div>
          <div style={{ fontSize:'.8rem', color:'var(--muted)' }}>Create one above to get started</div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'.75rem' }}>
          {teams.map(team => {
            const isOwner  = team.role === 'owner'
            const isAdmin  = team.role === 'admin' || isOwner
            const teamMembers = members[team.id] || []

            return (
              <div key={team.id} style={{ background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>

                {/* Team header */}
                <div style={{ padding:'.9rem 1.1rem', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    {renaming === team.id ? (
                      <div style={{ display:'flex', gap:'.5rem' }}>
                        <input value={renameVal} onChange={e => setRenameVal(e.target.value)} autoFocus
                          style={{ ...inp, flex:'none', width:220 }}
                          onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                          onBlur={e => e.target.style.borderColor='var(--border2)'}
                          onKeyDown={e => { if(e.key==='Enter') renameTeam(team.id); if(e.key==='Escape') setRenaming(null) }}/>
                        <button onClick={() => renameTeam(team.id)} style={sBtn()}>Save</button>
                        <button onClick={() => setRenaming(null)} style={oBtn}>Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                        <span style={{ fontSize:'.9rem', fontWeight:600, color:'var(--text)' }}>{team.name}</span>
                        <span style={{ fontSize:'.62rem', padding:'.1rem .4rem', borderRadius:4, background: isOwner ? 'rgba(249,115,22,.12)' : 'var(--blue-bg)', color: isOwner ? '#f97316' : 'var(--blue)', border:`1px solid ${isOwner ? 'rgba(249,115,22,.3)' : 'var(--blue-bd)'}`, fontWeight:600 }}>
                          {team.role}
                        </span>
                        <span style={{ fontSize:'.68rem', color:'var(--muted2)', fontFamily:'monospace' }}>· {new Date(team.created_at).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display:'flex', gap:'.4rem', flexShrink:0 }}>
                    <button onClick={() => toggleExpand(team.id)} style={oBtn}>
                      {expanded===team.id ? 'Hide members' : 'Members'}
                    </button>
                    {isAdmin && (
                      <button onClick={() => { setOpenInvite(openInvite===team.id?null:team.id); setExpanded(team.id); loadMembers(team.id) }} style={oBtn}>
                        Invite
                      </button>
                    )}
                    {isOwner && (
                      <>
                        <button onClick={() => { setRenaming(team.id); setRenameVal(team.name) }} style={oBtn}>Rename</button>
                        <button onClick={() => deleteTeam(team.id, team.name)} disabled={deleting===team.id}
                          style={{ ...oBtn, color:'var(--red)', borderColor:'var(--red-bd)', background:'var(--red-bg)' }}>
                          {deleting===team.id ? '...' : 'Delete'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Invite panel */}
                {openInvite === team.id && (
                  <div style={{ padding:'.85rem 1.1rem', borderTop:'1px solid var(--border)', background:'rgba(249,115,22,.03)', display:'flex', gap:'.65rem', alignItems:'center' }}>
                    <input value={email} onChange={e => setEmail(e.target.value)} placeholder="colleague@company.com (must have a SentinelDetect account)"
                      style={inp} type="email" onKeyDown={e => e.key==='Enter' && inviteMember(team.id)}
                      onFocus={e => e.target.style.borderColor='rgba(249,115,22,.5)'}
                      onBlur={e => e.target.style.borderColor='var(--border2)'}/>
                    <button onClick={() => inviteMember(team.id)} disabled={inviting===team.id || !email.trim()}
                      style={sBtn(email.trim() && !inviting ? '#f97316' : 'var(--muted2)')}>
                      {inviting===team.id ? 'Inviting...' : 'Invite'}
                    </button>
                    <button onClick={() => setOpenInvite(null)} style={oBtn}>Cancel</button>
                  </div>
                )}

                {/* Members list */}
                {expanded === team.id && (
                  <div style={{ borderTop:'1px solid var(--border)' }}>
                    {teamMembers.length === 0 ? (
                      <div style={{ padding:'1rem 1.1rem', fontSize:'.8rem', color:'var(--muted)' }}>Loading members...</div>
                    ) : teamMembers.map(m => (
                      <div key={m.user_id} style={{ padding:'.6rem 1.1rem', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem' }}>
                        <div>
                          <span style={{ fontSize:'.82rem', color:'var(--text)', fontWeight:500 }}>{m.full_name || m.email}</span>
                          {m.full_name && <span style={{ fontSize:'.72rem', color:'var(--muted)', marginLeft:'.5rem' }}>{m.email}</span>}
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:'.5rem' }}>
                          <span style={{ fontSize:'.62rem', padding:'.1rem .4rem', borderRadius:4, background:'var(--bg3)', color:'var(--muted)', fontWeight:500 }}>{m.role}</span>
                          {isAdmin && m.role !== 'owner' && (
                            <button onClick={() => removeMember(team.id, m.user_id)}
                              style={{ fontSize:'.7rem', padding:'.2rem .55rem', borderRadius:5, border:'1px solid var(--red-bd)', background:'var(--red-bg)', color:'var(--red)', cursor:'pointer', fontFamily:'inherit' }}>
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
