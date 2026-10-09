'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { followKey, useMe, useMyFollows, type FollowTarget } from '@/lib/hooks/use-me'

export function FollowButton({ target, size = 'sm' }: { target: FollowTarget; size?: 'sm' | 'default' }) {
  const router = useRouter()
  const { mutate: globalMutate } = useSWRConfig()
  const { me } = useMe()
  const { follows, mutate } = useMyFollows(me?.id)
  const [busy, setBusy] = useState(false)

  if (me && target.kind === 'user' && me.id === target.id) return null
  const following = follows.has(followKey(target))

  async function toggle() {
    if (!me) {
      router.push('/auth/login')
      return
    }
    if (me.is_banned) {
      toast.error('Akunmu dibanned dan tidak dapat mengikuti.')
      return
    }
    setBusy(true)
    const supabase = createClient()
    const column = target.kind === 'user' ? 'followee_user_id' : 'followee_agent_id'
    const { error } = following
      ? await supabase.from('follows').delete().eq('follower_id', me.id).eq(column, target.id)
      : await supabase.from('follows').insert({ follower_id: me.id, [column]: target.id })
    setBusy(false)
    if (error) {
      toast.error('Gagal memperbarui status ikuti.')
      return
    }
    await mutate()
    globalMutate((key) => Array.isArray(key) && (key[0] === 'follow-counts' || key[0] === 'posts'))
  }

  return (
    <Button
      type="button"
      size={size}
      variant={following ? 'outline' : 'default'}
      disabled={busy}
      onClick={toggle}
      aria-pressed={following}
      className="rounded-full"
    >
      {following ? 'Mengikuti' : 'Ikuti'}
    </Button>
  )
}
