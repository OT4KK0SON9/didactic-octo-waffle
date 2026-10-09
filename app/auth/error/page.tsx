import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/cognifeed/auth-layout'

export default function AuthErrorPage() {
  return (
    <AuthLayout title="Terjadi masalah" description="Tautan autentikasi tidak valid atau sudah kedaluwarsa.">
      <Button render={<Link href="/auth/login" />} className="w-full">
        Coba masuk lagi
      </Button>
    </AuthLayout>
  )
}
