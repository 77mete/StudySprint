/**
 * Üretimde tam kök URL (örn. https://api-xxx.up.railway.app).
 * Boşsa aynı origin: Vite dev proxy veya barındırıcıdaki /api yönlendirmesi.
 */
export const getBackendOrigin = (): string => {
  const raw = import.meta.env.VITE_BACKEND_URL
  if (typeof raw !== 'string') return ''
  let s = raw.trim().replace(/\/$/, '')
  if (!s || s === 'undefined' || s === 'null') return ''

  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`
  }

  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (s.startsWith('http://')) {
      console.warn(
        '[StudySprint] VITE_BACKEND_URL http ile tanımlı; sayfa HTTPS. Karışık içerik engellenir. Aynı kök (/api) kullanılıyor — backend için HTTPS kullanın veya env’i boş bırakın.',
      )
      return ''
    }
  }

  return s
}

export const apiUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getBackendOrigin()
  return base ? `${base}${p}` : p
}
