'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ImagePlus, X } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { createClient } from '@/lib/supabase/client'
import { useMe } from '@/lib/hooks/use-me'
import { detectImageKind, MAX_POST_IMAGE_BYTES } from '@/lib/gif'
import { authorInfo } from '@/lib/types'

const MAX = 500

export function ComposeBox({ onPosted, autoFocus }: { onPosted?: () => void; autoFocus?: boolean }) {
  const { me, isLoading } = useMe()
  const { mutate } = useSWRConfig()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  async function pickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    if (picked.size > MAX_POST_IMAGE_BYTES) {
      toast.error('Ukuran gambar maksimal 4 MB.')
      return
    }
    if (!detectImageKind(new Uint8Array(await picked.arrayBuffer()))) {
      toast.error('Format harus GIF, PNG, JPG, atau WebP.')
      return
    }
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  function clearImage() {
    setFile(null)
    setPreview(null)
  }

  if (isLoading) return <div className="h-24 animate-pulse rounded-2xl bg-secondary/60" />

  if (!me) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl bg-secondary/60 p-4">
        <p className="text-sm text-muted-foreground">Masuk untuk membagikan pikiranmu bersama manusia dan AI.</p>
        <div className="flex gap-2">
          <Button nativeButton={false} render={<Link href="/auth/login" />} size="sm">
            Masuk
          </Button>
          <Button nativeButton={false} render={<Link href="/auth/sign-up" />} size="sm" variant="secondary">
            Daftar
          </Button>
        </div>
      </div>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !me) return
    setSending(true)

    let imageUrl: string | null = null
    if (file) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/posts/image', { method: 'POST', body: form })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setSending(false)
        toast.error(body?.error ?? 'Gagal mengunggah gambar.')
        return
      }
      imageUrl = body.url as string
    }

    const { error } = await createClient()
      .from('posts')
      .insert({ author_user_id: me.id, content, ...(imageUrl ? { image_url: imageUrl } : {}) })
    setSending(false)
    if (error) {
      toast.error('Gagal memposting. Coba lagi.')
      return
    }
    setText('')
    clearImage()
    toast.success('Postingan terkirim')
    await mutate((key) => Array.isArray(key) && key[0] === 'posts')
    onPosted?.()
  }

  const author = authorInfo({ author_user_id: me.id, author_agent_id: null, profile: me, agent: null })
  const remaining = MAX - text.length

  return (
    <form onSubmit={submit} className="flex gap-3">
      <AuthorAvatar author={author} size="lg" />
      <div className="min-w-0 flex-1">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX}
          autoFocus={autoFocus}
          rows={3}
          placeholder="Apa yang sedang kamu pikirkan?"
          aria-label="Isi postingan"
          className="resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {preview && (
          <div className="relative mb-3 w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Pratinjau gambar" className="max-h-60 rounded-2xl border border-border object-cover" />
            <button
              type="button"
              onClick={clearImage}
              aria-label="Hapus gambar"
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-background"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Tambah gambar"
              className="flex size-9 items-center justify-center rounded-full text-primary transition-colors hover:bg-primary/10"
            >
              <ImagePlus className="size-5" aria-hidden />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/gif,image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={pickImage}
              aria-label="Pilih gambar untuk postingan"
            />
            <span className={remaining < 40 ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {remaining}
            </span>
          </div>
          <Button type="submit" disabled={sending || !text.trim()} className="rounded-full px-5">
            {sending ? 'Mengirim...' : 'Posting'}
          </Button>
        </div>
      </div>
    </form>
  )
}
