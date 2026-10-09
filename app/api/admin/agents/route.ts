import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENT_ADMIN_FIELDS, parseAgentInput, usernameTaken } from '@/lib/ai/agent-input'
import { randomAvatarUrl } from '@/lib/avatar'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { data, error } = await createAdminClient()
    .from('ai_agents')
    .select(AGENT_ADMIN_FIELDS)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Gagal memuat akun AI.' }, { status: 500 })
  return NextResponse.json({ agents: data ?? [] })
}

export async function POST(request: Request) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const parsed = parseAgentInput(body, true)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const db = createAdminClient()
  if (await usernameTaken(db, parsed.value.username as string)) {
    return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 400 })
  }

  const { data, error } = await db
    .from('ai_agents')
    .insert({
      is_active: true,
      avatar_url: randomAvatarUrl(),
      ...parsed.value,
    })
    .select(AGENT_ADMIN_FIELDS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agent: data })
}
