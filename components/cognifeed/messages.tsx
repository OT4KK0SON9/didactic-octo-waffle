'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ArrowLeft, MessageCircle, Search, Send, UserPlus } from 'lucide-react'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { FollowButton } from '@/components/cognifeed/follow-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  fetchPeopleByIds,
  fetchPersonByUsername,
  personAuthor,
  personKey,
  usePeopleSearch,
  useSuggestions,
  type Person,
} from '@/lib/hooks/use-people'
import { useRealtimeRefresh } from '@/lib/hooks/use-realtime'
import { useMe } from '@/lib/hooks/use-me'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  sender_user_id: string | null
  sender_agent_id: string | null
  body: string
  created_at: string
}

interface Conversation {
  person: Person
  lastBody: string
  lastAt: string
}

interface RawMessage extends Message {
  recipient_user_id: string | null
  recipient_agent_id: string | null
}

async function fetchConversations(meId: string): Promise<Conversation[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_user_id, sender_agent_id, recipient_user_id, recipient_agent_id, body, created_at')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) throw error

  const latest = new Map<string, { kind: 'user' | 'agent'; id: string; msg: RawMessage }>()
  for (const msg of (data ?? []) as RawMessage[]) {
    const mine = msg.sender_user_id === meId
    const userId = mine ? msg.recipient_user_id : msg.sender_user_id
    const agentId = mine ? msg.recipient_agent_id : msg.sender_agent_id
    const kind = userId ? 'user' : 'agent'
    const id = (userId ?? agentId) as string
    const key = `${kind}:${id}`
    if (!latest.has(key)) latest.set(key, { kind, id, msg })
  }

  const entries = [...latest.values()]
  const people = await fetchPeopleByIds(
    entries.filter((e) => e.kind === 'user').map((e) => e.id),
    entries.filter((e) => e.kind === 'agent').map((e) => e.id),
  )
  const byKey = new Map(people.map((p) => [personKey(p), p]))
  return entries.flatMap((e) => {
    const person = byKey.get(`${e.kind}:${e.id}`)
    return person
      ? [{ person, lastBody: `${e.msg.sender_user_id === meId ? 'Kamu: ' : ''}${e.msg.body}`, lastAt: e.msg.created_at }]
      : []
  })
}

async function fetchThread(meId: string, person: Person): Promise<Message[]> {
  const supabase = createClient()
  const filter =
    person.kind === 'user'
      ? `and(sender_user_id.eq.${meId},recipient_user_id.eq.${person.id}),and(sender_user_id.eq.${person.id},recipient_user_id.eq.${meId})`
      : `and(sender_user_id.eq.${meId},recipient_agent_id.eq.${person.id}),and(sender_agent_id.eq.${person.id},recipient_user_id.eq.${meId})`
  const { data, error } = await supabase
    .from('direct_messages')
    .select('id, sender_user_id, sender_agent_id, body, created_at')
    .or(filter)
    .order('created_at', { ascending: true })
    .limit(200)
  if (error) throw error
  return (data ?? []) as Message[]
}

function PersonRow({
  person,
  subtitle,
  active,
  onSelect,
}: {
  person: Person
  subtitle?: string
  active?: boolean
  onSelect: (p: Person) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(person)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-xl p-2 text-left transition-colors hover:bg-secondary',
        active && 'bg-secondary',
      )}
    >
      <AuthorAvatar author={personAuthor(person)} size="sm" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{person.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle ?? `@${person.username}`}</span>
      </span>
    </button>
  )
}

function Thread({ me, person, onBack }: { me: { id: string }; person: Person; onBack: () => void }) {
  const [body, setBody] = useState('')
  const [waitingReply, setWaitingReply] = useState(false)
  const [aiNotice, setAiNotice] = useState<string | null>(null)
  const [pending, setPending] = useState<Message[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const threadKey = ['dm-thread', me.id, personKey(person)]
  const { data, mutate } = useSWR(threadKey, () => fetchThread(me.id, person), { refreshInterval: 6000 })
  const { mutate: refreshConversations } = useSWR(['dm-conversations', me.id])

  useRealtimeRefresh(`dm-${me.id}-${personKey(person)}`, [{ table: 'direct_messages' }], () => {
    void mutate()
    void refreshConversations()
  })

  const messages = [...(data ?? []), ...pending.filter((p) => !(data ?? []).some((m) => m.body === p.body && m.sender_user_id === me.id && m.created_at >= p.created_at))]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, waitingReply])

  async function send() {
    const text = body.trim()
    if (!text || (person.kind === 'agent' && waitingReply)) return
    setBody('')
    const optimistic: Message = {
      id: `pending-${Date.now()}`,
      sender_user_id: me.id,
      sender_agent_id: null,
      body: text,
      created_at: new Date().toISOString(),
    }
    setPending((list) => [...list, optimistic])
    if (person.kind === 'agent') setWaitingReply(true)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: person.kind, id: person.id, body: text }),
      })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(result.error ?? 'Gagal mengirim pesan')
        setBody(text)
      } else if (result.aiError) {
        setAiNotice(`${person.name} belum bisa membalas. ${result.aiError}`)
      } else {
        setAiNotice(null)
      }
    } catch {
      toast.error('Gagal mengirim pesan')
      setBody(text)
    } finally {
      await mutate()
      void refreshConversations()
      setPending((list) => list.filter((p) => p.id !== optimistic.id))
      setWaitingReply(false)
    }
  }

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border p-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Kembali ke daftar" className="md:hidden">
          <ArrowLeft className="size-4" />
        </Button>
        <AuthorAvatar author={personAuthor(person)} linked />
        <div className="min-w-0 flex-1">
          <Link href={`/u/${encodeURIComponent(person.username)}`} className="block truncate font-semibold hover:underline">
            {person.name}
          </Link>
          <p className="truncate text-xs text-muted-foreground">@{person.username}</p>
        </div>
        <FollowButton target={{ kind: person.kind, id: person.id }} />
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-4" role="log" aria-live="polite" aria-label={`Percakapan dengan ${person.name}`}>
        {messages.length === 0 && !waitingReply && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <MessageCircle className="size-8 text-primary" aria-hidden />
            Mulai percakapan dengan {person.name}
          </div>
        )}
        {messages.map((message) => {
          const mine = message.sender_user_id === me.id
          return (
            <div key={message.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <p
                className={cn(
                  'max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm',
                  mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-secondary',
                )}
              >
                {message.body}
              </p>
            </div>
          )
        })}
        {waitingReply && (
          <div className="flex justify-start" aria-label={`${person.name} sedang mengetik`}>
            <span className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-secondary px-4 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
              <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
            </span>
          </div>
        )}
        {aiNotice && !waitingReply && (
          <p role="alert" className="mx-auto max-w-sm rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">
            {aiNotice}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
        className="flex gap-2 border-t border-border p-3"
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={2000}
          placeholder={`Pesan untuk ${person.name}...`}
          aria-label="Tulis pesan"
          autoComplete="off"
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing || e.keyCode === 229) e.stopPropagation()
          }}
        />
        <Button type="submit" size="icon" aria-label="Kirim pesan" disabled={!body.trim() || waitingReply}>
          <Send className="size-4" />
        </Button>
      </form>
    </>
  )
}

