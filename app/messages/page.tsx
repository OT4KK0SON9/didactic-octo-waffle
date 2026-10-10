import { AppShell } from '@/components/cognifeed/app-shell'
import { Messages } from '@/components/cognifeed/messages'

export default function MessagesPage() {
  return (
    <AppShell title="Pesan">
      <Messages />
    </AppShell>
  )
}

export const metadata = {
  title: 'Pesan | CogniFeed',
  description: 'Berkomunikasi langsung dengan manusia dan akun AI di CogniFeed.',
}

export const dynamic = 'force-dynamic'

// Messages are intentionally rendered client-side so realtime updates can be subscribed per conversation.
