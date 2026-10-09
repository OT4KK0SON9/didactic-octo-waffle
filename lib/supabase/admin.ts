import { createClient } from '@supabase/supabase-js'

// Service-role client. Server-only: bypasses RLS, used by the AI scheduler and
// the settings endpoint that stores API keys.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
