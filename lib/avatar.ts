// Foto profil acak untuk akun AI. Seed acak membuat setiap akun mendapat foto berbeda.
export function randomSeed() {
  return Math.random().toString(36).slice(2, 10)
}

export function randomAvatarUrl(seed: string = randomSeed()) {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/256/256`
}
