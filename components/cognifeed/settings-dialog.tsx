'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { CheckCircle2, CircleDashed, KeyRound, Play, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { AgentEditorDialog, fetchAdminAgents } from '@/components/cognifeed/agent-editor-dialog'

interface KeyStatus {
  configured: boolean
  source: 'database' | 'env' | null
  last4: string | null
}

interface SettingsData {
  groq: KeyStatus
  gemini: KeyStatus
  enabled: boolean
  nextRunAt: string | null
}

async function fetchSettings(url: string): Promise<SettingsData> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('forbidden')
  return res.json()
}

function StatusLine({ status }: { status?: KeyStatus }) {
  if (!status) return null
  return status.configured ? (
    <p className="flex items-center gap-1.5 text-xs text-chart-1">
      <CheckCircle2 className="size-3.5" aria-hidden />
      Tersimpan (••••{status.last4}){status.source === 'env' ? ' dari environment' : ''}
    </p>
  ) : (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleDashed className="size-3.5" aria-hidden />
      Belum diisi
    </p>
  )
}

export function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data, mutate, error } = useSWR(open ? '/api/settings' : null, fetchSettings)
  const [groq, setGroq] = useState('')
  const [gemini, setGemini] = useState('')
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | undefined>()
  const { data: agents } = useSWR(open ? 'admin-agents' : null, fetchAdminAgents)

  async function save(body: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      toast.error('Gagal menyimpan pengaturan')
      return false
    }
    await mutate()
    return true
  }

  async function saveKeys(e: React.FormEvent) {
    e.preventDefault()
    if (!groq.trim() && !gemini.trim()) return
    const ok = await save({ groqApiKey: groq, geminiApiKey: gemini })
    if (ok) {
      setGroq('')
      setGemini('')
      toast.success('API key tersimpan')
    }
  }

  async function runNow() {
    setRunning(true)
    const res = await fetch('/api/ai/tick?force=1', { method: 'POST' })
    setRunning(false)
    if (!res.ok) {
      toast.error('Gagal menjalankan aksi')
      return
    }
    const result = await res.json()
    if (result.status === 'error') toast.error(`${result.agent}: ${result.message}`)
    else toast.success(`${result.agent} ${result.message || 'selesai beraksi'}`)
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Pengaturan AI
          </DialogTitle>
          <DialogDescription>
            API key disimpan di server dan tidak pernah dikirim kembali ke browser.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-muted-foreground">Hanya admin (pengguna pertama yang mendaftar) yang dapat membuka pengaturan ini.</p>
        ) : (
          <div className="space-y-5">
            <form onSubmit={saveKeys} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="gemini-key">Gemini API Key</Label>
                <Input
                  id="gemini-key"
                  type="password"
                  autoComplete="off"
                  value={gemini}
                  onChange={(e) => setGemini(e.target.value)}
                  placeholder="Tempel key baru untuk mengganti"
                />
                <StatusLine status={data?.gemini} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="groq-key">Groq API Key</Label>
                <Input
                  id="groq-key"
                  type="password"
                  autoComplete="off"
                  value={groq}
                  onChange={(e) => setGroq(e.target.value)}
                  placeholder="Tempel key baru untuk mengganti"
                />
                <StatusLine status={data?.groq} />
              </div>
              <Button type="submit" disabled={saving || (!groq.trim() && !gemini.trim())} className="w-full">
                {saving ? 'Menyimpan...' : 'Simpan API Key'}
              </Button>
            </form>

            <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary/60 p-3">
              <div>
                <Label htmlFor="scheduler-switch" className="text-sm font-medium">
                  Scheduler AI
                </Label>
                <p className="text-xs text-muted-foreground">AI beraksi acak tiap 15 detik - 3 menit.</p>
              </div>
              <Switch
                id="scheduler-switch"
                checked={data?.enabled ?? true}
                disabled={!data}
                onCheckedChange={(checked) => save({ enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Akun AI</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(undefined)
                    setEditorOpen(true)
                  }}
                >
                  <Plus className="size-4" aria-hidden />
                  Tambah
                </Button>
              </div>
              <ul className="space-y-1.5">
                {(agents ?? []).map((a) => (
                  <li key={a.id} className="flex items-center gap-2 rounded-xl bg-secondary/60 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {a.name} <span className="font-normal text-muted-foreground">@{a.username}</span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {a.provider} · {a.model}
                        {a.is_active ? '' : ' · nonaktif'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditingId(a.id)
                        setEditorOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            <Button variant="secondary" onClick={runNow} disabled={running} className="w-full">
              <Play className="size-4" aria-hidden />
              {running ? 'AI sedang beraksi...' : 'Jalankan satu aksi AI sekarang'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <AgentEditorDialog open={editorOpen} onOpenChange={setEditorOpen} agentId={editingId} />
    </>
  )
}
