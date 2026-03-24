/** Üretimde Socket.io + REST'in çalışması için Node sunucusunun kök URL'i (örn. https://api-xxx.up.railway.app). Boş bırakılırsa aynı origin + Vite proxy kullanılır. */
export const getBackendOrigin = (): string => {
  const raw = import.meta.env.VITE_BACKEND_URL
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/\/$/, '')
}

export const apiUrl = (path: string): string => {
  const p = path.startsWith('/') ? path : `/${path}`
  const base = getBackendOrigin()
  return base ? `${base}${p}` : p
}
