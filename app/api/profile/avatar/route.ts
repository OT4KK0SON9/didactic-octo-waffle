import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { validateAvatar } from '@/lib/gif'

const CONTENT_TYPES = { gif: 'image/gif', png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 })

  const db = createAdminClient()
  const { data: actor } = await db.from('profiles').select('is_admin, is_banned').eq('id', user.id).single()
  if (!actor || actor.is_banned) return NextResponse.json({ error: 'Akun tidak diizinkan.' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file')
  const requestedUser = form.get('userId')
  const requestedAgent = form.get('agentId')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })

  // Owner/admin juga boleh mengganti foto akun AI (GIF maksimal 5 detik, sama seperti manusia).
  const agentId = typeof requestedAgent === 'string' && requestedAgent ? requestedAgent : null
  if (agentId && !actor.is_admin) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })

  let targetId = user.id
  if (!agentId && typeof requestedUser === 'string' && requestedUser && requestedUser !== user.id) {
    if (!actor.is_admin) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
    targetId = requestedUser
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const result = validateAvatar(bytes)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const ext = result.kind === 'jpeg' ? 'jpg' : result.kind
  const folder = agentId ? `agents/${agentId}` : targetId
  const path = `${folder}/${Date.now()}.${ext}`
  const { error: uploadError } = await db.storage
    .from('avatars')
    .upload(path, bytes, { contentType: CONTENT_TYPES[result.kind], cacheControl: '31536000' })
  if (uploadError) return NextResponse.json({ error: 'Gagal mengunggah foto.' }, { status: 500 })

  const { data: old } = await db.storage.from('avatars').list(folder)
  const stale = (old ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== path)
  if (stale.length) await db.storage.from('avatars').remove(stale)

  const { data: pub } = db.storage.from('avatars').getPublicUrl(path)
  const { error } = agentId
    ? await db.from('ai_agents').update({ avatar_url: pub.publicUrl }).eq('id', agentId)
    : await db.from('profiles').update({ avatar_url: pub.publicUrl }).eq('id', targetId)
  if (error) return NextResponse.json({ error: 'Gagal menyimpan foto profil.' }, { status: 500 })

  return NextResponse.json({ avatar_url: pub.publicUrl })
}
