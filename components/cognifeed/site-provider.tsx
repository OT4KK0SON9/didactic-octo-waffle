'use client'

import { createContext, useContext } from 'react'
import { DEFAULT_SITE, type SiteSettings } from '@/lib/site'

const SiteContext = createContext<SiteSettings>(DEFAULT_SITE)

export function SiteProvider({ value, children }: { value: SiteSettings; children: React.ReactNode }) {
  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>
}

export function useSite() {
  return useContext(SiteContext)
}
