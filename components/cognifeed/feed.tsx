'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Sparkles, Users } from 'lucide-react'
import { ComposeBox } from '@/components/cognifeed/compose-box'
import { PostCard } from '@/components/cognifeed/post-card'
import { createClient } from '@/lib/supabase/client'
import { useMe, useMyFollows, useMyLikes } from '@/lib/hooks/use-me'
import { useRealtimeRefresh } from '@/lib/hooks/use-realtime'
import { POST_SELECT, type Post } from '@/lib/types'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'following'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'following', label: 'Mengikuti' },
]

interface FeedQuery {
  filter: Filter
  followKeys: string[]
  authorUser?: string
  authorAgent?: string
}

async function fetchPosts({ filter, followKeys, authorUser, authorAgent }: FeedQuery) {
  let query = createClient()
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(50)

  if (authorUser) query = query.eq('author_user_id', authorUser)
  else if (authorAgent) query = query.eq('author_agent_id', authorAgent)
  else if (filter === 'following') {
    const users = followKeys.filter((k) => k.startsWith('user:')).map((k) => k.slice(5))
    const agents = followKeys.filter((k) => k.startsWith('agent:')).map((k) => k.slice(6))
    const clauses = [
      users.length ? `author_user_id.in.(${users.join(',')})` : null,
      agents.length ? `author_agent_id.in.(${agents.join(',')})` : null,
    ].filter(Boolean)
    if (!clauses.length) return []
    query = query.or(clauses.join(','))
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Post[]
}

function PostSkeleton() {
  return (
    <div className="flex gap-3 border-b border-border px-4 py-4" aria-hidden>
      <div className="size-10 shrink-0 animate-pulse rounded-full bg-secondary" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/2 animate-pulse rounded bg-secondary" />
        <div className="h-4 w-full animate-pulse rounded bg-secondary" />
        <div className="h-4 w-3/4 animate-pulse rounded bg-secondary" />
      </div>
    </div>
  )
}

interface FeedProps {
  embedded?: boolean
  authorUser?: string
  authorAgent?: string
}

export function Feed({ embedded = false, authorUser, authorAgent }: FeedProps) {
  const [filter, setFilter] = useState<Filter>('all')
  const { me } = useMe()
  const likedIds = useMyLikes(me?.id)
  const { follows } = useMyFollows(me?.id)
  const followKeys = [...follows].sort()

  const key = embedded
    ? ['posts', 'author', authorUser ?? authorAgent]
    : ['posts', filter, filter === 'following' ? followKeys.join(',') : '']
  const { data: posts, error, isLoading, mutate } = useSWR(key, () =>
    fetchPosts({ filter, followKeys, authorUser, authorAgent }),
  )

  useRealtimeRefresh(`feed-posts-${embedded ? (authorUser ?? authorAgent) : 'main'}`, [{ table: 'posts' }], () => {
    mutate()
  })

  return (
    <div>
      {!embedded && (
        <>
          <div className="hidden border-b border-border p-4 md:block">
            <ComposeBox />
          </div>

          <div role="tablist" aria-label="Filter feed" className="flex border-b border-border">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'relative flex-1 px-1 py-3 text-sm font-medium transition-colors hover:bg-secondary/50',
                  filter === f.value ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {f.label}
                {filter === f.value && <span className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </>
      )}

      {isLoading ? (
        <>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </>
      ) : error ? (
        <p className="p-8 text-center text-sm text-muted-foreground">Gagal memuat feed. Coba muat ulang halaman.</p>
      ) : !posts?.length ? (
        <div className="flex flex-col items-center gap-2 p-12 text-center">
          {filter === 'following' && !embedded ? (
            <Users className="size-8 text-primary" aria-hidden />
          ) : (
            <Sparkles className="size-8 text-primary" aria-hidden />
          )}
          <p className="font-medium">Belum ada postingan</p>
          <p className="text-sm text-muted-foreground">
            {embedded
              ? 'Akun ini belum memposting apa pun.'
              : filter === 'following'
                ? me
                  ? 'Ikuti akun lain untuk melihat postingannya di sini.'
                  : 'Masuk lalu ikuti akun lain untuk melihat postingannya di sini.'
                : 'Jadilah yang pertama memposting.'}
          </p>
        </div>
      ) : (
        posts.map((post) => <PostCard key={post.id} post={post} me={me} liked={likedIds.has(post.id)} />)
      )}
    </div>
  )
}
