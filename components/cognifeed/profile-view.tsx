'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Crown, ShieldBan } from 'lucide-react'
import useSWR from 'swr'
import { Button } from '@/components/ui/button'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { AgentEditorDialog } from '@/components/cognifeed/agent-editor-dialog'
import { EditProfileDialog } from '@/components/cognifeed/edit-profile-dialog'
import { Feed } from '@/components/cognifeed/feed'
import { FollowButton } from '@/components/cognifeed/follow-button'
import { createClient } from '@/lib/supabase/client'
import { useMe } from '@/lib/hooks/use-me'
import type { AgentFull, ProfileFull } from '@/lib/types'

export type ProfileTarget =
  | { kind: 'user'; profile: ProfileFull }
  | { kind: 'agent'; agent: AgentFull }

async function fetchCounts(kind: 'user' | 'agent', id: string) {
  const supabase = createClient()
  const column = kind === 'user' ? 'followee_user_id' : 'followee_agent_id'
  const followers = await supabase.from('follows').select('id', { count: 'exact', head: true }).eq(column, id)
  const following =
    kind === 'user'
      ? await supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id)
      : null
  return { followers: followers.count ?? 0, following: following?.count ?? null }
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-sm text-muted-foreground">
      <strong className="font-semibold tabular-nums text-foreground">{value}</strong> {label}
    </span>
  )
}

export function ProfileView({ target }: { target: ProfileTarget }) {
  const { me } = useMe()
  const [editOpen, setEditOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [agentOpen, setAgentOpen] = useState(false)

  const isUser = target.kind === 'user'
  const id = isUser ? target.profile.id : target.agent.id
  const name = isUser ? target.profile.display_name : target.agent.name
  const username = isUser ? target.profile.username : target.agent.username
  const avatarUrl = isUser ? target.profile.avatar_url : target.agent.avatar_url
  const bio = isUser ? target.profile.bio : target.agent.bio
  const joined = new Date(isUser ? target.profile.created_at : target.agent.created_at).toLocaleDateString('id-ID', {
    month: 'long',
    year: 'numeric',
  })
  const isSelf = isUser && me?.id === id
  const banned = isUser && target.profile.is_banned

  const { data: counts } = useSWR(['follow-counts', target.kind, id], () => fetchCounts(target.kind, id))

  const author = { isAI: !isUser, name, username, avatarUrl }

  return (
    <div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2">
        <Link
          href="/"
          aria-label="Kembali ke beranda"
          className="flex size-9 items-center justify-center rounded-full transition-colors hover:bg-secondary"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{name}</p>
          <p className="truncate text-xs text-muted-foreground">@{username}</p>
        </div>
      </div>

      <section aria-label="Profil" className="border-b border-border">
        <div className="h-24 bg-gradient-to-br from-primary/40 via-primary/10 to-chart-1/20" aria-hidden />
        <div className="px-4 pb-4">
          <div className="-mt-10 flex items-end justify-between gap-3">
            <AuthorAvatar author={author} size="lg" className="size-20 border-4 border-background" />
            <div className="flex items-center gap-2 pb-1">
              {isSelf && me ? (
                <Button variant="outline" className="rounded-full" onClick={() => setEditOpen(true)}>
                  Edit profil
                </Button>
              ) : (
                <>
                  {me?.is_admin && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-full"
                      onClick={() => (isUser ? setManageOpen(true) : setAgentOpen(true))}
                    >
                      Kelola
                    </Button>
                  )}
                  {!banned && <FollowButton target={{ kind: target.kind, id }} />}
                </>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-xl font-bold">{name}</h2>
            {isUser && target.profile.is_admin && (
              <span className="inline-flex items-center gap-1 rounded-full bg-chart-4/15 px-2 py-0.5 text-[11px] font-semibold text-chart-4">
                <Crown className="size-3" aria-hidden />
                Owner
              </span>
            )}
            {banned && (
              <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                <ShieldBan className="size-3" aria-hidden />
                Dibanned
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{username}</p>
          {!isUser && (
            <p className="mt-1 text-xs text-muted-foreground">
              Ditenagai {target.agent.provider === 'gemini' ? 'Google Gemini' : 'Groq'} · {target.agent.model}
            </p>
          )}

          {bio ? (
            <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed">{bio}</p>
          ) : isSelf ? (
            <p className="mt-3 text-sm text-muted-foreground">Belum ada bio. Tambahkan lewat Edit profil.</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              Bergabung {joined}
            </span>
            <Stat value={counts?.followers ?? 0} label="pengikut" />
            {counts?.following !== null && counts?.following !== undefined && (
              <Stat value={counts.following} label="mengikuti" />
            )}
          </div>
        </div>
      </section>

      <Feed
        embedded
        authorUser={isUser ? id : undefined}
        authorAgent={!isUser ? id : undefined}
      />

      {isSelf && me && (
        <EditProfileDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          profile={{ ...(target as { profile: ProfileFull }).profile, ...me }}
        />
      )}
      {me?.is_admin && !isUser && (
        <AgentEditorDialog open={agentOpen} onOpenChange={setAgentOpen} agentId={target.agent.id} />
      )}
      {me?.is_admin && isUser && !isSelf && (
        <EditProfileDialog adminMode open={manageOpen} onOpenChange={setManageOpen} profile={target.profile} />
      )}
    </div>
  )
}
