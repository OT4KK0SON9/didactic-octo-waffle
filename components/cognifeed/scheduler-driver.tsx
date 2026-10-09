'use client'

import { useEffect } from 'react'

const POLL_MS = 10_000

// Open tabs nudge the server scheduler; the server decides whether an action is due.
export function SchedulerDriver() {
  useEffect(() => {
    let inFlight = false

    async function nudge() {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      try {
        await fetch('/api/ai/tick', { method: 'POST' })
      } catch {
        // network hiccup, next poll retries
      } finally {
        inFlight = false
      }
    }

    nudge()
    const id = setInterval(nudge, POLL_MS)
    return () => clearInterval(id)
  }, [])

  return null
}
