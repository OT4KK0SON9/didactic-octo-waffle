import { generateText as gatewayGenerate } from 'ai'

export type Provider = 'gemini' | 'groq'

export interface ImageInput {
  mimeType: string
  base64: string
}

interface GenerateArgs {
  provider: Provider
  model: string
  apiKey: string
  system: string
  prompt: string
  image?: ImageInput | null
}

const REQUEST_TIMEOUT_MS = 40_000

function shorten(text: string, max = 180) {
  return text.length > max ? `${text.slice(0, max)}...` : text
}

async function readError(res: Response, label: string) {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message ?? ''
  } catch {
    // body was not JSON
  }
  return new Error(`${label} ${res.status}${detail ? `: ${shorten(detail)}` : ''}`)
}

async function generateGemini(args: GenerateArgs): Promise<string> {
  const { model, apiKey, system, prompt, image } = args
  const modelId = model.replace(/^models\//, '')
  const parts: Record<string, unknown>[] = [{ text: prompt }]
  if (image) parts.push({ inline_data: { mime_type: image.mimeType, data: image.base64 } })

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 1,
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!res.ok) {
    // Jangan mencoba fallback dengan parameter yang tidak ada di request.
    // generateText akan memakai gateway untuk error provider yang bisa dipulihkan.
    throw await readError(res, 'Gemini')
  }
  const data = await res.json()
  const out: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? []
  return out.map((p) => p.text ?? '').join('')
}

async function generateGroq({ model, apiKey, system, prompt, image }: GenerateArgs) {
  const userContent = image
    ? [
        { type: 'text', text: prompt },
        { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.base64}` } },
      ]
    : prompt

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 1,
      max_tokens: 300,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) throw await readError(res, 'Groq')
  const data = await res.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

// Dipakai saat admin belum mengisi API key: AI tetap jalan lewat Vercel AI Gateway (tanpa konfigurasi).
export const GATEWAY_KEY = '__ai_gateway__'
const GATEWAY_MODEL = 'openai/gpt-4.1-mini'

async function generateGateway({ system, prompt, image }: GenerateArgs) {
  const { text } = await gatewayGenerate({
    model: GATEWAY_MODEL,
    system,
    maxOutputTokens: 400,
    messages: [
      {
        role: 'user',
        content: image
          ? [
              { type: 'text', text: prompt },
              { type: 'image', image: `data:${image.mimeType};base64,${image.base64}` },
            ]
          : [{ type: 'text', text: prompt }],
      },
    ],
    abortSignal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  return text
}

function run(args: GenerateArgs) {
  if (args.apiKey === GATEWAY_KEY) return generateGateway(args)
  return args.provider === 'gemini' ? generateGemini(args) : generateGroq(args)
}

export async function generateText(args: GenerateArgs): Promise<string> {
  let raw: string
  try {
    raw = await run(args)
  } catch (err) {
    const message = err instanceof Error ? err.message : ''
    // Kunci Gemini/Groq yang tersimpan bisa kedaluwarsa atau tidak valid. Gunakan
    // AI Gateway agar aktivitas tetap berjalan tanpa memblokir seluruh scheduler.
    const authFailure = /\b(400|401|403)\b/.test(message)
    if (args.apiKey !== GATEWAY_KEY && authFailure) {
      raw = await run({ ...args, apiKey: GATEWAY_KEY })
    } else {
      // Model tidak mendukung gambar: ulangi tanpa gambar supaya AI tetap merespons.
      const unsupported = /\b(400|404|422)\b/.test(message)
      if (!args.image || !unsupported) throw err
      raw = await run({
        ...args,
        image: null,
        prompt: `${args.prompt}\n\n(Catatan: gambar tidak bisa kamu lihat saat ini, jadi jangan mengarang isi gambarnya.)`,
      })
    }
  }
  const cleaned = raw
    .trim()
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim()
  if (!cleaned) throw new Error('Model mengembalikan respons kosong')
  return cleaned.length > 480 ? `${cleaned.slice(0, 477)}...` : cleaned
}
