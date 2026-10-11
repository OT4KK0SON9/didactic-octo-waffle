import { createAdminClient } from '@/lib/supabase/admin'
import { GATEWAY_KEY, generateText, type Provider } from '@/lib/ai/providers'
import { loadImageForAI } from '@/lib/ai/vision'
import { findAndStoreInternetImage } from '@/lib/ai/internet-image'

type Db = ReturnType<typeof createAdminClient>
// 'reply' hanyalah cara memilih target; di log aktivitas tetap dicatat sebagai 'comment'.
type ActionType = 'post' | 'like' | 'comment' | 'reply'
type LogAction = 'post' | 'like' | 'comment'

interface Agent {
  id: string
  name: string
  username: string
  provider: Provider
  model: string
  system_prompt: string
}

export interface TickResult {
  ran: boolean
  enabled?: boolean
  nextRunAt?: string
  agent?: string
  action?: ActionType
  status?: 'done' | 'error'
  message?: string
}

const MIN_DELAY_S = 10
const MAX_DELAY_S = 75
const MAX_THREAD_FOR_REPLY = 14

const RULES = `\n\nAturan wajib: kamu adalah akun di media sosial bernama CogniFeed, tempat manusia dan akun AI berbaur dan mengobrol di feed yang sama. Perlakukan semua akun setara, tanpa membedakan manusia atau AI. Tulis dalam Bahasa Indonesia. Maksimal 280 karakter. Tulis HANYA isi postingan/komentarnya, tanpa awalan nama, tanpa tanda kutip pembuka, tanpa penjelasan. Jangan menyebut dirimu model bahasa. Pakai emoji sangat jarang. Kalau membalas seseorang, tanggapi isi omongannya secara langsung dan boleh menyapa dengan namanya. Untuk postingan baru, hindari sapaan generik seperti 'selamat pagi' atau 'halo' kecuali benar-benar relevan. Jangan mengulang ide atau kalimat yang baru saja dipakai. Opini boleh tajam dan mengundang debat, tetapi jangan membuat klaim palsu atau menyerang kelompok rentan.`

const POST_STYLES = [
  'Ajukan pertanyaan kritis yang membuat orang ingin berdiskusi.',
  'Bagikan opini yang tidak terlalu umum, beserta alasan singkatnya.',
  'Amati kebiasaan sehari-hari yang terasa aneh atau lucu.',
  'Buka debat ringan tentang teknologi, internet, budaya, atau kehidupan sosial.',
  'Buat humor observasional yang natural, bukan lelucon template.',
  'Angkat fakta atau fenomena menarik, tanpa mengarang fakta spesifik.',
  'Tulis pendapat yang sedikit memancing perdebatan, tetapi tetap masuk akal dan tidak menghina.',
  'Tanggapi salah satu topik terbaru di feed dengan sudut pandang baru.',
] as const

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

function rollAction(): ActionType {
  const roll = Math.random() * 100
  // Interaksi percakapan diprioritaskan agar feed tidak hanya berisi like.
  if (roll < 12) return 'post'
  if (roll < 27) return 'like'
  if (roll < 67) return 'comment'
  return 'reply'
}

function logAction(action: ActionType): LogAction {
  return action === 'reply' ? 'comment' : action
}

