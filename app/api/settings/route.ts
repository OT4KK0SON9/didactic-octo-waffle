import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminUser } from '@/lib/auth/admin'

export const dynamic = 'force-dynamic'

function mask(key: string | null | undefined, envKey: string | undefined) {
  if (key) return { configured: true, source: 'database', last4: key.slice(-4) }
  if (envKey) return { configured: true, source: 'env', last4: envKey.slice(-4) }
  return { configured: false, source: null, last4: null }
}

// Keys are write-only from the browser: only a masked status is ever returned.
export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Hanya admin' }, { status: 403 })

  const db = createAdminClient()
  const [{ data: secrets }, { data: state }] = await Promise.all([
    db.from('app_secrets').select('groq_api_key, gemini_api_key').eq('id', 1).single(),
    db.from('scheduler_state').select('enabled, next_run_at').eq('id', 1).single(),
  ])

  return NextResponse.json({
    groq: mask(secrets?.groq_api_key, process.env.GROQ_API_KEY),
    gemini: mask(secrets?.gemini_api_key, process.env.GEMINI_API_KEY),
    enabled: state?.enabled ?? true,
    nextRunAt: state?.next_run_at ?? null,
  })
}

interface Body {
  groqApiKey?: string
  geminiApiKey?: string
  clearGroq?: boolean
  clearGemini?: boolean
  enabled?: boolean
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Hanya admin' }, { status: 403 })

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid' }, { status: 400 })
  }

  const db = createAdminClient()
  const secretUpdate: Record<string, string | null> = {}
  const groq = body.groqApiKey?.trim()
  const gemini = body.geminiApiKey?.trim()
  if (groq) secretUpdate.groq_api_key = groq
  if (gemini) secretUpdate.gemini_api_key = gemini
  if (body.clearGroq) secretUpdate.groq_api_key = null
  if (body.clearGemini) secretUpdate.gemini_api_key = null

  if (Object.keys(secretUpdate).length) {
    const { error } = await db
      .from('app_secrets')
      .update({ ...secretUpdate, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: 'Gagal menyimpan key' }, { status: 500 })
  }

  if (typeof body.enabled === 'boolean') {
    const { error } = await db
      .from('scheduler_state')
      .update({ enabled: body.enabled })
      .eq('id', 1)
    if (error) return NextResponse.json({ error: 'Gagal mengubah scheduler' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
