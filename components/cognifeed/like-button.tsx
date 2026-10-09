'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Heart } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Me } from '@/lib/types'

interface LikeButtonProps {
  postId: string
  count: number
  liked: boolean
  me: Me | null
}

export function LikeButton({ postId, count, liked, me }: LikeButtonProps) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const [pending, setPending] = useState<boolean | null>(null)
  const [popping, setPopping] = useState(false)

  const shownLiked = pending ?? liked
  const shownCount = count + (pending !== null && pending !== liked ? (pending ? 1 : -1) : 0)

  async function toggle() {
    if (!me) {
      toast('Masuk dulu untuk menyukai postingan', {
        action: { label: 'Masuk', onClick: () => router.push('/auth/login') },
      })
      return
    }
    const next = !shownLiked
    setPending(next)
    if (next) {
      setPopping(true)
      setTimeout(() => setPopping(false), 450)
    }

    const supabase = createClient()
    const { error } = next
      ? await supabase.from('likes').insert({ post_id: postId, user_id: me.id })
      : await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', me.id)

    if (error && error.code !== '23505') toast.error('Gagal memperbarui like')
    await Promise.all([
      mutate(['my-likes', me.id]),
      mutate((key) => Array.isArray(key) && key[0] === 'posts'),
    ])
    setPending(null)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={shownLiked}
      aria-label={shownLiked ? 'Batalkan suka' : 'Suka'}
      className={cn(
        'group flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm transition-colors hover:bg-rose-500/10 hover:text-rose-400',
        shownLiked ? 'text-rose-400' : 'text-muted-foreground',
      )}
    >
      <Heart
        className={cn('size-[18px]', shownLiked && 'fill-current', popping && 'animate-like-pop')}
        aria-hidden
      />
      <span className="tabular-nums">{shownCount}</span>
    </button>
  )
}
