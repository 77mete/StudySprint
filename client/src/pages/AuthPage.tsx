import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl } from '../lib/apiBase'
import { getAuthToken, setAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'

type Mode = 'login' | 'register' | 'forgot' | 'change'

const parseApiError = async (r: Response): Promise<string> => {
  const ct = r.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) {
      const j = (await r.json()) as { error?: string; message?: string }
      return j.error ?? j.message ?? `Sunucu yanıtı: ${r.status}`
    }
    const t = await r.text()
    return t.slice(0, 200) || `İstek başarısız (${r.status})`
  } catch {
    return r.status === 0
      ? 'Ağ hatası — bağlantınızı veya sunucu adresini kontrol edin.'
      : `İstek başarısız (${r.status})`
  }
}

const passwordHints = (pwd: string) => ({
  len: pwd.length >= 8,
  upper: /[A-Z]/.test(pwd),
  digit: /[0-9]/.test(pwd),
  special: /[^A-Za-z0-9]/.test(pwd),
})

export const AuthPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const clientId = getOrCreateClientId()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const reason = searchParams.get('reason')

  const [sessionToken, setSessionToken] = useState<string | null>(() => getAuthToken())
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPassword2, setNewPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const regHints = useMemo(() => passwordHints(password), [password])
  const newHints = useMemo(() => passwordHints(newPassword), [newPassword])
  const allRegOk = regHints.len && regHints.upper && regHints.digit && regHints.special

  const goHome = () => navigate(from, { replace: true })

  const handleSubmit = async () => {
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body =
        mode === 'login'
          ? { email, password, clientId }
          : { email, password, clientId }
      const r = await fetch(apiUrl(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = (await r.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        token?: string
        user?: { mustChangePassword?: boolean }
        devTempPassword?: string
      }
      if (!r.ok || !d.ok) {
        setError(d.error ?? (await parseApiError(r)))
        return
      }
      if (mode === 'register' && d.token) {
        setAuthToken(d.token)
        setSessionToken(d.token)
        goHome()
        return
      }
      if (mode === 'login' && d.token) {
        setAuthToken(d.token)
        setSessionToken(d.token)
        if (d.user?.mustChangePassword) {
          setMode('change')
          setPassword('')
          setNewPassword('')
          setNewPassword2('')
          setInfo('Geçici şifre ile girdiniz. Lütfen yeni şifrenizi belirleyin.')
          return
        }
        goHome()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(
        msg.includes('Failed to fetch') || msg.includes('NetworkError')
          ? 'Sunucuya ulaşılamıyor. İnternet bağlantınızı ve API adresini (HTTPS) kontrol edin.'
          : 'Beklenmeyen bir hata oluştu.',
      )
    } finally {
      setBusy(false)
    }
  }

  const handleForgot = async () => {
    setError(null)
    setInfo(null)
    if (!email.trim()) {
      setError('E-posta adresinizi girin.')
      return
    }
    setBusy(true)
    try {
      const r = await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const d = (await r.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        message?: string
        devTempPassword?: string
      }
      if (!r.ok || !d.ok) {
        setError(d.error ?? (await parseApiError(r)))
        return
      }
      setInfo(d.message ?? 'İşlem tamamlandı.')
      if (d.devTempPassword) {
        setInfo(
          (d.message ?? '') +
            ` Geçici şifre (yalnızca geliştirme): ${d.devTempPassword}`,
        )
      }
      setMode('login')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg.includes('fetch') ? 'Bağlantı hatası.' : 'İstek gönderilemedi.')
    } finally {
      setBusy(false)
    }
  }

  const handleChangePassword = async () => {
    setError(null)
    setInfo(null)
    if (newPassword !== newPassword2) {
      setError('Yeni şifreler eşleşmiyor.')
      return
    }
    if (!newHints.len || !newHints.upper || !newHints.digit || !newHints.special) {
      setError('Yeni şifre tüm güvenlik kurallarını sağlamalı.')
      return
    }
    setBusy(true)
    try {
      const t = getAuthToken()
      const r = await fetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: password,
          newPassword,
        }),
      })
      const d = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (!r.ok || !d.ok) {
        setError(d.error ?? (await parseApiError(r)))
        return
      }
      setInfo('Şifreniz güncellendi.')
      setPassword('')
      setNewPassword('')
      setNewPassword2('')
      goHome()
    } catch {
      setError('Bağlantı hatası.')
    } finally {
      setBusy(false)
    }
  }

  const panelClass =
    'rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-xl transition-all duration-300 dark:border-slate-800 dark:bg-slate-900/90'

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-10 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
            {mode === 'change' ? 'Şifre değiştir' : mode === 'forgot' ? 'Şifremi unuttum' : 'Giriş / Kayıt'}
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {reason === 'goals' && (
              <span className="block rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                Günlük hedef ve istatistikler için giriş yapmanız gerekir.
              </span>
            )}
            {mode === 'login' && (
              <>
                Hesabın yoksa kayıt sekmesine geçin; verileriniz cihazlar arası senkronize olur.
              </>
            )}
            {mode === 'register' && <>Güçlü bir şifre seçin (büyük harf, rakam, özel karakter).</>}
            {mode === 'forgot' && <>Kayıtlı e-postanıza geçici şifre gönderilir (SMTP yapılandırılmışsa).</>}
          </p>
        </div>

        {mode !== 'change' && mode !== 'forgot' && (
          <div className="flex rounded-xl border border-slate-200 bg-white/90 p-1 dark:border-slate-800 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => {
                setMode('login')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === 'login'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Giriş
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
                mode === 'register'
                  ? 'bg-brand-600 text-white shadow'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Kayıt
            </button>
          </div>
        )}

        <div className={panelClass}>
          {mode === 'change' ? (
            <div className="space-y-4">
              {info && <p className="text-sm text-brand-700 dark:text-brand-300">{info}</p>}
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Mevcut şifre (geçici)</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Yeni şifre</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <ul className="text-xs text-slate-600 dark:text-slate-500">
                <li className={newHints.len ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {newHints.len ? '✓' : '○'} En az 8 karakter
                </li>
                <li className={newHints.upper ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {newHints.upper ? '✓' : '○'} En az bir büyük harf
                </li>
                <li className={newHints.digit ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {newHints.digit ? '✓' : '○'} En az bir rakam
                </li>
                <li className={newHints.special ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                  {newHints.special ? '✓' : '○'} En az bir özel karakter
                </li>
              </ul>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Yeni şifre (tekrar)</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={newPassword2}
                  onChange={(e) => setNewPassword2(e.target.value)}
                />
              </label>
              {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
              <button
                type="button"
                onClick={() => void handleChangePassword()}
                disabled={busy}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? '…' : 'Şifreyi güncelle'}
              </button>
            </div>
          ) : mode === 'forgot' ? (
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">E-posta</span>
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
              {info && <p className="text-sm text-emerald-700 dark:text-emerald-300">{info}</p>}
              <button
                type="button"
                onClick={() => void handleForgot()}
                disabled={busy}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? '…' : 'Geçici şifre gönder'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                }}
                className="w-full text-sm text-brand-600 dark:text-brand-400"
              >
                Girişe dön
              </button>
            </div>
          ) : (
            <>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">E-posta</span>
                <input
                  type="email"
                  autoComplete="email"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </label>
              <label className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Şifre</span>
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              {mode === 'register' && (
                <ul className="text-xs text-slate-600 dark:text-slate-500">
                  <li className={regHints.len ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                    {regHints.len ? '✓' : '○'} En az 8 karakter
                  </li>
                  <li className={regHints.upper ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                    {regHints.upper ? '✓' : '○'} En az bir büyük harf
                  </li>
                  <li className={regHints.digit ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                    {regHints.digit ? '✓' : '○'} En az bir rakam
                  </li>
                  <li className={regHints.special ? 'text-emerald-600 dark:text-emerald-400' : ''}>
                    {regHints.special ? '✓' : '○'} En az bir özel karakter
                  </li>
                </ul>
              )}
              {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
              {mode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot')
                    setError(null)
                  }}
                  className="text-sm text-brand-600 hover:underline dark:text-brand-400"
                >
                  Şifremi unuttum
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={busy || (mode === 'register' && !allRegOk)}
                className="mt-2 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {busy ? '…' : mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs text-slate-500">
          Cihaz kimliği: <span className="font-mono text-slate-600 dark:text-slate-400">{clientId.slice(0, 8)}…</span>
        </p>

        {sessionToken && mode !== 'change' && (
          <button
            type="button"
            onClick={() => {
              setAuthToken(null)
              setSessionToken(null)
            }}
            className="w-full rounded-xl border border-slate-300 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
          >
            Çıkış yap
          </button>
        )}

        <Link
          to="/"
          className="block text-center text-sm text-brand-600 dark:text-brand-400"
        >
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
