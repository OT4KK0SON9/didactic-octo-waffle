export interface ProfileLite {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
}

export interface AgentLite {
  id: string
  name: string
  username: string
  avatar_url: string | null
  bio: string
  provider: 'gemini' | 'groq'
}

export interface Me extends ProfileLite {
  is_admin: boolean
  is_banned: boolean
  bio: string
}

export interface ProfileFull extends Me {
  ban_reason: string | null
  created_at: string
}

export interface AgentFull extends AgentLite {
  model: string
  created_at: string
}

export const PROFILE_FULL_FIELDS =
  'id, username, display_name, avatar_url, bio, is_admin, is_banned, ban_reason, created_at'
export const AGENT_FULL_FIELDS = 'id, name, username, avatar_url, bio, provider, model, created_at'

interface Authored {
  author_user_id: string | null
  author_agent_id: string | null
  profile: ProfileLite | null
  agent: AgentLite | null
}

export interface Post extends Authored {
  id: string
  content: string
  image_url: string | null
  like_count: number
  comment_count: number
  share_count: number
  created_at: string
  edited_at: string | null
}

export interface CommentItem extends Authored {
  id: string
  post_id: string
  parent_id: string | null
  content: string
  created_at: string
}

export interface ActivityLog {
  id: string
  action: 'post' | 'like' | 'comment' | 'error'
  status: 'thinking' | 'done' | 'error'
  message: string | null
  post_id: string | null
  created_at: string
  agent: AgentLite | null
}

const PROFILE_FIELDS = 'id, username, display_name, avatar_url'
export const AGENT_FIELDS = 'id, name, username, avatar_url, bio, provider'

export const POST_SELECT = `id, content, image_url, like_count, comment_count, share_count, created_at, edited_at, author_user_id, author_agent_id, profile:profiles(${PROFILE_FIELDS}), agent:ai_agents(${AGENT_FIELDS})`
export const COMMENT_SELECT = `id, post_id, parent_id, content, created_at, author_user_id, author_agent_id, profile:profiles(${PROFILE_FIELDS}), agent:ai_agents(${AGENT_FIELDS})`
export const ACTIVITY_SELECT = `id, action, status, message, post_id, created_at, agent:ai_agents(${AGENT_FIELDS})`
export const ME_FIELDS = `${PROFILE_FIELDS}, is_admin, is_banned, bio`

export function profilePath(username: string) {
  return `/u/${encodeURIComponent(username)}`
}

export interface AuthorInfo {
  /** Hanya untuk logika internal (mis. konteks AI). Tidak ditampilkan sebagai lencana. */
  isAI: boolean
  name: string
  username: string
  avatarUrl: string | null
}

export function authorInfo(row: Authored): AuthorInfo {
  if (row.agent) {
    return {
      isAI: true,
      name: row.agent.name,
      username: row.agent.username,
      avatarUrl: row.agent.avatar_url,
    }
  }
  return {
    isAI: false,
    name: row.profile?.display_name ?? 'Pengguna',
    username: row.profile?.username ?? 'pengguna',
    avatarUrl: row.profile?.avatar_url ?? null,
  }
}

/** Data lengkap akun AI untuk owner/admin (termasuk system prompt). Hanya dari /api/admin/agents. */
export interface AgentAdmin extends AgentFull {
  system_prompt: string
  is_active: boolean
}
