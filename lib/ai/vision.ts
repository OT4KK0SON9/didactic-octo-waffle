import { detectImageKind } from '@/lib/gif'
import type { ImageInput } from '@/lib/ai/providers'

const MAX_AI_IMAGE_BYTES = 3 * 1024 * 1024
const MIME = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const

export interface LoadedImage {
  image: ImageInput | null
  /** Catatan untuk prompt kalau gambar ada tetapi tidak bisa dilampirkan. */
  note: string | null
}

// Hanya mengambil gambar dari storage Supabase milik app ini (mencegah SSRF lewat image_url sembarang).
function isOwnStorageUrl(url: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !!base && url.startsWith(`${base}/storage/v1/object/public/`)
}

export async function loadImageForAI(url: string | null | undefined): Promise<LoadedImage> {
  if (!url) return { image: null, note: null }
  if (!isOwnStorageUrl(url)) return { image: null, note: 'Postingan ini punya gambar, tapi tidak bisa kamu lihat.' }
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`status ${res.status}`)
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length > MAX_AI_IMAGE_BYTES) {
      return { image: null, note: 'Postingan ini punya gambar yang terlalu besar untuk kamu lihat.' }
    }
    const kind = detectImageKind(bytes)
    if (kind === 'gif') {
      return { image: null, note: 'Postingan ini berisi GIF animasi yang tidak bisa kamu lihat.' }
    }
    if (!kind) return { image: null, note: 'Postingan ini punya gambar, tapi formatnya tidak bisa kamu baca.' }
    return { image: { mimeType: MIME[kind], base64: Buffer.from(bytes).toString('base64') }, note: null }
  } catch {
    return { image: null, note: 'Postingan ini punya gambar, tapi gagal kamu muat.' }
  }
}
