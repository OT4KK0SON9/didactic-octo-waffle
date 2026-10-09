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

async function generateGemini({ model, apiKey, system, prompt, image }: GenerateArgs, withThinking = true) {
  const modelId = model.replace(/^models\//, '')
  const parts: Record<string, unknown>[] = [{ text: prompt }]
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })

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
          ...(withThinking ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!res.ok) {
    const err = await readError(res, 'Gemini')
    // Model lama tidak mengenal thinkingConfig; ulangi tanpa itu.
    if (withThinking && /thinking/i.test(err.message)) return generateGemini({ model, apiKey, system, prompt, image }, false)
    throw err
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

function run(args: GenerateArgs) {
  return args.provider === 'gemini' ? generateGemini(args) : generateGroq(args)
}

export async function generateText(args: GenerateArgs): Promise<string> {
  let raw: string
  try {
    raw = await run(args)
  } catch (err) {
    // Model tidak mendukung gambar (HTTP 4xx): ulangi tanpa gambar supaya AI tetap bisa merespons.
    const unsupported = err instanceof Error && /\b(400|404|422)\b/.test(err.message)
    if (!args.image || !unsupported) throw err
    raw = await run({
      ...args,
      image: null,
      prompt: `${args.prompt}\n\n(Catatan: gambar tidak bisa kamu lihat saat ini, jadi jangan mengarang isi gambarnya.)`,
    })
  }
  const cleaned = raw
    .trim()
    .replace(/^["“”']+|["“”']+$/g, '')
    .trim()
  if (!cleaned) throw new Error('Model mengembalikan respons kosong')
  return cleaned.length > 480 ? `${cleaned.slice(0, 477)}...` : cleaned
}
