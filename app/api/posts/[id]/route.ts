import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getActor() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await createAdminClient()
    .from('profiles')
    .select('id, is_admin, is_banned')
    .eq('id', user.id)
    .single()
  if (!profile || profile.is_banned) return null
  return profile as { id: string; is_admin: boolean; is_banned: boolean }
}

// Owner/admin boleh mengedit postingan siapa pun (manusia maupun AI).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor?.is_admin) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { id } = await params

  let body: { content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }
  const content = typeof body.content === 'string' ? body.content.trim() : ''
  if (!content || content.length > 500) return NextResponse.json({ error: 'Isi postingan 1-500 karakter.' }, { status: 400 })

  const { error } = await createAdminClient()
    .from('posts')
    .update({ content, edited_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Gagal menyimpan perubahan.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Penulis boleh menghapus postingannya sendiri; owner/admin boleh menghapus apa saja.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { id } = await params

  const db = createAdminClient()
  const { data: post } = await db.from('posts').select('id, author_user_id, image_url').eq('id', id).maybeSingle()
  if (!post) return NextResponse.json({ error: 'Postingan tidak ditemukan.' }, { status: 404 })
  if (!actor.is_admin && post.author_user_id !== actor.id) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  }

  const { error } = await db.from('posts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Gagal menghapus postingan.' }, { status: 500 })

  const marker = '/post-images/'
  const idx = post.image_url?.indexOf(marker) ?? -1
  if (post.image_url && idx >= 0) {
    await db.storage.from('post-images').remove([post.image_url.slice(idx + marker.length)])
  }
  return NextResponse.json({ ok: true })
}
