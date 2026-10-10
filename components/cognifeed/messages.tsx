'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Bot, MessageCircle, Search, Send, UserRound } from 'lucide-react'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { useMe } from '@/lib/hooks/use-me'

type Person = { id: string; kind: 'user' | 'agent'; name: string; username: string; avatar_url: string | null; bio: string }
type Message = { id: string; sender_user_id: string | null; sender_agent_id: string | null; body: string; created_at: string }

async function getPeople() {
  const db = createClient()
  const [users, agents] = await Promise.all([
    db.from('profiles').select('id,display_name,username,avatar_url,bio').eq('is_banned', false).limit(50),
    db.from('ai_agents').select('id,name,username,avatar_url,bio').eq('is_active', true),
  ])
  if (users.error || agents.error) throw users.error ?? agents.error
  return [
    ...(users.data ?? []).map((p) => ({ id: p.id, kind: 'user' as const, name: p.display_name, username: p.username, avatar_url: p.avatar_url, bio: p.bio ?? '' })),
    ...(agents.data ?? []).map((a) => ({ id: a.id, kind: 'agent' as const, name: a.name, username: a.username, avatar_url: a.avatar_url, bio: a.bio ?? '' })),
  ]
}

export function Messages() {
  const { me } = useMe()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Person | null>(null)
  const [body, setBody] = useState('')
  const people = useSWR('message-people', getPeople)
  const filtered = useMemo(() => (people.data ?? []).filter((p) => `${p.name} ${p.username} ${p.bio}`.toLowerCase().includes(query.toLowerCase())), [people.data, query])
  const key = selected && me ? ['messages', me.id, selected.kind, selected.id] : null
  const messages = useSWR<Message[]>(key, async () => {
    const db = createClient()
    const { data, error } = await db.from('direct_messages').select('id,sender_user_id,sender_agent_id,body,created_at').or(`and(sender_user_id.eq.${me!.id},recipient_user_id.eq.${selected!.id}),and(sender_user_id.eq.${selected!.id},recipient_user_id.eq.${me!.id})`).order('created_at')
    if (error) throw error
    return data ?? []
  })

  async function send() {
    if (!me || !selected || !body.trim()) return
    const db = createClient()
    const { error } = await db.from('direct_messages').insert({ sender_user_id: me.id, recipient_user_id: selected.kind === 'user' ? selected.id : null, recipient_agent_id: selected.kind === 'agent' ? selected.id : null, body: body.trim() })
    if (error) return
    setBody('')
    await messages.mutate()
  }

  if (!me) return <div className="p-8 text-center text-sm text-muted-foreground">Masuk untuk mulai berkomunikasi.</div>
  return <div className="grid min-h-[calc(100svh-65px)] md:grid-cols-[250px_1fr]">
    <aside className="border-b border-border p-4 md:border-b-0 md:border-r">
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari akun..." className="rounded-full pl-9" aria-label="Cari akun untuk pesan" /></div>
      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Saran teman</p>
      <div className="space-y-1">{filtered.map((person) => <button type="button" key={`${person.kind}-${person.id}`} onClick={() => setSelected(person)} className={`flex w-full items-center gap-2 rounded-xl p-2 text-left hover:bg-secondary ${selected?.id === person.id ? 'bg-secondary' : ''}`}><AuthorAvatar author={{ isAI: person.kind === 'agent', name: person.name, username: person.username, avatarUrl: person.avatar_url }} size="sm" /><span className="min-w-0 flex-1"><b className="block truncate text-sm">{person.name}</b><span className="block truncate text-xs text-muted-foreground">@{person.username}</span></span>{person.kind === 'agent' ? <Bot className="size-4 text-primary" /> : <UserRound className="size-4 text-muted-foreground" />}</button>)}</div>
    </aside>
    <section className="flex min-h-[420px] flex-col">{selected ? <><header className="flex items-center gap-3 border-b border-border p-4"><AuthorAvatar author={{ isAI: selected.kind === 'agent', name: selected.name, username: selected.username, avatarUrl: selected.avatar_url }} /><div><h2 className="font-semibold">{selected.name}</h2><p className="text-xs text-muted-foreground">@{selected.username} · {selected.kind === 'agent' ? 'AI selalu aktif' : 'Teman'}</p></div></header><div className="flex-1 space-y-3 overflow-y-auto p-4">{(messages.data ?? []).map((message) => <div key={message.id} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${message.sender_user_id === me.id ? 'ml-auto bg-primary text-primary-foreground' : 'bg-secondary'}`}>{message.body}</div>)}{!messages.data?.length && <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground"><MessageCircle className="mr-2 size-4" />Mulai percakapan baru</div>}</div><div className="flex gap-2 border-t border-border p-3"><Input value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) void send() }} placeholder="Tulis pesan..." aria-label="Tulis pesan" /><Button onClick={() => void send()} size="icon" aria-label="Kirim pesan"><Send className="size-4" /></Button></div></> : <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-muted-foreground"><MessageCircle className="mb-3 size-10 text-primary" /><p className="font-medium text-foreground">Pilih teman untuk mengobrol</p><p className="text-sm">Cari manusia atau AI, lalu kirim pesan langsung.</p></div>}</section>
  </div>
}
