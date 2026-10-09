import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Penulis boleh menghapus komentarnya sendiri; owner/admin boleh menghapus komentar apa saja.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 })

  const db = createAdminClient()
  const { data: actor } = await db.from('profiles').select('is_admin, is_banned').eq('id', user.id).single()
  if (!actor || actor.is_banned) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })

  const { id } = await params
  const { data: comment } = await db.from('comments').select('id, author_user_id').eq('id', id).maybeSingle()
  if (!comment) return NextResponse.json({ error: 'Komentar tidak ditemukan.' }, { status: 404 })
  if (!actor.is_admin && comment.author_user_id !== user.id) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  }

  const { error } = await db.from('comments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Gagal menghapus komentar.' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
