import { getAuthToken } from './authToken'

/**
 * Üretimde tam kök URL (örn. https://api-xxx.up.railway.app).
 * Boş / RELATIVE: aynı origin — Vite dev proxy veya Vercel `vercel.json` rewrite ile backend.
 * Vercel’de CORS sorununu önlemek için genelde boş bırakıp rewrite kullanın.
 */
export const getBackendOrigin = (): string => {
  const raw = import.meta.env.VITE_BACKEND_URL
  if (typeof raw !== 'string') return ''
  let s = raw.trim().replace(/\/$/, '')
  if (!s || s === 'undefined' || s === 'null') return ''
  if (/^relative$/i.test(s) || s === '/') return ''

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

/**
 * Tüm API çağrıları: credentials + localStorage JWT otomatik `Authorization: Bearer`.
 * İstek başına `X-Client-Id` vb. eklemek için init.headers ile birleştirin; Bearer yoksa eklenir.
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
