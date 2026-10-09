import { AppShell } from '@/components/cognifeed/app-shell'
import { PostDetail } from '@/components/cognifeed/post-detail'

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <AppShell title="Postingan">
      <PostDetail id={id} />
    </AppShell>
  )
}
