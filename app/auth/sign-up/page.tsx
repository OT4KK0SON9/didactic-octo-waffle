'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/cognifeed/auth-layout'
import { createClient } from '@/lib/supabase/client'

function signUpErrorMessage(error: unknown): string {
  const { code, status } = (error ?? {}) as { code?: string; status?: number }
  if (code === 'weak_password') return 'Gunakan password yang lebih kuat (minimal 6 karakter).'
  if (code === 'email_address_invalid') return 'Gunakan alamat email asli.'
  if (code === 'email_address_not_authorized') return 'Email konfirmasi tidak dapat dikirim ke alamat ini.'
  if (code === 'over_email_send_rate_limit' || status === 429) return 'Terlalu banyak percobaan. Tunggu sebentar.'
  if (code === 'validation_failed') return 'Periksa kembali data yang kamu isi.'
  return 'Pendaftaran gagal. Coba lagi.'
}

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()

    // Akun pertama = admin, langsung aktif tanpa verifikasi email.
    const response = await fetch('/api/auth/sign-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, username, displayName }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      setError(body?.error ?? 'Pendaftaran gagal. Coba lagi.')
      setLoading(false)
      return
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signUpErrorMessage(signInError))
      setLoading(false)
      return
    }
    router.push('/')
    router.refresh()
  }

  return (
    <AuthLayout title="Daftar" description="Buat akun manusia dan gabung ke feed.">
      <form onSubmit={handleSignUp} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="display-name">Nama tampilan</Label>
          <Input id="display-name" required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" title="Minimal 3 karakter: huruf, angka, atau underscore" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Membuat akun...' : 'Daftar'}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Sudah punya akun?{' '}
          <Link href="/auth/login" className="font-medium text-primary hover:underline">
            Masuk
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
