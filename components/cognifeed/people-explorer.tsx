'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageCircle, Search, Sparkles } from 'lucide-react'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { FollowButton } from '@/components/cognifeed/follow-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { personAuthor, personKey, usePeopleSearch, useSuggestions, type Person } from '@/lib/hooks/use-people'
import { useMe } from '@/lib/hooks/use-me'
import { profilePath } from '@/lib/types'

function PersonCard({ person, canMessage }: { person: Person; canMessage: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <AuthorAvatar author={personAuthor(person)} linked />
      <Link href={profilePath(person.username)} className="min-w-0 flex-1">
        <span className="block truncate font-semibold hover:underline">{person.name}</span>
        <span className="block truncate text-sm text-muted-foreground">@{person.username}</span>
        {(person.reason || person.bio) && (
          <span className="line-clamp-1 text-xs text-muted-foreground/80">{person.reason ?? person.bio}</span>
        )}
      </Link>
      {canMessage && (
        <Button
          nativeButton={false}
          render={<Link href={`/messages?to=${encodeURIComponent(person.username)}`} />}
          variant="secondary"
          size="icon"
          aria-label={`Kirim pesan ke ${person.name}`}
          className="rounded-full"
        >
          <MessageCircle className="size-4" />
        </Button>
      )}
      <FollowButton target={{ kind: person.kind, id: person.id }} />
    </li>
  )
}

export function PeopleExplorer() {
  const { me } = useMe()
  const [query, setQuery] = useState('')
  const term = query.trim()
  const { data: results, isLoading: searching } = usePeopleSearch(query, me?.id)
  const { data: suggestions, isLoading: loadingSuggestions } = useSuggestions(me === undefined ? undefined : (me?.id ?? null))

  return (
    <div>
      <div className="border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama atau username..."
            aria-label="Cari akun"
            className="h-11 rounded-full pl-10"
          />
        </div>
      </div>

      {term ? (
        <section aria-label="Hasil pencarian">
          <h2 className="px-4 pt-4 text-sm font-semibold text-muted-foreground">Hasil untuk &quot;{term}&quot;</h2>
          {searching && !results && <p className="p-4 text-sm text-muted-foreground">Mencari...</p>}
          {results?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Tidak ada akun yang cocok.</p>}
          <ul className="divide-y divide-border">
            {(results ?? []).map((p) => (
              <PersonCard key={personKey(p)} person={p} canMessage={!!me} />
            ))}
          </ul>
        </section>
      ) : (
        <section aria-label="Saran teman">
          <h2 className="flex items-center gap-2 px-4 pt-4 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden />
            Saran teman untukmu
          </h2>
          {loadingSuggestions && <p className="p-4 text-sm text-muted-foreground">Memuat saran...</p>}
          {suggestions?.length === 0 && <p className="p-4 text-sm text-muted-foreground">Kamu sudah mengikuti semua akun.</p>}
          <ul className="divide-y divide-border">
            {(suggestions ?? []).slice(0, 30).map((p) => (
              <PersonCard key={personKey(p)} person={p} canMessage={!!me} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
