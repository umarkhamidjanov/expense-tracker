// Server-side AI chat for the Spending Assistant, powered by Google Gemini.
// Runs as a Vercel Function at /api/chat. The Gemini key is read from GEMINI_API_KEY on the
// server and is never sent to the browser. Only signed-in Lumen users can use this route.
import { ApiError, GoogleGenAI } from '@google/genai'

const MODEL = 'gemini-3.5-flash-lite' // inexpensive Flash-Lite model, available on the free tier
const MAX_OUTPUT_TOKENS = 1024 // replies are short; this is a safety cap
const MAX_MESSAGE_CHARS = 500 // per user message
const MAX_HISTORY = 10 // earlier chat messages sent as context
const MAX_HISTORY_CHARS = 1000 // per earlier message
const MAX_SUMMARY_CHARS = 6000 // spending summary built by the app

const SYSTEM_PROMPT = `You are the Spending Assistant inside Lumen, a personal expense-tracking app. You chat with the signed-in user about their money in a friendly, encouraging, practical way.

- For questions about their spending or budget, base your answer on the spending summary below, which the app generated from the user's own transactions. Use its real numbers and currency formatting. Never invent transactions or figures that aren't in the summary; if something isn't there, say so.
- For greetings and small talk, reply naturally and briefly, and offer to help with their spending.
- Keep replies short: two to five sentences, or a few short lines starting with "- " when listing tips.
- Write plain text only, with no headings, bold text, asterisks or tables.
- Give general budgeting tips only. For investments, taxes or debt, suggest talking to a qualified professional.
- If the user asks about something unrelated to money, answer briefly and kindly, then steer back to how you can help with their spending.`

const json = (status, body) => Response.json(body, { status })

// Confirms the request comes from a signed-in Lumen user by checking their Supabase session.
async function getUser(request) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!token || !url || !key) return null
  const res = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } })
  return res.ok ? res.json() : null
}

// Recent conversation in Gemini's format ("user" / "model"), ending with the new message.
function buildContents(history, message) {
  const turns = (Array.isArray(history) ? history : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.text === 'string' && m.text.trim())
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.text.slice(0, MAX_HISTORY_CHARS) }] }))
  while (turns.length && turns[0].role !== 'user') turns.shift() // conversation must start with the user
  return [...turns, { role: 'user', parts: [{ text: message }] }]
}

export async function POST(request) {
  if (!process.env.GEMINI_API_KEY) return json(503, { error: 'not_configured' })

  let user
  try {
    user = await getUser(request)
  } catch {
    user = null
  }
  if (!user) return json(401, { error: 'unauthorized' })

  let body
  try {
    body = await request.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }
  const message = typeof body?.message === 'string' ? body.message.trim() : ''
  if (!message) return json(400, { error: 'empty_message' })
  if (message.length > MAX_MESSAGE_CHARS) return json(400, { error: 'message_too_long' })
  const summary = typeof body.summary === 'string' ? body.summary.slice(0, MAX_SUMMARY_CHARS) : ''

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: buildContents(body.history, message),
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nSpending summary:\n${summary || 'No transactions yet.'}`,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      },
    })
    // No text means the reply was blocked (e.g. by a safety filter) or empty.
    const reply = (response.text || '').trim()
    return json(200, { reply: reply || "Sorry, I can't help with that one. Ask me anything about your spending, though!" })
  } catch (error) {
    if (error instanceof ApiError) {
      console.error('Gemini API error', error.status, error.message)
      if (error.status === 429) return json(429, { error: 'busy' }) // free-tier quota or rate limit reached
      if (error.status === 400 || error.status === 401 || error.status === 403) return json(503, { error: 'not_configured' })
      return json(502, { error: 'ai_error' })
    }
    console.error('Gemini request failed', error?.message)
    return json(503, { error: 'unavailable' })
  }
}
