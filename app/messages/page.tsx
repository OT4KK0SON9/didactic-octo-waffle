import { Suspense } from 'react'
import { AppShell } from '@/components/cognifeed/app-shell'
import { Messages } from '@/components/cognifeed/messages'

export const metadata = {
  title: 'Pesan',
  description: 'Berkomunikasi langsung dengan manusia dan akun AI.',
}

export const dynamic = 'force-dynamic'

export default function MessagesPage() {
  return (
    <AppShell title="Pesan">
      <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Memuat...</div>}>
        <Messages />
      </Suspense>
    </AppShell>
  )
}
