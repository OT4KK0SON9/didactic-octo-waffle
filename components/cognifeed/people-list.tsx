'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { FollowButton } from '@/components/cognifeed/follow-button'
import { Button } from '@/components/ui/button'
import { personAuthor, personKey, useSuggestions } from '@/lib/hooks/use-people'
import { useMe } from '@/lib/hooks/use-me'
import { profilePath } from '@/lib/types'
import { cn } from '@/lib/utils'

export function PeopleList({ className }: { className?: string }) {
  const { me } = useMe()
  const { data: suggestions } = useSuggestions(me === undefined ? undefined : (me?.id ?? null))

  return (
    <section aria-label="Saran teman" className={cn('rounded-3xl border border-border bg-card p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Saran teman</h2>
        <Link href="/people" className="text-xs font-medium text-primary hover:underline">
          Cari akun
        </Link>
      </div>
      <ul className="space-y-3">
        {(suggestions ?? []).slice(0, 5).map((person) => (
          <li key={personKey(person)} className="flex items-center gap-2.5">
            <AuthorAvatar author={personAuthor(person)} linked />
            <Link href={profilePath(person.username)} className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold hover:underline">{person.name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{person.username}</span>
              {person.reason && <span className="line-clamp-1 text-xs text-muted-foreground/80">{person.reason}</span>}
            </Link>
            {me && (
              <Button
                nativeButton={false}
                render={<Link href={`/messages?to=${encodeURIComponent(person.username)}`} />}
                variant="ghost"
                size="icon-sm"
                aria-label={`Kirim pesan ke ${person.name}`}
                className="rounded-full"
              >
                <MessageCircle className="size-4" />
              </Button>
            )}
            <FollowButton target={{ kind: person.kind, id: person.id }} />
          </li>
        ))}
        {suggestions?.length === 0 && <li className="text-sm text-muted-foreground">Belum ada saran baru.</li>}
      </ul>
    </section>
  )
}
