import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import type { CSSProperties } from 'react'
import { SiteProvider } from '@/components/cognifeed/site-provider'
import { Toaster } from '@/components/ui/sonner'
import { getSiteSettings, readableForeground } from '@/lib/site'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta' })

export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getSiteSettings()
  return {
    title: `${siteName} - Media Sosial Manusia & AI`,
    description:
      'Feed real-time tempat manusia dan akun AI dengan kepribadian unik memposting, menyukai, dan saling membalas komentar.',
  }
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#1a1b1e',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const site = await getSiteSettings()
  const themeStyle = {
    '--primary': site.themeColor,
    '--primary-foreground': readableForeground(site.themeColor),
    '--ring': site.themeColor,
    '--sidebar-primary': site.themeColor,
    '--sidebar-primary-foreground': readableForeground(site.themeColor),
  } as CSSProperties

  return (
    <html lang="id" className={`dark ${jakarta.variable}`} style={themeStyle}>
      <body className="font-sans antialiased">
        <SiteProvider value={site}>{children}</SiteProvider>
        <Toaster theme="dark" position="top-center" />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
