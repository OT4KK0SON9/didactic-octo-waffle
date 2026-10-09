'use client'

import Link from 'next/link'
import useSWR from 'swr'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { FollowButton } from '@/components/cognifeed/follow-button'
import { createClient } from '@/lib/supabase/client'
import { profilePath, type AuthorInfo } from '@/lib/types'
import { cn } from '@/lib/utils'

interface Person {
  kind: 'user' | 'agent'
  id: string
  name: string
  username: string
  avatarUrl: string | null
  bio: string
}

// Daftar akun gabungan: manusia dan AI dicampur, tidak dipisah.
async function fetchPeople(): Promise<Person[]> {
  const supabase = createClient()
  const [profiles, agents] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, bio')
      .eq('is_banned', false)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('ai_agents').select('id, name, username, avatar_url, bio').eq('is_active', true),
  ])

  const people: Person[] = [
    ...(profiles.data ?? []).map((p) => ({
      kind: 'user' as const,
      id: p.id as string,
      name: p.display_name as string,
      username: p.username as string,
      avatarUrl: (p.avatar_url as string | null) ?? null,
      bio: (p.bio as string) ?? '',
    })),
    ...(agents.data ?? []).map((a) => ({
      kind: 'agent' as const,
      id: a.id as string,
      name: a.name as string,
      username: a.username as string,
      avatarUrl: (a.avatar_url as string | null) ?? null,
      bio: (a.bio as string) ?? '',
    })),
  ]
  return people.sort((a, b) => a.name.localeCompare(b.name, 'id'))
}

export function PeopleList({ className }: { className?: string }) {
  const { data: people } = useSWR('people', fetchPeople)

  return (
    <section aria-label="Jelajahi akun" className={cn('rounded-3xl border border-border bg-card p-4', className)}>
      <h2 className="mb-3 font-semibold">Jelajahi akun</h2>
      <ul className="space-y-3">
        {(people ?? []).map((person) => {
          const info: AuthorInfo = {
            isAI: person.kind === 'agent',
            name: person.name,
            username: person.username,
            avatarUrl: person.avatarUrl,
          }
          return (
            <li key={`${person.kind}:${person.id}`} className="flex items-center gap-2.5">
              <AuthorAvatar author={info} linked />
              <Link href={profilePath(person.username)} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold hover:underline">{person.name}</span>
                <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
                {person.bio && <span className="line-clamp-1 text-xs text-muted-foreground/80">{person.bio}</span>}
              </Link>
              <FollowButton target={{ kind: person.kind, id: person.id }} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
