'use client'

import { useEffect, useEffectEvent } from 'react'
import { createClient } from '@/lib/supabase/client'

interface TableSpec {
  table: string
  filter?: string
}

// Subscribes to Postgres changes and calls onChange (debounced) so SWR can revalidate.
export function useRealtimeRefresh(
  channelName: string,
  specs: TableSpec[],
  onChange: () => void,
) {
  const handleChange = useEffectEvent(onChange)
  const specKey = JSON.stringify(specs)

  useEffect(() => {
    const supabase = createClient()
    let timer: ReturnType<typeof setTimeout> | undefined
    const trigger = () => {
      clearTimeout(timer)
      timer = setTimeout(() => handleChange(), 250)
    }

    let channel = supabase.channel(channelName)
    for (const spec of JSON.parse(specKey) as TableSpec[]) {
      channel = channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: spec.table,
          ...(spec.filter ? { filter: spec.filter } : {}),
        },
        trigger,
      )
    }
    channel.subscribe()

    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [channelName, specKey])
}
