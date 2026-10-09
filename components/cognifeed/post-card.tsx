'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Share2 } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { AuthorAvatar, AuthorName } from '@/components/cognifeed/author'
import { CommentSection } from '@/components/cognifeed/comment-section'
import { LikeButton } from '@/components/cognifeed/like-button'
import { PostMenu } from '@/components/cognifeed/post-menu'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/time'
import { authorInfo, type Me, type Post } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PostCardProps {
  post: Post
  me: Me | null
  liked: boolean
  defaultOpen?: boolean
}

export function PostCard({ post, me, liked, defaultOpen = false }: PostCardProps) {
  const { mutate } = useSWRConfig()
  const [open, setOpen] = useState(defaultOpen)
  const author = authorInfo(post)

  async function share() {
    const url = `${window.location.origin}/post/${post.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: `${author.name} di CogniFeed`, text: post.content, url })
      } else {
        await navigator.clipboard.writeText(url)
        toast.success('Tautan postingan disalin')
      }
    } catch {
      return
    }
    if (me) {
      await createClient().rpc('increment_share_count', { p_post_id: post.id })
      mutate((key) => Array.isArray(key) && key[0] === 'posts')
    }
  }

  return (
    <article className="border-b border-border px-4 py-4 transition-colors">
      <div className="flex gap-3">
        <AuthorAvatar author={author} size="lg" className="mt-0.5" linked />
        <div className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <AuthorName author={author} />
            <span className="truncate text-sm text-muted-foreground">
              @{author.username}
              {' \u00b7 '}
              <Link href={`/post/${post.id}`} className="hover:underline">
                {timeAgo(post.created_at)}
              </Link>
              {post.edited_at && ' \u00b7 diedit'}
            </span>
            <PostMenu post={post} me={me} redirectOnDelete={defaultOpen} />
          </header>

          <p className="mt-1.5 whitespace-pre-wrap break-words text-[15px] leading-relaxed">
            {post.content}
          </p>

          {post.image_url && (
            <a href={post.image_url} target="_blank" rel="noopener noreferrer" className="mt-2 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image_url}
                alt={`Gambar dari ${author.name}`}
                loading="lazy"
                className="max-h-[420px] w-full rounded-2xl border border-border object-cover"
              />
            </a>
          )}

          <div className="-ml-2 mt-2 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label="Komentar"
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-primary/10 hover:text-primary',
                open ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <MessageCircle className="size-[18px]" aria-hidden />
              <span className="tabular-nums">{post.comment_count}</span>
            </button>
            <LikeButton postId={post.id} count={post.like_count} liked={liked} me={me} />
            <button
              type="button"
              onClick={share}
              aria-label="Bagikan"
              className="flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-chart-1/10 hover:text-chart-1"
            >
              <Share2 className="size-[18px]" aria-hidden />
              <span className="tabular-nums">{post.share_count}</span>
            </button>
          </div>

          {open && <CommentSection postId={post.id} me={me} />}
        </div>
      </div>
    </article>
  )
}
