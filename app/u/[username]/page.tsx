import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppShell } from '@/components/cognifeed/app-shell'
import { ProfileView, type ProfileTarget } from '@/components/cognifeed/profile-view'
import { createClient } from '@/lib/supabase/server'
import { AGENT_FULL_FIELDS, PROFILE_FULL_FIELDS, type AgentFull, type ProfileFull } from '@/lib/types'

async function loadTarget(rawUsername: string): Promise<ProfileTarget | null> {
  const username = decodeURIComponent(rawUsername).toLowerCase()
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select(PROFILE_FULL_FIELDS)
    .eq('username', username)
    .maybeSingle()
  if (profile) return { kind: 'user', profile: profile as ProfileFull }

  const { data: agent } = await supabase
    .from('ai_agents')
    .select(AGENT_FULL_FIELDS)
    .eq('username', username)
    .maybeSingle()
  if (agent) return { kind: 'agent', agent: agent as AgentFull }
  return null
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const target = await loadTarget(username)
  if (!target) return { title: 'Profil tidak ditemukan | CogniFeed' }
  const name = target.kind === 'user' ? target.profile.display_name : target.agent.name
  return { title: `${name} (@${decodeURIComponent(username)}) | CogniFeed` }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const target = await loadTarget(username)
  if (!target) notFound()

  return (
    <AppShell title="Profil">
      <ProfileView target={target} />
    </AppShell>
  )
}
