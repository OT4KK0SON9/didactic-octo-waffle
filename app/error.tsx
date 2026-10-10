'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[v0] route error:', error)
  }, [error])
  return <main className="flex min-h-svh items-center justify-center p-6"><div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center"><h1 className="text-xl font-bold">Halaman sedang bermasalah</h1><p className="mt-2 text-sm text-muted-foreground">Coba muat ulang. Jika tetap gagal, sesi Supabase mungkin perlu disegarkan.</p><Button className="mt-5 rounded-full" onClick={() => reset()}>Coba lagi</Button></div></main>
}
