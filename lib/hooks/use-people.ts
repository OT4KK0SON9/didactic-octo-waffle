'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { AuthorInfo } from '@/lib/types'

export interface Person {
  kind: 'user' | 'agent'
  id: string
  name: string
  username: string
  avatarUrl: string | null
  bio: string
  reason?: string
}

export function personKey(person: Pick<Person, 'kind' | 'id'>) {
  return `${person.kind}:${person.id}`
}

export function personAuthor(person: Person): AuthorInfo {
  return { isAI: person.kind === 'agent', name: person.name, username: person.username, avatarUrl: person.avatarUrl }
}

const PROFILE_COLS = 'id, username, display_name, avatar_url, bio'
const AGENT_COLS = 'id, name, username, avatar_url, bio'

interface ProfileRow {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  bio: string | null
}
interface AgentRow {
  id: string
  name: string
  username: string
  avatar_url: string | null
  bio: string | null
}

export function fromProfile(p: ProfileRow, reason?: string): Person {
  return { kind: 'user', id: p.id, name: p.display_name, username: p.username, avatarUrl: p.avatar_url, bio: p.bio ?? '', reason }
}
export function fromAgent(a: AgentRow, reason?: string): Person {
  return { kind: 'agent', id: a.id, name: a.name, username: a.username, avatarUrl: a.avatar_url, bio: a.bio ?? '', reason }
}

export async function fetchPeopleByIds(userIds: string[], agentIds: string[]): Promise<Person[]> {
  const supabase = createClient()
  const [users, agents] = await Promise.all([
    userIds.length ? supabase.from('profiles').select(PROFILE_COLS).in('id', userIds) : Promise.resolve({ data: [] }),
    agentIds.length ? supabase.from('ai_agents').select(AGENT_COLS).in('id', agentIds) : Promise.resolve({ data: [] }),
  ])
  return [
    ...((users.data ?? []) as ProfileRow[]).map((p) => fromProfile(p)),
    ...((agents.data ?? []) as AgentRow[]).map((a) => fromAgent(a)),
  ]
}

export async function fetchPersonByUsername(username: string): Promise<Person | null> {
  const supabase = createClient()
  const [user, agent] = await Promise.all([
    supabase.from('profiles').select(PROFILE_COLS).ilike('username', username).eq('is_banned', false).maybeSingle(),
    supabase.from('ai_agents').select(AGENT_COLS).ilike('username', username).eq('is_active', true).maybeSingle(),
  ])
  if (user.data) return fromProfile(user.data as ProfileRow)
  if (agent.data) return fromAgent(agent.data as AgentRow)
  return null
}

export async function searchPeople(query: string, meId?: string): Promise<Person[]> {
  const term = query.trim().replace(/[%*,()\\]/g, ' ').trim()
  if (!term) return []
  const supabase = createClient()
  let userQuery = supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('is_banned', false)
    .or(`username.ilike.*${term}*,display_name.ilike.*${term}*`)
    .limit(20)
  if (meId) userQuery = userQuery.neq('id', meId)
  const [users, agents] = await Promise.all([
    userQuery,
    supabase
      .from('ai_agents')
      .select(AGENT_COLS)
      .eq('is_active', true)
      .or(`username.ilike.*${term}*,name.ilike.*${term}*`)
      .limit(20),
  ])
  const lower = term.toLowerCase()
  const rank = (p: Person) =>
    p.username.toLowerCase() === lower ? 0 : p.username.toLowerCase().startsWith(lower) || p.name.toLowerCase().startsWith(lower) ? 1 : 2
  return [
    ...((users.data ?? []) as ProfileRow[]).map((p) => fromProfile(p)),
    ...((agents.data ?? []) as AgentRow[]).map((a) => fromAgent(a)),
  ].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'id'))
}

// Saran teman: teman dari teman, akun yang mengikuti kamu, lalu akun AI dan anggota baru.
async function fetchSuggestions(meId: string | null): Promise<Person[]> {
  const supabase = createClient()
  let profileQuery = supabase
    .from('profiles')
    .select(PROFILE_COLS)
    .eq('is_banned', false)
    .order('created_at', { ascending: false })
    .limit(60)
  if (meId) profileQuery = profileQuery.neq('id', meId)

  const [profiles, agents, myFollows, followers] = await Promise.all([
    profileQuery,
    supabase.from('ai_agents').select(AGENT_COLS).eq('is_active', true),
    meId
      ? supabase.from('follows').select('followee_user_id, followee_agent_id').eq('follower_id', meId)
      : Promise.resolve({ data: [] }),
    meId ? supabase.from('follows').select('follower_id').eq('followee_user_id', meId) : Promise.resolve({ data: [] }),
  ])

  const followedUsers = new Set<string>()
  const followedAgents = new Set<string>()
  for (const f of (myFollows.data ?? []) as { followee_user_id: string | null; followee_agent_id: string | null }[]) {
    if (f.followee_user_id) followedUsers.add(f.followee_user_id)
    if (f.followee_agent_id) followedAgents.add(f.followee_agent_id)
  }
  const followsMe = new Set(((followers.data ?? []) as { follower_id: string }[]).map((f) => f.follower_id))

  const mutual = new Map<string, number>()
  if (followedUsers.size) {
    const { data } = await supabase
      .from('follows')
      .select('followee_user_id')
      .in('follower_id', [...followedUsers])
      .not('followee_user_id', 'is', null)
    for (const row of (data ?? []) as { followee_user_id: string }[]) {
      mutual.set(row.followee_user_id, (mutual.get(row.followee_user_id) ?? 0) + 1)
    }
  }

  const scored: { person: Person; score: number }[] = []
  ;((profiles.data ?? []) as ProfileRow[]).forEach((p, index) => {
    if (followedUsers.has(p.id)) return
    const common = mutual.get(p.id) ?? 0
    const back = followsMe.has(p.id)
    const reason = back ? 'Mengikuti kamu' : common > 0 ? `Diikuti ${common} akun yang kamu ikuti` : 'Anggota baru'
    scored.push({ person: fromProfile(p, reason), score: common * 10 + (back ? 20 : 0) + Math.max(0, 5 - index * 0.1) })
  })
  ;((agents.data ?? []) as AgentRow[]).forEach((a) => {
    if (followedAgents.has(a.id)) return
    scored.push({ person: fromAgent(a, 'Akun AI yang aktif berinteraksi'), score: 3 })
  })
  return scored.sort((a, b) => b.score - a.score).map((s) => s.person)
}

export function useSuggestions(meId: string | null | undefined) {
  return useSWR(meId === undefined ? null : ['suggestions', meId], () => fetchSuggestions(meId ?? null), {
    revalidateOnFocus: false,
  })
}

export function usePeopleSearch(query: string, meId?: string) {
  const term = query.trim()
  return useSWR(term ? ['people-search', term, meId] : null, () => searchPeople(term, meId), {
    keepPreviousData: true,
  })
}
