'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Dices, FlaskConical, Trash2 } from 'lucide-react'
import useSWR, { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { randomAvatarUrl } from '@/lib/avatar'
import { validateAvatar } from '@/lib/gif'
import { profilePath, type AgentAdmin } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Kosong = buat akun AI baru. */
  agentId?: string
}

export async function fetchAdminAgents(): Promise<AgentAdmin[]> {
  const res = await fetch('/api/admin/agents')
  if (!res.ok) throw new Error('forbidden')
  return (await res.json()).agents as AgentAdmin[]
}

const MODEL_HINTS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
]

const selectClass =
  'h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30'

export function AgentEditorDialog({ open, onOpenChange, agentId }: Props) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const { data: agents } = useSWR(open && agentId ? 'admin-agents' : null, fetchAdminAgents)
  const existing = agentId ? agents?.find((a) => a.id === agentId) : undefined

  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [provider, setProvider] = useState<'gemini' | 'groq'>('gemini')
  const [model, setModel] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [active, setActive] = useState(true)
  const [avatar, setAvatar] = useState('')
  const [busy, setBusy] = useState(false)
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (agentId) {
      if (!existing) return
      setName(existing.name)
      setUsername(existing.username)
      setBio(existing.bio ?? '')
      setProvider(existing.provider)
      setModel(existing.model)
      setSystemPrompt(existing.system_prompt)
      setActive(existing.is_active)
      setAvatar(existing.avatar_url ?? '')
    } else {
      setName('')
      setUsername('')
      setBio('')
      setProvider('gemini')
      setModel('')
      setSystemPrompt('')
      setActive(true)
      setAvatar(randomAvatarUrl())
    }
  }, [open, agentId, existing])

  async function refreshAll(nextUsername?: string) {
    await mutate(() => true, undefined, { revalidate: true })
    if (nextUsername && existing && nextUsername !== existing.username) router.replace(profilePath(nextUsername))
    else router.refresh()
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked || !agentId) return
    const check = validateAvatar(new Uint8Array(await picked.arrayBuffer()))
    if (!check.ok) {
      setError(check.error)
      return
    }
    setError(null)
    const form = new FormData()
    form.append('file', picked)
    form.append('agentId', agentId)
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error ?? 'Gagal mengunggah foto.')
      return
    }
    setAvatar(body.avatar_url)
    toast.success('Foto akun AI diganti')
    await refreshAll()
  }

  async function testModel() {
    setTesting(true)
    const res = await fetch('/api/admin/agents/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model }),
    })
    setTesting(false)
    const body = await res.json().catch(() => null)
    if (res.ok && body?.ok) toast.success(`Model aktif. Balasan: ${body.reply}`)
    else toast.error(body?.error ?? 'Model tidak bisa dipakai.')
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    const payload = {
      name,
      username,
      bio,
      provider,
      model,
      system_prompt: systemPrompt,
      is_active: active,
      avatar_url: avatar || randomAvatarUrl(),
    }
    const res = await fetch(agentId ? `/api/admin/agents/${agentId}` : '/api/admin/agents', {
      method: agentId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setBusy(false)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error ?? 'Gagal menyimpan akun AI.')
      return
    }
    toast.success(agentId ? 'Akun AI diperbarui' : 'Akun AI dibuat')
    onOpenChange(false)
    await refreshAll(username.trim().toLowerCase())
  }

  async function remove() {
    if (!agentId || !window.confirm('Hapus akun AI ini beserta datanya? Ini tidak bisa dibatalkan.')) return
    setBusy(true)
    const res = await fetch(`/api/admin/agents/${agentId}`, { method: 'DELETE' })
    setBusy(false)
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error ?? 'Gagal menghapus akun AI.')
      return
    }
    toast.success('Akun AI dihapus')
    onOpenChange(false)
    await mutate(() => true, undefined, { revalidate: true })
    router.push('/')
  }

  const loading = !!agentId && !existing

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{agentId ? 'Kelola akun AI' : 'Tambah akun AI'}</DialogTitle>
          <DialogDescription>
            Model diisi bebas. Kalau model lama sudah tidak tersedia, ganti saja di sini.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="h-40 animate-pulse rounded-2xl bg-secondary/60" aria-busy />
        ) : (
          <form onSubmit={save} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatar} alt="Foto akun AI" className="size-20 rounded-full bg-secondary object-cover" />
                ) : (
                  <div className="size-20 rounded-full bg-secondary" />
                )}
                {agentId && (
                  <>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      aria-label="Unggah foto"
                      className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow"
                    >
                      <Camera className="size-4" aria-hidden />
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/gif,image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={pickFile}
                      aria-label="Pilih file foto akun AI"
                    />
                  </>
                )}
              </div>
              <div className="space-y-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setAvatar(randomAvatarUrl())}>
                  <Dices className="size-4" aria-hidden />
                  Foto acak
                </Button>
                <p className="text-xs text-muted-foreground">
                  {agentId ? 'Atau unggah sendiri (GIF maks. 5 detik).' : 'Foto bisa diganti setelah akun dibuat.'}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ag-name">Nama tampilan</Label>
              <Input id="ag-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-username">Username</Label>
              <Input
                id="ag-username"
                value={username}
                maxLength={30}
                autoCapitalize="none"
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ag-bio">Bio</Label>
              <Textarea id="ag-bio" value={bio} maxLength={160} rows={2} onChange={(e) => setBio(e.target.value)} />
            </div>

            <div className="grid grid-cols-[120px_1fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ag-provider">Provider</Label>
                <select
                  id="ag-provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'gemini' | 'groq')}
                  className={selectClass}
                >
                  <option value="gemini">Gemini</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ag-model">Model</Label>
                <Input
                  id="ag-model"
                  value={model}
                  list="ag-model-hints"
                  autoCapitalize="none"
                  placeholder="mis. gemini-2.5-flash"
                  onChange={(e) => setModel(e.target.value)}
                />
                <datalist id="ag-model-hints">
                  {MODEL_HINTS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>
            <p className="-mt-2 text-xs text-muted-foreground">
              Supaya bisa membaca gambar, pakai model yang mendukung gambar (vision). Kalau tidak, AI tetap
              berkomentar tapi tanpa melihat gambarnya.
            </p>
            <Button type="button" variant="secondary" size="sm" disabled={testing || !model.trim()} onClick={testModel}>
              <FlaskConical className="size-4" aria-hidden />
              {testing ? 'Menguji...' : 'Tes model'}
            </Button>

            <div className="space-y-1.5">
              <Label htmlFor="ag-prompt">Kepribadian (system prompt)</Label>
              <Textarea
                id="ag-prompt"
                value={systemPrompt}
                maxLength={2000}
                rows={5}
                onChange={(e) => setSystemPrompt(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3">
              <Label htmlFor="ag-active" className="text-sm font-medium">
                Aktif (ikut beraksi di feed)
              </Label>
              <Switch id="ag-active" checked={active} onCheckedChange={setActive} />
            </div>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex items-center justify-between gap-2">
              {agentId ? (
                <Button type="button" variant="ghost" size="sm" onClick={remove} disabled={busy} className="text-destructive">
                  <Trash2 className="size-4" aria-hidden />
                  Hapus
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={busy}>
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
