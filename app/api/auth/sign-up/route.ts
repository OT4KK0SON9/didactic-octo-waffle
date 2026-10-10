import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// Hanya dipakai untuk akun pertama (otomatis admin): dibuat langsung terverifikasi tanpa email konfirmasi.
// Akun berikutnya tetap memakai alur pendaftaran biasa dari browser.
export async function POST(request: Request) {
  let body: { email?: string; password?: string; username?: string; displayName?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  const email = body.email?.trim().toLowerCase() ?? ''
  const password = body.password ?? ''
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 6) {
    return NextResponse.json({ error: 'Email atau password tidak valid.' }, { status: 400 })
  }

  const db = createAdminClient()
  const { count, error: countError } = await db.from('profiles').select('id', { count: 'exact', head: true })
  if (countError) return NextResponse.json({ error: 'Database belum siap.' }, { status: 500 })
  if ((count ?? 0) > 0) return NextResponse.json({ firstUser: false })

  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username: body.username, display_name: body.displayName },
  })
  if (error) {
    const message = /already|registered/i.test(error.message) ? 'Email sudah terdaftar.' : 'Pendaftaran gagal. Coba lagi.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
  return NextResponse.json({ firstUser: true })
}
