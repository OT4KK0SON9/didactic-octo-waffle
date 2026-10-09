import { createAdminClient } from '@/lib/supabase/admin'

type Db = ReturnType<typeof createAdminClient>

export const AGENT_ADMIN_FIELDS =
  'id, name, username, avatar_url, bio, provider, model, system_prompt, is_active, created_at'

type Parsed = { ok: true; value: Record<string, unknown> } | { ok: false; error: string }

// Validasi input akun AI dari owner. Model sengaja diisi bebas (teks) karena
// nama model sering berubah/dihapus oleh provider.
export function parseAgentInput(body: Record<string, unknown>, requireAll: boolean): Parsed {
  const value: Record<string, unknown> = {}
  const has = (k: string) => body[k] !== undefined

  const need = (k: string) => requireAll && !has(k)

  if (need('name') || has('name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 40) return { ok: false, error: 'Nama 1-40 karakter.' }
    value.name = name
  }
  if (need('username') || has('username')) {
    const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
    if (!/^[a-z0-9_]{3,30}$/.test(username)) {
      return { ok: false, error: 'Username 3-30 karakter: huruf kecil, angka, atau underscore.' }
    }
    value.username = username
  }
  if (has('bio')) {
    const bio = typeof body.bio === 'string' ? body.bio.trim() : ''
    if (bio.length > 160) return { ok: false, error: 'Bio maksimal 160 karakter.' }
    value.bio = bio
  } else if (requireAll) value.bio = ''
  if (need('provider') || has('provider')) {
    if (body.provider !== 'gemini' && body.provider !== 'groq') return { ok: false, error: 'Provider harus gemini atau groq.' }
    value.provider = body.provider
  }
  if (need('model') || has('model')) {
    const model = typeof body.model === 'string' ? body.model.trim() : ''
    if (!/^[\w.\-:/]{1,100}$/.test(model)) return { ok: false, error: 'Nama model tidak valid (tanpa spasi, maks 100 karakter).' }
    value.model = model
  }
  if (need('system_prompt') || has('system_prompt')) {
    const prompt = typeof body.system_prompt === 'string' ? body.system_prompt.trim() : ''
    if (!prompt || prompt.length > 2000) return { ok: false, error: 'Kepribadian (system prompt) 1-2000 karakter.' }
    value.system_prompt = prompt
  }
  if (has('is_active')) {
    if (typeof body.is_active !== 'boolean') return { ok: false, error: 'is_active tidak valid.' }
    value.is_active = body.is_active
  }
  if (has('avatar_url')) {
    const url = typeof body.avatar_url === 'string' ? body.avatar_url.trim() : ''
    if (!/^https?:\/\/\S{1,480}$/.test(url)) return { ok: false, error: 'URL foto harus diawali http:// atau https://.' }
    value.avatar_url = url
  }
  return { ok: true, value }
}

// Username dipakai bersama oleh manusia dan AI (URL /u/<username>), jadi harus unik di keduanya.
export async function usernameTaken(db: Db, username: string, excludeAgentId?: string) {
  const [{ data: profile }, { data: agent }] = await Promise.all([
    db.from('profiles').select('id').eq('username', username).maybeSingle(),
    db.from('ai_agents').select('id').eq('username', username).maybeSingle(),
  ])
  if (profile) return true
  return !!agent && agent.id !== excludeAgentId
}
