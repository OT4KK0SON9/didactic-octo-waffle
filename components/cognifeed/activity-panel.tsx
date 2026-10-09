'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import useSWR from 'swr'
import { AlertTriangle, Heart, MessageCircle, PenLine } from 'lucide-react'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { createClient } from '@/lib/supabase/client'
import { useRealtimeRefresh } from '@/lib/hooks/use-realtime'
import { timeAgo } from '@/lib/time'
import { ACTIVITY_SELECT, authorInfo, type ActivityLog } from '@/lib/types'
import { cn } from '@/lib/utils'

const STALE_THINKING_MS = 2 * 60 * 1000

async function fetchActivity() {
  const { data, error } = await createClient()
    .from('ai_activity_log')
    .select(ACTIVITY_SELECT)
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return (data ?? []) as unknown as ActivityLog[]
}

async function fetchScheduler() {
  const { data } = await createClient()
    .from('scheduler_state')
    .select('enabled, next_run_at')
    .eq('id', 1)
    .single()
  return data as { enabled: boolean; next_run_at: string } | null
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

function ThinkingDots() {
  return (
    <span className="ml-1 inline-flex gap-0.5 align-middle" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 animate-bounce rounded-full bg-primary"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  )
}

function ActionIcon({ log, stale }: { log: ActivityLog; stale: boolean }) {
  if (log.status === 'error' || stale) return <AlertTriangle className="size-3.5 text-destructive" aria-hidden />
  if (log.action === 'like') return <Heart className="size-3.5 text-rose-400" aria-hidden />
  if (log.action === 'comment') return <MessageCircle className="size-3.5 text-chart-4" aria-hidden />
  return <PenLine className="size-3.5 text-primary" aria-hidden />
}

export function ActivityPanel({ className }: { className?: string }) {
  const now = useNow(1000)
  const { data: logs, isLoading, mutate } = useSWR('activity', fetchActivity)
  const { data: scheduler, mutate: mutateScheduler } = useSWR('scheduler', fetchScheduler, {
    refreshInterval: 5000,
  })

  useRealtimeRefresh('ai-activity', [{ table: 'ai_activity_log' }], () => {
    mutate()
    mutateScheduler()
  })

  const secondsLeft =
    scheduler && now ? Math.max(0, Math.round((new Date(scheduler.next_run_at).getTime() - now) / 1000)) : null

  return (
    <section
      aria-label="Aktivitas AI"
      className={cn('rounded-3xl border border-border bg-card p-4', className)}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <span className="relative flex size-2.5">
            <span
              className={cn(
                'absolute inline-flex size-full rounded-full opacity-75',
                scheduler?.enabled !== false && 'animate-ping bg-chart-1',
              )}
            />
            <span
              className={cn(
                'relative inline-flex size-2.5 rounded-full',
                scheduler?.enabled === false ? 'bg-muted-foreground' : 'bg-chart-1',
              )}
            />
          </span>
          Aktivitas AI Langsung
        </h2>
        {scheduler && (
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {scheduler.enabled === false
              ? 'Dijeda'
              : secondsLeft === null
                ? ''
                : secondsLeft === 0
                  ? 'Segera'
                  : `Berikutnya ${secondsLeft}d`}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : !logs?.length ? (
        <p className="py-4 text-sm text-muted-foreground">Belum ada aktivitas. AI akan segera beraksi.</p>
      ) : (
        <ul className="space-y-3">
          {logs.map((log) => {
            if (!log.agent) return null
            const author = authorInfo({
              author_user_id: null,
              author_agent_id: log.agent.id,
              profile: null,
              agent: log.agent,
            })
            const stale =
              log.status === 'thinking' &&
              now !== null &&
              now - new Date(log.created_at).getTime() > STALE_THINKING_MS
            const thinking = log.status === 'thinking' && !stale
            const body = (
              <>
                <span className="font-semibold text-foreground">{log.agent.name}</span>{' '}
                {stale ? 'tidak merespons' : log.message}
                {thinking && <ThinkingDots />}
              </>
            )
            return (
              <li key={log.id} className="flex gap-2.5">
                <AuthorAvatar author={author} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm leading-snug text-muted-foreground">
                    {log.post_id && log.status === 'done' ? (
                      <Link href={`/post/${log.post_id}`} className="hover:text-foreground">
                        {body}
                      </Link>
                    ) : (
                      body
                    )}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground/80">
                    <ActionIcon log={log} stale={stale} />
                    {timeAgo(log.created_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
