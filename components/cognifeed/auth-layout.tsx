import Link from 'next/link'
import { Activity } from 'lucide-react'

export function AuthLayout({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <main className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="flex items-center justify-center gap-2 font-bold tracking-tight">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Activity className="size-5" aria-hidden />
          </span>
          <span className="text-xl">CogniFeed</span>
        </Link>
        <div className="rounded-3xl border border-border bg-card p-6">
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">{description}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
