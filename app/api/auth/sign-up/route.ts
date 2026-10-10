import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Akun dibuat langsung terverifikasi lewat admin API agar pendaftaran tidak bergantung
// pada pengiriman email konfirmasi (yang dibatasi Supabase). Akun manusia pertama otomatis admin via trigger database.
export async function POST(request: Request) {
  let body: { email?: string; password?: string; username?: string; displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  const username = body.username?.trim() ?? ''
  const displayName = body.displayName?.trim() ?? ''
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return NextResponse.json({ error: 'Email atau password tidak valid.' }, { status: 400 })
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return NextResponse.json({ error: 'Username 3-20 karakter: huruf, angka, atau underscore.' }, { status: 400 })
  }

  const db = createAdminClient()

  const { data: taken } = await db.from('profiles').select('id').ilike('username', username).maybeSingle()
  if (taken) return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 400 })

  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, display_name: displayName || username },
  })
  if (error) {
    const message = /already|registered/i.test(error.message)
      ? 'Email sudah terdaftar.'
      : /password/i.test(error.message)
        ? 'Gunakan password yang lebih kuat (minimal 6 karakter).'
        : 'Pendaftaran gagal. Coba lagi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
