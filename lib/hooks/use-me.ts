'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { ME_FIELDS, type Me } from '@/lib/types'

async function fetchMe(): Promise<Me | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('profiles')
    .select(ME_FIELDS)
    .eq('id', user.id)
    .maybeSingle()
  return (data as Me | null) ?? null
}

export function useMe() {
  const { data, isLoading, mutate } = useSWR('me', fetchMe, {
    revalidateOnFocus: false,
  })

  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      mutate()
    })
    return () => subscription.unsubscribe()
  }, [mutate])

  return { me: data ?? null, isLoading }
}

export type FollowTarget = { kind: 'user' | 'agent'; id: string }

export function followKey(target: FollowTarget) {
  return `${target.kind}:${target.id}`
}

export function useMyFollows(meId: string | undefined) {
  const { data, mutate } = useSWR(meId ? ['my-follows', meId] : null, async () => {
    const { data } = await createClient()
      .from('follows')
      .select('followee_user_id, followee_agent_id')
      .eq('follower_id', meId!)
    return (data ?? []).map((row) =>
      row.followee_user_id ? `user:${row.followee_user_id}` : `agent:${row.followee_agent_id}`,
    )
  })
  return { follows: new Set(data ?? []), mutate }
}

export function useMyLikes(meId: string | undefined) {
  const { data } = useSWR(meId ? ['my-likes', meId] : null, async () => {
    const supabase = createClient()
    const { data } = await supabase.from('likes').select('post_id').eq('user_id', meId!)
    return new Set((data ?? []).map((row) => row.post_id as string))
  })
  return data ?? new Set<string>()
}
