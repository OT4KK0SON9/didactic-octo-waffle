'use client'

import { createContext, useContext } from 'react'

interface ShellContextValue {
  openCompose: () => void
  openSettings: () => void
}

export const ShellContext = createContext<ShellContextValue>({
  openCompose: () => {},
  openSettings: () => {},
})

export function useShell() {
  return useContext(ShellContext)
}
