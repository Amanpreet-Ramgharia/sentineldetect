// SentinelDetect — Server-side AI Provider
// BYOK: checks user's stored key first, falls back to platform key
// Copyright 2026 Amanpreet Singh Matharu

import type { Provider } from '@/lib/types'
import { createServiceClient } from '@/lib/supabase/server'

const PROVIDERS = {
  gemini:    { models: ['gemini-3.1-flash-lite','gemini-2.5-flash-lite','gemini-2.5-flash'], baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models' },
  openai:    { models: ['gpt-4o-mini','gpt-4o'],                                             baseUrl: 'https://api.openai.com/v1/chat/completions' },
  anthropic: { models: ['claude-haiku-4-5-20251001','claude-sonnet-4-20250514'],             baseUrl: 'https://api.anthropic.com/v1/messages' },
  groq:      { models: ['llama-3.1-8b-instant','llama-3.3-70b-versatile'],                  baseUrl: 'https://api.groq.com/openai/v1/chat/completions' },
} as const

async function resolveApiKey(provider: Provider, userId?: string): Promise<string> {
  if (userId) {
    try {
      const sb = createServiceClient()
      const { data } = await sb
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('provider', provider)
        .maybeSingle()
      if (data?.api_key) return data.api_key
    } catch { /* fall through */ }
  }
  const envKey = {
    gemini:    process.env.GEMINI_API_KEY,
    openai:    process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq:      process.env.GROQ_API_KEY,
  }[provider]
  if (!envKey) throw new Error(`No ${provider} API key. Add yours in Settings.`)
  return envKey
}

async function fetchJSON(url: string, init: RequestInit, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal })
    const json = await res.json()
    if (!res.ok) {
      const msg = (json?.error?.message ?? json?.message ?? `HTTP ${res.status}`) as string
      throw Object.assign(new Error(msg), { status: res.status })
    }
    return json
  } finally {
    clearTimeout(timer)
  }
}

async function callGemini(key: string, model: string, system: string, user: string) {
  const data = await fetchJSON(
    `${PROVIDERS.gemini.baseUrl}/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: 'application/json' },
      }),
    }
  )
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`Empty response (${data?.candidates?.[0]?.finishReason ?? 'unknown'})`)
  return text as string
}

async function callOpenAICompat(key: string, model: string, system: string, user: string, baseUrl: string) {
  const data = await fetchJSON(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model, temperature: 0.1, max_tokens: 2048,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  })
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty response')
  return text as string
}

async function callAnthropic(key: string, model: string, system: string, user: string) {
  const data = await fetchJSON(PROVIDERS.anthropic.baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: 2048, temperature: 0.1, system, messages: [{ role: 'user', content: user }] }),
  })
  const text = data?.content?.[0]?.text
  if (!text) throw new Error('Empty Anthropic response')
  return text as string
}

async function callModel(provider: Provider, key: string, model: string, system: string, user: string) {
  switch (provider) {
    case 'gemini':    return callGemini(key, model, system, user)
    case 'openai':    return callOpenAICompat(key, model, system, user, PROVIDERS.openai.baseUrl)
    case 'groq':      return callOpenAICompat(key, model, system, user, PROVIDERS.groq.baseUrl)
    case 'anthropic': return callAnthropic(key, model, system, user)
  }
}

export function parseJSON<T>(raw: string): T {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end   = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('AI returned text instead of JSON. Please try again.')
  try { return JSON.parse(cleaned.slice(start, end + 1)) as T }
  catch { throw new Error('Could not parse AI response. Please try again.') }
}

export interface AIResult { raw: string; model_used: string; provider: Provider }

export async function runAI(
  system: string,
  user: string,
  provider: Provider = 'gemini',
  userId?: string
): Promise<AIResult> {
  const key    = await resolveApiKey(provider, userId)
  const models = [...PROVIDERS[provider].models]
  let lastError: unknown

  for (const model of models) {
    try {
      const raw = await callModel(provider, key, model, system, user)
      return { raw, model_used: model, provider }
    } catch (err: unknown) {
      lastError = err
      const e = err as { status?: number; message?: string }
      if ([401, 403].includes(e.status ?? 0) || String(e.message).toLowerCase().includes('api key')) {
        throw new Error(`Invalid ${provider} API key. Update it in Settings.`)
      }
      if (e.status === 429) { await new Promise(r => setTimeout(r, 5000)) }
    }
  }
  throw new Error(`${provider}: ${(lastError as Error)?.message ?? 'All models failed'}`)
}
