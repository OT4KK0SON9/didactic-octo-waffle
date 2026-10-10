import { createAdminClient } from '@/lib/supabase/admin'
import { detectImageKind, MAX_POST_IMAGE_BYTES } from '@/lib/gif'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
const ALLOWED_LICENSES = ['public domain', 'cc0']
const MIME_BY_KIND = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const

type CommonsPage = {
  title?: string
  imageinfo?: Array<{
    thumburl?: string
    url?: string
    mime?: string
    extmetadata?: {
      LicenseShortName?: { value?: string }
      UsageTerms?: { value?: string }
    }
  }>
}

const STOP_WORDS = new Set([
  'yang', 'dan', 'atau', 'untuk', 'dari', 'dengan', 'pada', 'dalam', 'karena', 'kalau',
  'kamu', 'kita', 'kami', 'mereka', 'aku', 'saya', 'bisa', 'jadi', 'lebih', 'sangat',
  'sudah', 'belum', 'akan', 'juga', 'masih', 'bukan', 'tidak', 'nggak', 'enggak',
  'adalah', 'sebagai', 'tentang', 'sebuah', 'setiap', 'ketika', 'kalau', 'gimana',
  'kenapa', 'apakah', 'pernah', 'punya', 'pun', 'nih', 'sih', 'aja', 'kok', 'dong',
  'hari', 'pagi', 'malam', 'siang', 'sore', 'menurut', 'orang', 'hidup', 'rasanya',
])

function queryFromText(text: string): string {
  const words = text
    .toLocaleLowerCase('id-ID')
    .normalize('NFKC')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word) && !/^\d+$/.test(word))
  const unique = [...new Set(words)]
  return unique.slice(0, 5).join(' ')
}

function allowedLicense(page: CommonsPage): boolean {
  const info = page.imageinfo?.[0]
  const license = `${info?.extmetadata?.LicenseShortName?.value ?? ''} ${info?.extmetadata?.UsageTerms?.value ?? ''}`
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
  return ALLOWED_LICENSES.some((term) => license.includes(term))
}

/**
 * Find a thematically related, reusable image on Wikimedia Commons and copy it
 * into our own public post-images bucket. Only public-domain/CC0 results are
 * accepted, so the feed does not silently republish images with attribution or
 * share-alike requirements. Any failure is intentionally non-fatal to posting.
 */
export async function findAndStoreInternetImage(text: string, agentId: string): Promise<string | null> {
  const query = queryFromText(text)
  if (query.length < 3) return null

  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: query,
      gsrnamespace: '6',
      gsrlimit: '12',
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '1000',
      format: 'json',
      origin: '*',
    })
    const searchResponse = await fetch(`${COMMONS_API}?${params}`, {
      headers: { 'User-Agent': 'CogniFeed/1.0 (community social feed; image sourcing)' },
      signal: AbortSignal.timeout(5_000),
      cache: 'no-store',
    })
    if (!searchResponse.ok) return null
    const searchData = await searchResponse.json()
    const pages: CommonsPage[] = Object.values(searchData?.query?.pages ?? {}) as CommonsPage[]
    const candidates = pages.filter((page) => {
      const info = page.imageinfo?.[0]
      const url = info?.thumburl ?? info?.url ?? ''
      return allowedLicense(page) && /^https:\/\/upload\.wikimedia\.org\//i.test(url)
    })
    if (!candidates.length) return null

    // Try a few candidates in case a Commons thumbnail is unavailable or too large.
    for (const page of candidates.slice(0, 2)) {
      const info = page.imageinfo?.[0]
      const imageUrl = info?.thumburl ?? info?.url
      if (!imageUrl) continue
      const imageResponse = await fetch(imageUrl, {
        headers: { 'User-Agent': 'CogniFeed/1.0 (community social feed; image sourcing)' },
        signal: AbortSignal.timeout(5_000),
        cache: 'no-store',
      }).catch(() => null)
      if (!imageResponse?.ok) continue
      const declaredLength = Number(imageResponse.headers.get('content-length') ?? 0)
      if (declaredLength > MAX_POST_IMAGE_BYTES) continue
      const bytes = new Uint8Array(await imageResponse.arrayBuffer())
      if (!bytes.length || bytes.length > MAX_POST_IMAGE_BYTES) continue
      const kind = detectImageKind(bytes)
      if (!kind || kind === 'gif') continue
      const db = createAdminClient()
      const extension = kind === 'jpeg' ? 'jpg' : kind
      const path = `ai/${agentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`
      const { error } = await db.storage.from('post-images').upload(path, bytes, {
        contentType: MIME_BY_KIND[kind],
        cacheControl: '31536000',
        upsert: false,
      })
      if (error) continue
      return db.storage.from('post-images').getPublicUrl(path).data.publicUrl
    }
  } catch {
    // Image search is optional; do not prevent the text post from being created.
  }
  return null
}
