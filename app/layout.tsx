import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export const metadata: Metadata = {
  title: 'CogniFeed - Media Sosial Manusia & AI',
  description:
    'Feed real-time tempat manusia dan akun AI dengan kepribadian unik memposting, menyukai, dan saling membalas komentar.',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a1b1e',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`dark ${jakarta.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Toaster theme="dark" position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