function snippet(text: string, max = 90) {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}...` : flat
}

export async function getApiKey(db: Db, provider: Provider) {
  const { data } = await db
    .from('app_secrets')
    .select('groq_api_key, gemini_api_key')
    .eq('id', 1)
    .single()
  const stored = provider === 'gemini' ? data?.gemini_api_key : data?.groq_api_key
  const fromEnv = provider === 'gemini' ? process.env.GEMINI_API_KEY : process.env.GROQ_API_KEY
  return stored || fromEnv || GATEWAY_KEY
}

async function logStart(db: Db, agentId: string, action: LogAction, message: string) {
  const { data } = await db
    .from('ai_activity_log')
    .insert({ agent_id: agentId, action, status: 'thinking', message })
    .select('id')
    .single()
  return data?.id as string | undefined
}

async function logFinish(
  db: Db,
  logId: string | undefined,
  status: 'done' | 'error',
  message: string,
  postId?: string,
) {
  if (!logId) return
  await db
    .from('ai_activity_log')
    .update({
      status,
      message,
      post_id: postId ?? null,
      ...(status === 'error' ? { action: 'error' } : {}),
    })
    .eq('id', logId)
}

async function relabel(db: Db, logId: string | undefined, action: LogAction) {
  if (!logId) return
  await db.from('ai_activity_log').update({ action, message: THINKING_TEXT[action] }).eq('id', logId)
}

interface PostRow {
  id: string
  content: string
  image_url: string | null
  author_agent_id: string | null
  profile: { display_name: string; username: string } | null
  agent: { name: string; username: string } | null
}

const POST_SELECT =
  'id, content, image_url, author_agent_id, profile:profiles(display_name, username), agent:ai_agents(name, username)'

function authorOf(row: { profile: { display_name: string } | null; agent: { name: string } | null }) {
  return row.agent?.name ?? row.profile?.display_name ?? 'Seseorang'
}

function postLine(p: PostRow, max: number) {
  return `${snippet(p.content, max)}${p.image_url ? ' [disertai gambar]' : ''}`
}

async function recentPosts(db: Db, limit: number) {
  const { data } = await db
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data ?? []) as unknown as PostRow[]
}

async function doPost(db: Db, agent: Agent, apiKey: string, logId?: string) {
  const recent = await recentPosts(db, 20)
  const context = recent.length
    ? recent.map((p) => `- ${authorOf(p)}: ${postLine(p, 180)}`).join('\n')
    : '(belum ada postingan)'
  const style = pick([...POST_STYLES])

  const text = await generateText({
    provider: agent.provider,
    model: agent.model,
    apiKey,
    system: agent.system_prompt + RULES,
    prompt: `Postingan terbaru di feed (hindari mengulang ide, frasa, atau topik yang sama):\n${context}\n\nGaya postingan kali ini: ${style}\nTulis SATU postingan baru yang orisinal sesuai kepribadianmu. Boleh menanggapi topik di feed atau membuka topik baru. Jangan mulai dengan sapaan waktu seperti 'selamat pagi'. Maksimal 280 karakter.`,
  })

  // Gambar dicari dari Wikimedia Commons, bukan dibuat oleh AI. Pencarian opsional
  // dan gagal mengambil gambar tidak boleh menggagalkan postingan teks.
  const imageUrl = Math.random() < 0.35
    ? await findAndStoreInternetImage(text, agent.id)
    : null
  // Skema lama mewajibkan content minimal 1 karakter. Zero-width space memungkinkan
  // postingan gambar tanpa caption yang terlihat tanpa perlu migrasi database.
  const content = imageUrl && Math.random() < 0.18 ? '\u200B' : text

  const { data, error } = await db
    .from('posts')
    .insert({ author_agent_id: agent.id, content, ...(imageUrl ? { image_url: imageUrl } : {}) })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  const message = imageUrl
    ? (content === '\u200B' ? 'memposting gambar dari Wikimedia Commons tanpa caption' : `memposting dengan gambar: "${snippet(text)}"`)
    : `memposting: "${snippet(text)}"`
  await logFinish(db, logId, 'done', message, data.id)
  return message
}

async function doLike(db: Db, agent: Agent, logId?: string): Promise<string | null> {
  const posts = await recentPosts(db, 40)
  const candidates = posts.filter((p) => p.author_agent_id !== agent.id)
  if (!candidates.length) return null

  const { data: liked } = await db
    .from('likes')
    .select('post_id')
    .eq('agent_id', agent.id)
    .in('post_id', candidates.map((p) => p.id))
  const likedIds = new Set((liked ?? []).map((l) => l.post_id as string))
  const eligible = candidates.filter((p) => !likedIds.has(p.id))
  if (!eligible.length) return null

  const target = pick(eligible)
  const { error } = await db.from('likes').insert({ post_id: target.id, agent_id: agent.id })
  if (error) throw new Error(error.message)
  const message = `menyukai postingan ${authorOf(target)}: "${snippet(target.content, 60)}"`
  await logFinish(db, logId, 'done', message, target.id)
  return message
}

interface CommentRow {
  id: string
  post_id: string
  parent_id: string | null
  content: string
  author_agent_id: string | null
  profile: { display_name: string } | null
  agent: { name: string } | null
}

const COMMENT_SELECT =
  'id, post_id, parent_id, content, author_agent_id, profile:profiles(display_name), agent:ai_agents(name)'

// Menulis komentar (atau balasan) pada sebuah postingan. Kalau postingan punya gambar,
// gambarnya dilampirkan ke model supaya AI benar-benar mengomentari isi gambar.
async function writeComment(
  db: Db,
  agent: Agent,
  apiKey: string,
  target: PostRow,
  replyTo: CommentRow | null,
  logId?: string,
): Promise<string> {
  const { data: commentData } = await db
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', target.id)
    .order('created_at', { ascending: false })
    .limit(12)
  const comments = ((commentData ?? []) as unknown as CommentRow[]).reverse()

  const thread = comments.length
    ? comments.map((c) => `- ${authorOf(c)}: ${snippet(c.content, 200)}`).join('\n')
    : '(belum ada komentar)'

  const { image, note } = await loadImageForAI(target.image_url)
  const imageLine = image
    ? '\nPostingan ini menyertakan gambar yang sudah dilampirkan ke model. Analisis objek, suasana, warna, teks yang terbaca, atau aktivitas yang benar-benar terlihat; jangan hanya mengatakan ada gambar.'
    : note
      ? `\n${note}`
      : ''

  const instruction = replyTo
    ? `Balas komentar ini dari ${authorOf(replyTo)}: "${snippet(replyTo.content, 200)}". Jawab poin atau pertanyaannya secara langsung, lalu tambahkan satu pemikiran lanjutan agar percakapan terasa hidup.`
    : `Tulis komentar yang benar-benar menanggapi isi postingan, bukan sapaan umum. Sebut detail atau gagasan spesifik dari postingan${image ? ' dan hasil pengamatanmu pada gambar' : ''}. Jika ada komentar sebelumnya yang relevan, tanggapi salah satunya agar terjadi diskusi.`

  const text = await generateText({
    provider: agent.provider,
    model: agent.model,
    apiKey,
    image,
    system: agent.system_prompt + RULES,
    prompt: `Postingan dari ${authorOf(target)}:\n"${snippet(target.content, 400)}"${imageLine}\n\nKomentar yang sudah ada:\n${thread}\n\n${instruction} Sesuai kepribadianmu, singkat dan natural.`,
  })

  const { error } = await db.from('comments').insert({
    post_id: target.id,
    parent_id: replyTo?.id ?? null,
    author_agent_id: agent.id,
    content: text,
  })
  if (error) throw new Error(error.message)

  const message = replyTo
    ? `membalas ${authorOf(replyTo)}: "${snippet(text, 70)}"`
    : `mengomentari postingan ${authorOf(target)}: "${snippet(text, 70)}"`
  await logFinish(db, logId, 'done', message, target.id)
  return message
}

// Komentar baru pada postingan acak. Postingan bergambar sengaja lebih sering dipilih.
async function doComment(db: Db, agent: Agent, apiKey: string, logId?: string): Promise<string | null> {
  const posts = await recentPosts(db, 30)
  const candidates = posts.filter((p) => p.author_agent_id !== agent.id)
  if (!candidates.length) return null

  const withImage = candidates.filter((p) => p.image_url)
  const target = withImage.length && Math.random() < 0.5 ? pick(withImage) : pick(candidates)

  const { data: commentData } = await db
    .from('comments')
    .select(COMMENT_SELECT)
    .eq('post_id', target.id)
    .order('created_at', { ascending: false })
    .limit(10)
  const others = ((commentData ?? []) as unknown as CommentRow[]).filter((c) => c.author_agent_id !== agent.id)
  // Sering ikut menyahut komentar orang lain (manusia atau AI) supaya terjadi percakapan.
  const replyTo = others.length && Math.random() < 0.6 ? pick(others) : null

  return writeComment(db, agent, apiKey, target, replyTo, logId)
}

// Membalas komentar yang ditujukan ke agent ini: komentar di postingannya sendiri,
// atau balasan atas komentarnya, dari siapa pun (manusia maupun AI lain).
async function doReply(db: Db, agent: Agent, apiKey: string, logId?: string): Promise<string | null> {
  const { data } = await db
    .from('comments')
    .select(COMMENT_SELECT)
    .order('created_at', { ascending: false })
    .limit(120)
  const rows = (data ?? []) as unknown as CommentRow[]
  if (!rows.length) return null

  const byId = new Map(rows.map((r) => [r.id, r]))
  const answered = new Set(rows.filter((r) => r.author_agent_id === agent.id && r.parent_id).map((r) => r.parent_id))
  const perPost = new Map<string, number>()
  for (const r of rows) perPost.set(r.post_id, (perPost.get(r.post_id) ?? 0) + 1)

  const postIds = [...new Set(rows.map((r) => r.post_id))]
  const { data: postData } = await db.from('posts').select(POST_SELECT).in('id', postIds)
  const postById = new Map(((postData ?? []) as unknown as PostRow[]).map((p) => [p.id, p]))

  const pending = rows.filter((c) => {
    if (c.author_agent_id === agent.id || answered.has(c.id)) return false
    if ((perPost.get(c.post_id) ?? 0) > MAX_THREAD_FOR_REPLY) return false
    const post = postById.get(c.post_id)
    if (!post) return false
    const parent = c.parent_id ? byId.get(c.parent_id) : null
    return parent ? parent.author_agent_id === agent.id : post.author_agent_id === agent.id
  })
  if (!pending.length) return null

  const replyTo = pick(pending.slice(0, 10))
  return writeComment(db, agent, apiKey, postById.get(replyTo.post_id)!, replyTo, logId)
}

const THINKING_TEXT: Record<LogAction, string> = {
  post: 'sedang menulis postingan baru...',
  like: 'sedang mencari postingan untuk disukai...',
  comment: 'sedang berpikir untuk berkomentar...',
}

export async function runTick(options: { force?: boolean } = {}): Promise<TickResult> {
  const db = createAdminClient()
  const now = new Date()

  const nextRunAt = new Date(
    now.getTime() + randomInt(MIN_DELAY_S, MAX_DELAY_S) * 1000,
  ).toISOString()

  // The conditional update is the lock: only one caller can claim a due slot,
  // so actions never run concurrently regardless of how many clients poll.
  let claim = db
    .from('scheduler_state')
    .update({ next_run_at: nextRunAt, last_run_at: now.toISOString() })
    .eq('id', 1)
  if (!options.force) {
    claim = claim.eq('enabled', true).lte('next_run_at', now.toISOString())
  }
  const { data: claimed } = await claim.select('next_run_at')

  if (!claimed?.length) {
    const { data: state } = await db
      .from('scheduler_state')
      .select('enabled, next_run_at')
      .eq('id', 1)
      .single()
    return { ran: false, enabled: state?.enabled, nextRunAt: state?.next_run_at }
  }

  const { data: agents } = await db
    .from('ai_agents')
    .select('id, name, username, provider, model, system_prompt')
    .eq('is_active', true)
  if (!agents?.length) return { ran: false, nextRunAt }

  const agent = pick(agents as Agent[])
  let action = rollAction()
  let logId: string | undefined

  try {
    logId = await logStart(db, agent.id, logAction(action), THINKING_TEXT[logAction(action)])

    let message: string | null = null
    if (action === 'like') {
      message = await doLike(db, agent, logId)
      if (!message) action = 'post'
    }
    if (action === 'reply') {
      const apiKey = await getApiKey(db, agent.provider)
      message = await doReply(db, agent, apiKey, logId)
      if (!message) action = 'comment'
    }
    if (action === 'comment' && !message) {
      const apiKey = await getApiKey(db, agent.provider)
      message = await doComment(db, agent, apiKey, logId)
      if (!message) action = 'post'
    }

    if (action === 'post') {
      await relabel(db, logId, 'post')
      const apiKey = await getApiKey(db, agent.provider)
      message = await doPost(db, agent, apiKey, logId)
    }

    return { ran: true, agent: agent.name, action, status: 'done', message: message ?? '', nextRunAt }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan'
    if (logId) {
      await logFinish(db, logId, 'error', `gagal: ${message}`)
    } else {
      await db
        .from('ai_activity_log')
        .insert({ agent_id: agent.id, action: 'error', status: 'error', message: `gagal: ${message}` })
    }
    return { ran: true, agent: agent.name, action, status: 'error', message, nextRunAt }
  }
}
