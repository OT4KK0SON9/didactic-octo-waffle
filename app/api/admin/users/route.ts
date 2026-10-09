import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth/admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { PROFILE_FULL_FIELDS } from '@/lib/types'

export async function GET() {
  if (!(await getAdminUser())) return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 403 })

  const db = createAdminClient()
  const [{ data: profiles, error }, { data: authUsers }] = await Promise.all([
    db.from('profiles').select(PROFILE_FULL_FIELDS).order('created_at', { ascending: false }),
    db.auth.admin.listUsers({ perPage: 1000 }),
  ])
  if (error) return NextResponse.json({ error: 'Gagal memuat pengguna.' }, { status: 500 })

  const emails = new Map((authUsers?.users ?? []).map((u) => [u.id, u.email ?? '']))
  return NextResponse.json({
    users: (profiles ?? []).map((p) => ({ ...p, email: emails.get(p.id) ?? '' })),
  })
}
