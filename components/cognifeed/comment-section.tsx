'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { CornerDownRight, Send, X } from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AuthorAvatar, AuthorName } from '@/components/cognifeed/author'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/lib/hooks/use-realtime'
import { timeAgo } from '@/lib/time'
import { authorInfo, COMMENT_SELECT, type CommentItem, type Me } from '@/lib/types'
import { cn } from '@/lib/utils'

async function fetchComments(postId: string) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as CommentItem[]
}

interface Group {
  root: CommentItem
  replies: CommentItem[]
}

function groupComments(comments: CommentItem[]): Group[] {
  const byId = new Map(comments.map((c) => [c.id, c]))
  const rootOf = (c: CommentItem): CommentItem => {
    let cur = c
    while (cur.parent_id && byId.has(cur.parent_id)) cur = byId.get(cur.parent_id)!
    return cur
  }
  const groups = new Map<string, Group>()
  for (const c of comments) {
    const root = rootOf(c)
    if (!groups.has(root.id)) groups.set(root.id, { root, replies: [] })
    if (c.id !== root.id) groups.get(root.id)!.replies.push(c)
  }
  return [...groups.values()]
}

export function CommentSection({ postId, me }: { postId: string; me: Me | null }) {
  const { mutate: globalMutate } = useSWRConfig()
  const { data, isLoading, mutate } = useSWR(['comments', postId], () => fetchComments(postId))
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null)
  const [sending, setSending] = useState(false)

  useRealtimeRefresh(`comments:${postId}`, [{ table: 'comments', filter: `post_id=eq.${postId}` }], () => {
    mutate()
  })

  const comments = data ?? []
  const groups = useMemo(() => groupComments(comments), [comments])
  const byId = useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const content = text.trim()
    if (!content || !me) return
    setSending(true)
    const supabase = createClient()
    const { error } = await supabase.from('comments').insert({
      post_id: postId,
      parent_id: replyTo?.id ?? null,
      author_user_id: me.id,
      content,
    })
    setSending(false)
    if (error) {
      toast.error('Gagal mengirim komentar')
      return
    }
    setText('')
    setReplyTo(null)
    await mutate()
    globalMutate((key) => Array.isArray(key) && key[0] === 'posts')
  }

  async function removeComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      toast.error(body?.error ?? 'Gagal menghapus komentar')
      return
    }
    toast.success('Komentar dihapus')
    await mutate()
    globalMutate((key) => Array.isArray(key) && key[0] === 'posts')
  }

  function renderComment(c: CommentItem, nested: boolean) {
    const author = authorInfo(c)
    const parent = c.parent_id ? byId.get(c.parent_id) : null
    return (
      <li key={c.id} className={cn('flex gap-2.5', nested && 'ml-8')}>
        <AuthorAvatar author={author} size="sm" className="mt-0.5" linked />
        <div className="min-w-0 flex-1 rounded-2xl bg-secondary/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <AuthorName author={author} className="text-sm" />
            <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
          </div>
          {parent && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <CornerDownRight className="size-3" aria-hidden />
              membalas {authorInfo(parent).name}
            </p>
          )}
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{c.content}</p>
          {me && (
            <div className="mt-1 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setReplyTo(c)}
                className="text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                Balas
              </button>
              {(me.is_admin || c.author_user_id === me.id) && (
                <button
                  type="button"
                  onClick={() => removeComment(c.id)}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
                >
                  Hapus
                </button>
              )}
            </div>
          )}
        </div>
      </li>
    )
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      {isLoading ? (
        <div className="space-y-2" aria-busy>
          <div className="h-12 animate-pulse rounded-2xl bg-secondary/60" />
          <div className="ml-8 h-10 animate-pulse rounded-2xl bg-secondary/60" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">Belum ada komentar. Jadilah yang pertama.</p>
      ) : (
        <ul className="space-y-2.5">
          {groups.map((g) => (
            <li key={g.root.id}>
              <ul className="space-y-2.5">
                {renderComment(g.root, false)}
                {g.replies.map((r) => renderComment(r, true))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {me ? (
        <form onSubmit={submit} className="mt-3 space-y-2">
          {replyTo && (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-1.5 text-xs text-primary">
              <span className="truncate">Membalas {authorInfo(replyTo).name}</span>
              <button type="button" onClick={() => setReplyTo(null)} aria-label="Batalkan balasan">
                <X className="size-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              placeholder={replyTo ? 'Tulis balasan...' : 'Tulis komentar...'}
              aria-label="Komentar"
              className="h-9 rounded-full bg-secondary/60"
            />
            <Button type="submit" size="icon" disabled={sending || !text.trim()} aria-label="Kirim komentar" className="size-9 shrink-0 rounded-full">
              <Send className="size-4" />
            </Button>
          </div>
        </form>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>{' '}
          untuk ikut berkomentar.
        </p>
      )}
    </div>
  )
}
