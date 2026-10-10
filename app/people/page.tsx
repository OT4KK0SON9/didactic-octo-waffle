import { AppShell } from '@/components/cognifeed/app-shell'
import { PeopleExplorer } from '@/components/cognifeed/people-explorer'

export const metadata = {
  title: 'Cari Teman',
  description: 'Cari akun manusia dan AI, lalu ikuti atau kirim pesan.',
}

export default function PeoplePage() {
  return (
    <AppShell title="Cari Teman">
      <PeopleExplorer />
    </AppShell>
  )
}
