#!/usr/bin/env python3
"""Apply rule review changes to rules/page.tsx"""
import re, sys

path = "app/(dashboard)/rules/page.tsx"
with open(path) as f:
    src = f.read()

# 1. Add reviewing state after editNote state
old1 = "  const [editNote,  setEditNote]  = useState<string|null>(null)"
new1 = """  const [editNote,  setEditNote]  = useState<string|null>(null)
  const [reviewing, setReviewing] = useState<string|null>(null)"""
src = src.replace(old1, new1)

# 2. Add markReviewed function after saveNote function closing brace
old2 = """  async function saveNote(rule: DbRule) {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().from('rules').update({ note: noteVal }).eq('id', rule.id)
    setRules(p => p.map(r => r.id === rule.id ? {...r, note: noteVal} : r))
    if (sel?.id === rule.id) setSel(p => p ? {...p, note: noteVal} : null)
    setEditNote(null)
  }"""
new2 = """  async function saveNote(rule: DbRule) {
    const { createClient } = await import('@/lib/supabase/client')
    await createClient().from('rules').update({ note: noteVal }).eq('id', rule.id)
    setRules(p => p.map(r => r.id === rule.id ? {...r, note: noteVal} : r))
    if (sel?.id === rule.id) setSel(p => p ? {...p, note: noteVal} : null)
    setEditNote(null)
  }

  async function markReviewed(rule: DbRule) {
    setReviewing(rule.id)
    const now = new Date().toISOString()
    await createClient().from('rules').update({ last_reviewed_at: now }).eq('id', rule.id)
    setRules(p => p.map(r => r.id === rule.id ? {...r, last_reviewed_at: now} as any : r))
    if (sel?.id === rule.id) setSel(p => p ? {...p, last_reviewed_at: now} as any : null)
    setReviewing(null)
  }"""
src = src.replace(old2, new2)

# 3. Add stale indicator in list item after the note display
old3 = """                {rule.note && <div style={{fontSize:'.65rem', color:'var(--muted)', marginTop:'.2rem', fontStyle:'italic'}}> {rule.note}</div>}
              </div>"""
new3 = """                {rule.note && <div style={{fontSize:'.65rem', color:'var(--muted)', marginTop:'.2rem', fontStyle:'italic'}}> {rule.note}</div>}
                {(() => {
                  const lr = (rule as any).last_reviewed_at
                  const isStale = !lr || (Date.now() - new Date(lr).getTime()) > 90 * 86400000
                  return isStale
                    ? <div style={{fontSize:'.6rem', color:'#f97316', marginTop:'.2rem', display:'flex', alignItems:'center', gap:'.3rem'}}><span style={{width:5,height:5,borderRadius:'50%',background:'#f97316',display:'inline-block',flexShrink:0}}/> Needs review</div>
                    : <div style={{fontSize:'.6rem', color:'var(--green)', marginTop:'.2rem'}}>Reviewed {new Date((rule as any).last_reviewed_at).toLocaleDateString()}</div>
                })()}
              </div>"""
src = src.replace(old3, new3)

# 4. Add Mark reviewed section at the bottom of the detail panel, after the Note section
old4 = """              {/* Note */}
              <div style={{padding:'.75rem 1.1rem', background:'rgba(249,115,22,.03)', borderTop:'1px solid var(--border)'}}>"""
new4 = """              {/* Note */}
              <div style={{padding:'.75rem 1.1rem', background:'rgba(249,115,22,.03)', borderTop:'1px solid var(--border)'}}>"""
# Note: the Note section closing is complex, add the review section right before the outer closing </div></div>

# Find the end of the detail panel — add review section before the final closing div
# We'll add it after the Note section's closing div
old5 = """              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}"""
new5 = """              </div>

              {/* Rule Review */}
              <div style={{padding:'.75rem 1.1rem', background:'rgba(34,197,94,.03)', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'1rem', flexWrap:'wrap'}}>
                <div>
                  <div style={{fontSize:'.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.09em', color:'var(--muted)', marginBottom:'.2rem'}}>Rule Review</div>
                  <div style={{fontSize:'.72rem', color:'var(--muted2)'}}>
                    {(sel as any).last_reviewed_at
                      ? `Last reviewed ${new Date((sel as any).last_reviewed_at).toLocaleDateString()}`
                      : 'Never reviewed — confirm this rule is still accurate and relevant'}
                  </div>
                </div>
                <button onClick={() => markReviewed(sel)} disabled={reviewing === sel.id}
                  style={{padding:'.4rem .9rem', borderRadius:7, border:'1px solid var(--green-bd)', background:'var(--green-bg)', color:'var(--green)', fontSize:'.75rem', cursor:'pointer', fontFamily:'inherit', flexShrink:0}}>
                  {reviewing === sel.id ? 'Saving…' : (sel as any).last_reviewed_at ? 'Re-review' : 'Mark reviewed'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}"""
src = src.replace(old5, new5)

changed = sum([
    old1 in open(path).read(),
    old2 in open(path).read(),
])
print(f"Replacements needed: note old1={'found' if old1 in open(path).read() else 'not found'}")

with open(path, 'w') as f:
    f.write(src)
print("Done - rules page updated")
