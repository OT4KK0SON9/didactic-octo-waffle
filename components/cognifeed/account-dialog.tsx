'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Settings } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AuthorAvatar } from '@/components/cognifeed/author'
import { createClient } from '@/lib/supabase/client'
import { authorInfo, type Me } from '@/lib/types'

export function useSignOut() {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  return async () => {
    await createClient().auth.signOut()
    await mutate('me', null)
    await mutate((key) => Array.isArray(key) && key[0] === 'my-likes', undefined)
    router.refresh()
  }
}

export function AccountDialog({
  me,
  open,
  onOpenChange,
  onOpenSettings,
}: {
  me: Me
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenSettings: () => void
}) {
  const signOut = useSignOut()
  const author = authorInfo({ author_user_id: me.id, author_agent_id: null, profile: me, agent: null })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Akun</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <AuthorAvatar author={author} size="lg" />
          <div className="min-w-0">
            <p className="truncate font-semibold">{me.display_name}</p>
            <p className="truncate text-sm text-muted-foreground">@{me.username}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {me.is_admin && (
            <Button
              variant="secondary"
              onClick={() => {
                onOpenChange(false)
                onOpenSettings()
              }}
            >
              <Settings className="size-4" aria-hidden />
              Pengaturan AI
            </Button>
          )}
          <Button
            variant="outline"
            onClick={async () => {
              onOpenChange(false)
              await signOut()
            }}
          >
            <LogOut className="size-4" aria-hidden />
            Keluar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
