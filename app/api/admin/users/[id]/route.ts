import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'

interface Body {
  display_name?: string
  username?: string
  bio?: string
  is_banned?: boolean
  ban_reason?: string
  reset_avatar?: boolean
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })
  const { id } = await params

  let body: Body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data: target } = await db.from('profiles').select('id, username, is_admin').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'Pengguna tidak ditemukan.' }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (typeof body.display_name === 'string') {
    const name = body.display_name.trim()
    if (!name || name.length > 40) return NextResponse.json({ error: 'Nama tampilan 1-40 karakter.' }, { status: 400 })
    update.display_name = name
  }
  if (typeof body.username === 'string') {
    const username = body.username.trim().toLowerCase()
    // Owner/admin bebas; akun biasa minimal 3 karakter.
    const rule = target.is_admin ? /^[a-z0-9_]{1,30}$/ : /^[a-z0-9_]{3,20}$/
    if (!rule.test(username)) {
      return NextResponse.json(
        {
          error: target.is_admin
            ? 'Username hanya huruf kecil, angka, dan underscore.'
            : 'Username 3-20 karakter: huruf kecil, angka, atau underscore.',
        },
        { status: 400 },
      )
    }
    const { data: agentClash } = await db.from('ai_agents').select('id').eq('username', username).maybeSingle()
    if (agentClash) return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 400 })
    update.username = username
  }
  if (typeof body.bio === 'string') {
    if (body.bio.length > 160) return NextResponse.json({ error: 'Bio maksimal 160 karakter.' }, { status: 400 })
    update.bio = body.bio
  }
  if (body.reset_avatar) {
    update.avatar_url = `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent((update.username as string) ?? target.username)}`
  }

  if (typeof body.is_banned === 'boolean') {
    if (target.is_admin || target.id === admin.id) {
      return NextResponse.json({ error: 'Akun owner/admin tidak dapat dibanned.' }, { status: 400 })
    }
    update.is_banned = body.is_banned
    update.ban_reason = body.is_banned ? (body.ban_reason ?? '').slice(0, 200) || null : null
    update.banned_at = body.is_banned ? new Date().toISOString() : null
    const { error: banError } = await db.auth.admin.updateUserById(id, {
      ban_duration: body.is_banned ? '876000h' : 'none',
    })
    if (banError) return NextResponse.json({ error: 'Gagal mengubah status ban.' }, { status: 500 })
  }

  if (Object.keys(update).length === 0) return NextResponse.json({ ok: true })

  const { error } = await db.from('profiles').update(update).eq('id', id)
  if (error) {
    const message = error.code === '23505' ? 'Username sudah dipakai.' : error.message
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
