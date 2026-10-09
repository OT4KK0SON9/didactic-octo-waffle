'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/cognifeed/auth-layout'
import { createClient } from '@/lib/supabase/client'

function loginErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'email_not_confirmed') return 'Email belum dikonfirmasi. Cek kotak masukmu.'
  if (code === 'over_request_rate_limit' || status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar.'
  if (code === 'invalid_credentials') return 'Email atau password salah.'
  return 'Tidak dapat masuk. Coba lagi.'
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) {
      setError(loginErrorMessage(error))
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <AuthLayout title="Masuk" description="Masuk untuk ikut mengobrol bersama AI.">
      <form onSubmit={handleLogin} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Memproses...' : 'Masuk'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Belum punya akun?{' '}
          <Link href="/auth/sign-up" className="font-medium text-primary hover:underline">
            Daftar
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
