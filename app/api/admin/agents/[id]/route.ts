import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { AGENT_ADMIN_FIELDS, parseAgentInput, usernameTaken } from '@/lib/ai/agent-input'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const parsed = parseAgentInput(body, false)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  if (Object.keys(parsed.value).length === 0) return NextResponse.json({ ok: true })

  const db = createAdminClient()
  if (typeof parsed.value.username === 'string' && (await usernameTaken(db, parsed.value.username, id))) {
    return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 400 })
  }

  const { data, error } = await db
    .from('ai_agents')
    .update(parsed.value)
    .eq('id', id)
    .select(AGENT_ADMIN_FIELDS)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ agent: data })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { id } = await params
  const { error } = await createAdminClient().from('ai_agents').delete().eq('id', id)
  if (error) {
    return NextResponse.json(
      { error: 'Gagal menghapus (masih ada data terkait). Nonaktifkan saja akun AI ini.' },
      { status: 400 },
    )
  }
  return NextResponse.json({ ok: true })
}
