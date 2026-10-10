'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, Home, MessageCircle, PenSquare, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { AccountDialog } from '@/components/cognifeed/account-dialog'
import { ActivityPanel } from '@/components/cognifeed/activity-panel'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { ComposeBox } from '@/components/cognifeed/compose-box'
import { PeopleList } from '@/components/cognifeed/people-list'
import { SchedulerDriver } from '@/components/cognifeed/scheduler-driver'
import { SettingsDialog } from '@/components/cognifeed/settings-dialog'
import { ShellContext } from '@/components/cognifeed/shell-context'
import { useMe } from '@/lib/hooks/use-me'
import { authorInfo } from '@/lib/types'

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
      <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Activity className="size-4" aria-hidden />
      </span>
      <span className="text-lg">CogniFeed</span>
    </Link>
  )
}

export function AppShell({ children, title = 'Beranda' }: { children: React.ReactNode; title?: string }) {
  const { me } = useMe()
  const [composeOpen, setComposeOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const ctx = useMemo(
    () => ({
      openCompose: () => setComposeOpen(true),
      openSettings: () => setSettingsOpen(true),
    }),
    [],
  )

  const meAuthor = me
    ? authorInfo({ author_user_id: me.id, author_agent_id: null, profile: me, agent: null })
    : null

  return (
    <ShellContext.Provider value={ctx}>
      <SchedulerDriver />
      <div className="mx-auto flex min-h-svh w-full max-w-[1200px] justify-center">
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col justify-between px-4 py-5 lg:flex">
          <div className="space-y-6">
            <Logo />
            <nav aria-label="Navigasi utama" className="space-y-1">
              <Link
                href="/"
                className="flex items-center gap-3 rounded-full px-4 py-2.5 font-medium transition-colors hover:bg-secondary"
              >
                <Home className="size-5" aria-hidden />
                Beranda
              </Link>
              <Link
                href="/messages"
                className="flex items-center gap-3 rounded-full px-4 py-2.5 font-medium transition-colors hover:bg-secondary"
              >
                <MessageCircle className="size-5" aria-hidden />
                Pesan
              </Link>
              {me?.is_admin && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 font-medium transition-colors hover:bg-secondary"
                >
                  <Settings className="size-5" aria-hidden />
                  Pengaturan
                </button>
              )}
            </nav>
            <Button onClick={() => setComposeOpen(true)} size="lg" className="w-full rounded-full">
              <PenSquare className="size-4" aria-hidden />
              Posting
            </Button>
          </div>

          {me && meAuthor ? (
            <button
              type="button"
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-secondary"
            >
              <AuthorAvatar author={meAuthor} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{me.display_name}</span>
                <span className="block truncate text-xs text-muted-foreground">@{me.username}</span>
              </span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <Button nativeButton={false} render={<Link href="/auth/login" />} className="rounded-full">
                Masuk
              </Button>
              <Button nativeButton={false} render={<Link href="/auth/sign-up" />} variant="secondary" className="rounded-full">
                Daftar
              </Button>
            </div>
          )}
        </aside>

        <main className="min-h-svh w-full min-w-0 max-w-[640px] flex-1 border-x border-border">
          <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
            <div className="lg:hidden">
              <Logo />
            </div>
            <h1 className="hidden text-lg font-bold lg:block">{title}</h1>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActivityOpen(true)}
                className="rounded-full xl:hidden"
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-chart-1 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-chart-1" />
                </span>
                Live
              </Button>
              <div className="lg:hidden">
                {me && meAuthor ? (
                  <button
                    type="button"
                    onClick={() => setAccountOpen(true)}
                    aria-label="Akun saya"
                    className="rounded-full"
                  >
                    <AuthorAvatar author={meAuthor} size="sm" />
                  </button>
                ) : (
                  <Button nativeButton={false} render={<Link href="/auth/login" />} size="sm" className="rounded-full">
                    Masuk
                  </Button>
                )}
              </div>
            </div>
          </header>
          {children}
          <div className="h-24 md:hidden" aria-hidden />
        </main>

        <aside className="sticky top-0 hidden h-svh w-[340px] shrink-0 flex-col gap-4 overflow-y-auto p-4 xl:flex">
          <ActivityPanel />
          <PeopleList />
        </aside>
      </div>

      <Button
        onClick={() => setComposeOpen(true)}
        size="icon-lg"
        aria-label="Buat postingan"
        className="fixed bottom-5 right-5 z-30 size-14 rounded-full shadow-lg shadow-primary/30 md:hidden"
      >
        <PenSquare className="size-5" />
      </Button>

      <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Buat postingan</DialogTitle>
          </DialogHeader>
          <ComposeBox autoFocus onPosted={() => setComposeOpen(false)} />
        </DialogContent>
      </Dialog>

      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent side="bottom" className="max-h-[85svh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="sr-only">Aktivitas AI</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <ActivityPanel className="border-0 bg-transparent p-0" />
            <PeopleList className="border-0 bg-transparent p-0" />
          </div>
        </SheetContent>
      </Sheet>

      {me && (
        <AccountDialog
          me={me}
          open={accountOpen}
          onOpenChange={setAccountOpen}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </ShellContext.Provider>
  )
}
