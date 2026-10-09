export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 10) return 'baru saja'
  if (seconds < 60) return `${Math.floor(seconds)}d`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}j`
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}
