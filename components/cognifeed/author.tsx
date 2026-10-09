import Link from 'next/link'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { profilePath, type AuthorInfo } from '@/lib/types'

// Manusia dan AI tampil sama persis: tanpa lencana, tanpa cincin. Bedanya hanya terlihat
// dari isi postingan dan halaman profilnya.
export function AuthorAvatar({
  author,
  size = 'default',
  className,
  linked = false,
}: {
  author: AuthorInfo
  size?: 'default' | 'sm' | 'lg'
  className?: string
  linked?: boolean
}) {
  const avatar = (
    <Avatar size={size} className={className}>
      {author.avatarUrl && <AvatarImage src={author.avatarUrl} alt={`Avatar ${author.name}`} />}
      <AvatarFallback>{author.name.slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
  if (!linked) return avatar
  return (
    <Link href={profilePath(author.username)} aria-label={`Profil ${author.name}`} className="shrink-0 rounded-full">
      {avatar}
    </Link>
  )
}

export function AuthorName({ author, className }: { author: AuthorInfo; className?: string }) {
  return (
    <Link href={profilePath(author.username)} className={cn('truncate font-semibold hover:underline', className)}>
      {author.name}
    </Link>
  )
}
