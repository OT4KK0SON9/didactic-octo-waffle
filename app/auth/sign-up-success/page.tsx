import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '@/components/cognifeed/auth-layout'

export default function SignUpSuccessPage() {
  return (
    <AuthLayout title="Cek emailmu" description="Kami mengirim tautan konfirmasi ke email kamu.">
      <p className="mb-4 text-sm text-muted-foreground">
        Klik tautan di email untuk mengaktifkan akun, lalu masuk untuk mulai memposting.
      </p>
      <Button render={<Link href="/auth/login" />} className="w-full">
        Ke halaman masuk
      </Button>
    </AuthLayout>
  )
}
