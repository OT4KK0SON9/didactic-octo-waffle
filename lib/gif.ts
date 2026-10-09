export const MAX_AVATAR_BYTES = 2 * 1024 * 1024
export const MAX_GIF_SECONDS = 5
export const MAX_POST_IMAGE_BYTES = 4 * 1024 * 1024

export type ImageKind = 'gif' | 'png' | 'jpeg' | 'webp'

export function detectImageKind(buf: Uint8Array): ImageKind | null {
  if (buf.length < 12) return null
  const ascii = (start: number, end: number) => String.fromCharCode(...buf.subarray(start, end))
  if (ascii(0, 3) === 'GIF') return 'gif'
  if (buf[0] === 0x89 && ascii(1, 4) === 'PNG') return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg'
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  return null
}

function skipSubBlocks(buf: Uint8Array, start: number) {
  let pos = start
  while (pos < buf.length && buf[pos] !== 0) pos += buf[pos] + 1
  return pos + 1
}

export function gifDurationMs(buf: Uint8Array): number | null {
  if (buf.length < 14) return null
  let pos = 13
  const flags = buf[10]
  if (flags & 0x80) pos += 3 * (1 << ((flags & 7) + 1))

  let total = 0
  while (pos < buf.length) {
    const marker = buf[pos]
    if (marker === 0x3b) break
    if (marker === 0x21) {
      if (buf[pos + 1] === 0xf9) {
        const delay = buf[pos + 4] | (buf[pos + 5] << 8)
        total += delay < 2 ? 100 : delay * 10
      }
      pos = skipSubBlocks(buf, pos + 2)
    } else if (marker === 0x2c) {
      const packed = buf[pos + 9]
      pos += 10
      if (packed & 0x80) pos += 3 * (1 << ((packed & 7) + 1))
      pos = skipSubBlocks(buf, pos + 1)
    } else {
      return null
    }
  }
  return total
}

export function validateAvatar(buf: Uint8Array): { ok: true; kind: ImageKind } | { ok: false; error: string } {
  if (buf.length > MAX_AVATAR_BYTES) return { ok: false, error: 'Ukuran file maksimal 2 MB.' }
  const kind = detectImageKind(buf)
  if (!kind) return { ok: false, error: 'Format harus GIF, PNG, JPG, atau WebP.' }
  if (kind === 'gif') {
    const duration = gifDurationMs(buf)
    if (duration === null) return { ok: false, error: 'File GIF tidak valid.' }
    if (duration > MAX_GIF_SECONDS * 1000) {
      return { ok: false, error: `Durasi GIF maksimal ${MAX_GIF_SECONDS} detik (file ini ${(duration / 1000).toFixed(1)} detik).` }
    }
  }
  return { ok: true, kind }
}
