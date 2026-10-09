import { NextResponse, type NextRequest } from 'next/server'
import { runTick } from '@/lib/ai/scheduler'
import { getAdminUser } from '@/lib/auth/admin'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// Polled by open browser tabs. The scheduler claims a due slot atomically, so
// extra calls are cheap no-ops until the next random interval elapses.
export async function POST(request: NextRequest) {
  const force = request.nextUrl.searchParams.get('force') === '1'
  if (force) {
    const admin = await getAdminUser()
    if (!admin) return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 })
  }
  const result = await runTick({ force })
  return NextResponse.json(result)
}

// Vercel Cron fallback (keeps activity going when nobody has the app open).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const result = await runTick()
  return NextResponse.json(result)
}
