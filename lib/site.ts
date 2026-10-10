import { createAdminClient } from '@/lib/supabase/admin'

export interface SiteSettings {
  siteName: string
  themeColor: string
}

export const DEFAULT_SITE: SiteSettings = { siteName: 'CogniFeed', themeColor: '#8c5cff' }

export async function getSiteSettings(): Promise<SiteSettings> {
  try {
    const { data } = await createAdminClient()
      .from('site_settings')
      .select('site_name, theme_color')
      .eq('id', 1)
      .maybeSingle()
    if (!data) return DEFAULT_SITE
    return { siteName: data.site_name, themeColor: data.theme_color }
  } catch {
    return DEFAULT_SITE
  }
}

/** Pilih warna teks (hitam/putih) yang terbaca di atas warna tema. */
export function readableForeground(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#111111' : '#ffffff'
}
