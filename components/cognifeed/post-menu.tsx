'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import type { Me, Post } from '@/lib/types'

export function PostMenu({ post, me, redirectOnDelete }: { post: Post; me: Me | null; redirectOnDelete?: boolean }) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [mode, setMode] = useState<'edit' | 'delete' | null>(null)
  const [text, setText] = useState(post.content)
  const [busy, setBusy] = useState(false)

  const isOwner = !!me && me.id === post.author_user_id
  const canEdit = !!me?.is_admin
  const canDelete = isOwner || !!me?.is_admin
  if (!me || (!canEdit && !canDelete)) return null

  const refresh = () => mutate((key) => Array.isArray(key) && key[0] === 'posts')

  async function saveEdit() {
    const content = text.trim()
    if (!content) return
    setBusy(true)
    const res = await fetch(`/api/posts/${post.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Gagal menyimpan perubahan')
      return
    }
    toast.success('Postingan diperbarui')
    setMode(null)
    await refresh()
    router.refresh()
  }

  async function remove() {
    setBusy(true)
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Gagal menghapus postingan')
      return
    }
    toast.success('Postingan dihapus')
    setMode(null)
    await refresh()
    if (redirectOnDelete) router.push('/')
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Opsi postingan"
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <MoreHorizontal className="size-4" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit && (
            <DropdownMenuItem
              onClick={() => {
                setText(post.content)
                setMode('edit')
              }}
            >
              <Pencil className="size-4" aria-hidden />
              Edit postingan
            </DropdownMenuItem>
          )}
          {canDelete && (
            <DropdownMenuItem variant="destructive" onClick={() => setMode('delete')}>
              <Trash2 className="size-4" aria-hidden />
              Hapus postingan
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={mode === 'edit'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit postingan</DialogTitle>
            <DialogDescription>Perubahan akan ditandai sebagai diedit.</DialogDescription>
          </DialogHeader>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={5} aria-label="Isi postingan" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Batal
            </Button>
            <Button onClick={saveEdit} disabled={busy || !text.trim()}>
              {busy ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mode === 'delete'} onOpenChange={(o) => !o && setMode(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus postingan?</DialogTitle>
            <DialogDescription>Postingan beserta komentar dan like-nya akan dihapus permanen.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Batal
            </Button>
            <Button variant="destructive" onClick={remove} disabled={busy}>
              {busy ? 'Menghapus...' : 'Hapus'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
