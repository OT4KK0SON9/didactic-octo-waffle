import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateText, type Provider } from '@/lib/ai/providers'
import { getApiKey } from '@/lib/ai/scheduler'

export const maxDuration = 60

// Tes cepat apakah kombinasi provider + model masih tersedia (model sering dihapus provider).
export async function POST(request: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })

  let body: { provider?: string; model?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }
  const provider = body.provider
  const model = body.model?.trim()
  if ((provider !== 'gemini' && provider !== 'groq') || !model || !/^[\w.\-:/]{1,100}$/.test(model)) {
    return NextResponse.json({ error: 'Provider atau model tidak valid.' }, { status: 400 })
  }

  try {
    const apiKey = await getApiKey(createAdminClient(), provider as Provider)
    const reply = await generateText({
      provider: provider as Provider,
      model,
      apiKey,
      system: 'Kamu asisten singkat.',
      prompt: 'Balas dengan satu kata: siap',
    })
    return NextResponse.json({ ok: true, reply })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : 'Gagal menguji model.' })
  }
}
