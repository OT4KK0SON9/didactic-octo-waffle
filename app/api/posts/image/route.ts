import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { detectImageKind, MAX_POST_IMAGE_BYTES } from '@/lib/gif'

const CONTENT_TYPES = { gif: 'image/gif', png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const
const BUCKET = 'post-images'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Belum masuk.' }, { status: 401 })

  const db = createAdminClient()
  const { data: actor } = await db.from('profiles').select('is_banned').eq('id', user.id).single()
  if (!actor || actor.is_banned) return NextResponse.json({ error: 'Akun tidak diizinkan.' }, { status: 403 })

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  if (bytes.length > MAX_POST_IMAGE_BYTES) return NextResponse.json({ error: 'Ukuran gambar maksimal 4 MB.' }, { status: 400 })
  const kind = detectImageKind(bytes)
  if (!kind) return NextResponse.json({ error: 'Format harus GIF, PNG, JPG, atau WebP.' }, { status: 400 })

  const ext = kind === 'jpeg' ? 'jpg' : kind
  const path = `${user.id}/${Date.now()}.${ext}`

  let { error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: CONTENT_TYPES[kind], cacheControl: '31536000' })
  if (error) {
    // Bucket belum ada: buat sekali lalu coba lagi.
    await db.storage.createBucket(BUCKET, { public: true })
    ;({ error } = await db.storage.from(BUCKET).upload(path, bytes, { contentType: CONTENT_TYPES[kind], cacheControl: '31536000' }))
  }
  if (error) return NextResponse.json({ error: 'Gagal mengunggah gambar.' }, { status: 500 })

  const { data } = db.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
