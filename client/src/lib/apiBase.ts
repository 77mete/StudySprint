import { getAuthToken } from './authToken'

/**
 * Bu kök, VITE_BACKEND_URL yokken üretim + Vercel host’larında doğrudan Railway’e bağlanır.
 * Kendi deploy’unda VITE_BACKEND_URL ile override et.
 */
const DEFAULT_RAILWAY_BACKEND = 'https://studysprintserver-production.up.railway.app'

/**
 * Üretimde tam kök URL (örn. https://xxx.up.railway.app).
 * Boş / RELATIVE: geliştirmede Vite proxy (`/api`, `/socket.io`).
 * Vercel’de env silinmişse güvenli varsayılan Railway kökü kullanılır (CORS sunucuda *.vercel.app).
 */
export const getBackendOrigin = (): string => {
  const raw = import.meta.env.VITE_BACKEND_URL
  let s = typeof raw === 'string' ? raw.trim().replace(/\/$/, '') : ''
  if (s === 'undefined' || s === 'null') s = ''

  if (/^relative$/i.test(s) || s === '/') {
    return ''
  }

  if (s) {
    if (!/^https?:\/\//i.test(s)) {
      s = `https://${s}`
    }
    if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
      if (s.startsWith('http://')) {
        console.warn(
          '[StudySprint] VITE_BACKEND_URL http; sayfa HTTPS. Railway için https kullanın veya boş bırakıp varsayılanı kullanın.',
        )
        if (import.meta.env.PROD && window.location.hostname.endsWith('vercel.app')) {
          return DEFAULT_RAILWAY_BACKEND
        }
        return ''
      }
    }
    return s
  }

  if (
    import.meta.env.PROD &&
    typeof window !== 'undefined' &&
    window.location.hostname.endsWith('vercel.app')
  ) {
    return DEFAULT_RAILWAY_BACKEND
  }

  return ''
}

export const apiUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getBackendOrigin()
  return base ? `${base}${p}` : p
}

/**
 * Tüm API çağrıları: credentials + localStorage JWT otomatik `Authorization: Bearer`.
 */
export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const url = apiUrl(path)
  const headers = new Headers(init.headers as HeadersInit | undefined)
  const token = getAuthToken()
  if (token && !headers.get('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })
}
