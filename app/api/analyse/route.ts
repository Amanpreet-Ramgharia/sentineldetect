import { NextRequest, NextResponse } from 'next/server'
import { runAI, parseJSON } from '@/lib/ai'
import { ANALYSE_SYSTEM, ANALYSE_USER } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { AnalyseRequest, LogAnalysis } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const body: AnalyseRequest = await req.json()
    const { log, format, provider = 'gemini' } = body

    if (!log || log.trim().length < 20) {
      return NextResponse.json({ error: 'Log must be at least 20 characters' }, { status: 400 })
    }

    const { raw, model_used } = await runAI(ANALYSE_SYSTEM, ANALYSE_USER(log, format), provider, user.id)
    const analysis = parseJSON<LogAnalysis>(raw)
    return NextResponse.json({ analysis, model_used })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Analysis failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
