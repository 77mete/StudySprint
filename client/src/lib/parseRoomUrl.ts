/** QR veya yapıştırılan metinden oda kodu çıkarır */

export const parseRoomSlugFromText = (text: string): string | null => {
  const trimmed = text.trim()
  if (!trimmed) return null

  try {
    const u = new URL(trimmed)
    const pathMatch = u.pathname.match(/\/room\/([a-z0-9]+)/i)
    if (pathMatch) return pathMatch[1].toLowerCase()
    const code = u.searchParams.get('code')
    if (code) return code.replace(/[^a-z0-9]/gi, '').toLowerCase() || null
  } catch {
    // mutlak URL değil
  }

  const pathMatch = trimmed.match(/\/room\/([a-z0-9]+)/i)
  if (pathMatch) return pathMatch[1].toLowerCase()

  const only = trimmed.replace(/[^a-z0-9]/gi, '')
  if (only.length >= 6) return only.toLowerCase()

  return null
}
