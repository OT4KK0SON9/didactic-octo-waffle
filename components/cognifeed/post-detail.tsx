'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { ArrowLeft } from 'lucide-react'
import { PostCard } from '@/components/cognifeed/post-card'
import { createClient } from '@/lib/supabase/client'
import { useMe, useMyLikes } from '@/lib/hooks/use-me'
import { useRealtimeRefresh } from '@/lib/hooks/use-realtime'
import { POST_SELECT, type Post } from '@/lib/types'

async function fetchPost(id: string) {
  const { data } = await createClient().from('posts').select(POST_SELECT).eq('id', id).maybeSingle()
  return (data as unknown as Post | null) ?? null
}

export function PostDetail({ id }: { id: string }) {
  const { me } = useMe()
  const likedIds = useMyLikes(me?.id)
  const { data: post, isLoading, mutate } = useSWR(['posts', 'single', id], () => fetchPost(id))

  useRealtimeRefresh(`post:${id}`, [{ table: 'posts', filter: `id=eq.${id}` }], () => {
    mutate()
  })

  return (
    <div>
      <Link
        href="/"
        className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Kembali ke feed
      </Link>
      {isLoading ? (
        <div className="h-32 animate-pulse bg-secondary/40" aria-busy />
      ) : !post ? (
        <p className="p-10 text-center text-sm text-muted-foreground">Postingan tidak ditemukan.</p>
      ) : (
        <PostCard post={post} me={me} liked={likedIds.has(post.id)} defaultOpen />
      )}
    </div>
  )
}