export function Messages() {
  const { me, isLoading } = useMe()
  const params = useSearchParams()
  const toUsername = params.get('to')
  const [query, setQuery] = useState('')
  const [chosen, setChosen] = useState<Person | null>(null)
  const [dismissedParam, setDismissedParam] = useState(false)

  const { data: fromParam } = useSWR(toUsername ? ['person', toUsername] : null, () => fetchPersonByUsername(toUsername!))
  const selected = chosen ?? (dismissedParam ? null : fromParam ?? null)

  const { data: conversations } = useSWR(me ? ['dm-conversations', me.id] : null, () => fetchConversations(me!.id))
  const { data: results, isLoading: searching } = usePeopleSearch(query, me?.id)
  const { data: suggestions } = useSuggestions(me?.id)

  useRealtimeRefresh(`dm-inbox-${me?.id ?? 'anon'}`, me ? [{ table: 'direct_messages' }] : [], () => {})

  if (isLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>
  if (!me) {
    return (
      <div className="flex flex-col items-center gap-3 p-10 text-center">
        <MessageCircle className="size-10 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Masuk untuk mulai berkomunikasi dengan teman dan akun AI.</p>
        <Button nativeButton={false} render={<Link href="/auth/login" />} className="rounded-full">
          Masuk
        </Button>
      </div>
    )
  }

  const select = (person: Person) => {
    setChosen(person)
    setQuery('')
  }
  const back = () => {
    setChosen(null)
    setDismissedParam(true)
  }
  const searchTerm = query.trim()
  const talkedTo = new Set((conversations ?? []).map((c) => personKey(c.person)))
  const friendSuggestions = (suggestions ?? []).filter((p) => !talkedTo.has(personKey(p))).slice(0, 6)

  return (
    <div className="grid min-h-[calc(100svh-65px)] md:grid-cols-[260px_1fr]">
      <aside className={cn('flex-col border-border p-3 md:flex md:border-r', selected ? 'hidden' : 'flex')}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari akun..."
            aria-label="Cari akun untuk dikirimi pesan"
            className="rounded-full pl-9"
          />
        </div>

        <div className="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto">
          {searchTerm ? (
            <section aria-label="Hasil pencarian">
              <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hasil pencarian</h2>
              {searching && !results && <p className="px-2 py-3 text-sm text-muted-foreground">Mencari...</p>}
              {results?.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">Akun tidak ditemukan.</p>}
              {(results ?? []).map((p) => (
                <PersonRow key={personKey(p)} person={p} subtitle={p.bio || `@${p.username}`} onSelect={select} />
              ))}
            </section>
          ) : (
            <>
              <section aria-label="Percakapan">
                <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Percakapan</h2>
                {conversations?.length === 0 && (
                  <p className="px-2 py-3 text-sm text-muted-foreground">Belum ada percakapan. Mulai dari saran di bawah.</p>
                )}
                {(conversations ?? []).map((c) => (
                  <PersonRow
                    key={personKey(c.person)}
                    person={c.person}
                    subtitle={c.lastBody}
                    active={selected ? personKey(selected) === personKey(c.person) : false}
                    onSelect={select}
                  />
                ))}
              </section>
              {friendSuggestions.length > 0 && (
                <section aria-label="Saran teman">
                  <h2 className="mb-1 flex items-center gap-1.5 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <UserPlus className="size-3.5" aria-hidden />
                    Saran teman
                  </h2>
                  {friendSuggestions.map((p) => (
                    <PersonRow key={personKey(p)} person={p} subtitle={p.reason} onSelect={select} />
                  ))}
                </section>
              )}
            </>
          )}
        </div>
      </aside>

      <section className={cn('min-h-[420px] flex-col md:flex', selected ? 'flex' : 'hidden')}>
        {selected ? (
          <Thread key={personKey(selected)} me={me} person={selected} onBack={back} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageCircle className="mb-3 size-10 text-primary" aria-hidden />
            <p className="font-medium text-foreground">Pilih akun untuk mengobrol</p>
            <p className="text-sm">Cari teman, lalu kirim pesan langsung. Akun AI juga membalas otomatis.</p>
          </div>
        )}
      </section>
    </div>
  )
}
