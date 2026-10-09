'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, ShieldBan } from 'lucide-react'
import { useSWRConfig } from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import { validateAvatar } from '@/lib/gif'
import { profilePath, type ProfileFull } from '@/lib/types'

interface Props {
  profile: ProfileFull
  open: boolean
  onOpenChange: (open: boolean) => void
  adminMode?: boolean
}

function friendlyDbError(message: string) {
  if (message.includes('Username harus')) return 'Username harus 3-20 karakter: huruf kecil, angka, atau underscore.'
  if (message.includes('sudah dipakai') || message.includes('duplicate')) return 'Username sudah dipakai.'
  if (message.includes('Bio')) return 'Bio maksimal 160 karakter.'
  return 'Gagal menyimpan profil.'
}

export function EditProfileDialog({ profile, open, onOpenChange, adminMode = false }: Props) {
  const router = useRouter()
  const { mutate } = useSWRConfig()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [banReason, setBanReason] = useState(profile.ban_reason ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDisplayName(profile.display_name)
    setUsername(profile.username)
    setBio(profile.bio)
    setBanReason(profile.ban_reason ?? '')
    setFile(null)
    setPreview(null)
    setError(null)
  }, [open, profile])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const usernameRule = profile.is_admin ? 'Owner/admin boleh memakai username apa saja.' : 'Minimal 3 karakter: huruf kecil, angka, atau underscore.'

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    e.target.value = ''
    if (!picked) return
    const result = validateAvatar(new Uint8Array(await picked.arrayBuffer()))
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  async function refreshEverything(nextUsername: string) {
    await mutate(() => true, undefined, { revalidate: true })
    if (nextUsername !== profile.username) router.replace(profilePath(nextUsername))
    else router.refresh()
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const name = displayName.trim()
    const handle = username.trim().toLowerCase()
    if (!name) return setError('Nama tampilan wajib diisi.')
    if (!profile.is_admin && !/^[a-z0-9_]{3,20}$/.test(handle)) return setError('Username minimal 3 karakter: huruf kecil, angka, atau underscore.')
    if (profile.is_admin && !/^[a-z0-9_]{1,30}$/.test(handle)) return setError('Username hanya boleh huruf kecil, angka, dan underscore.')

    setSaving(true)
    if (file) {
      const form = new FormData()
      form.append('file', file)
      if (adminMode) form.append('userId', profile.id)
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Gagal mengunggah foto.')
        setSaving(false)
        return
      }
    }

    if (adminMode) {
      const res = await fetch(`/api/admin/users/${profile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: name, username: handle, bio: bio.trim() }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? 'Gagal menyimpan profil.')
        setSaving(false)
        return
      }
    } else {
      const { error: dbError } = await createClient()
        .from('profiles')
        .update({ display_name: name, username: handle, bio: bio.trim() })
        .eq('id', profile.id)
      if (dbError) {
        setError(friendlyDbError(dbError.message))
        setSaving(false)
        return
      }
    }

    setSaving(false)
    toast.success('Profil diperbarui')
    onOpenChange(false)
    await refreshEverything(handle)
  }

  async function adminAction(body: Record<string, unknown>, success: string) {
    setSaving(true)
    const res = await fetch(`/api/admin/users/${profile.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setSaving(false)
    if (!res.ok) {
      const data = await res.json().catch(() => null)
      setError(data?.error ?? 'Aksi gagal.')
      return
    }
    toast.success(success)
    onOpenChange(false)
    await refreshEverything(profile.username)
  }

  const shownAvatar = preview ?? profile.avatar_url

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{adminMode ? `Kelola @${profile.username}` : 'Edit profil'}</DialogTitle>
          <DialogDescription>
            {adminMode ? 'Ubah data akun atau atur status ban pengguna.' : 'Perbarui foto, nama, username, dan bio kamu.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {shownAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shownAvatar} alt="Foto profil" className="size-20 rounded-full bg-secondary object-cover" />
              ) : (
                <div className="size-20 rounded-full bg-secondary" />
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Ganti foto profil"
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
                aria-label="Pilih file foto profil"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              GIF, PNG, JPG, atau WebP. Maksimal 2 MB. GIF animasi maksimal 5 detik.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-name">Nama tampilan</Label>
            <Input id="ep-name" value={displayName} maxLength={40} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-username">Username</Label>
            <Input
              id="ep-username"
              value={username}
              maxLength={profile.is_admin ? 30 : 20}
              autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
            <p className="text-xs text-muted-foreground">{usernameRule}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-bio">Bio</Label>
            <Textarea id="ep-bio" value={bio} maxLength={160} rows={3} onChange={(e) => setBio(e.target.value)} />
            <p className="text-right text-xs text-muted-foreground">{bio.length}/160</p>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>

        {adminMode && (
          <div className="space-y-3 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={saving}
              onClick={() => adminAction({ reset_avatar: true }, 'Foto profil direset')}
            >
              Reset foto profil
            </Button>
            {!profile.is_admin && (
              <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <ShieldBan className="size-4" aria-hidden />
                  {profile.is_banned ? 'Akun ini sedang dibanned' : 'Banned akun'}
                </p>
                {profile.is_banned ? (
                  <>
                    {profile.ban_reason && <p className="text-xs text-muted-foreground">Alasan: {profile.ban_reason}</p>}
                    <Button
                      type="button"
                      size="sm"
                      disabled={saving}
                      onClick={() => adminAction({ is_banned: false }, 'Ban dicabut')}
                    >
                      Cabut ban
                    </Button>
                  </>
                ) : (
                  <>
                    <Input
                      value={banReason}
                      maxLength={200}
                      placeholder="Alasan (opsional)"
                      aria-label="Alasan ban"
                      onChange={(e) => setBanReason(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={saving}
                      onClick={() => adminAction({ is_banned: true, ban_reason: banReason }, 'Akun dibanned')}
                    >
                      Banned akun
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
