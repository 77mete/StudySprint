import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { apiUrl, getBackendOrigin } from '../lib/apiBase'
import { getAuthToken, setAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'

type Mode = 'login' | 'register' | 'forgot' | 'change'

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
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showNewPassword2, setShowNewPassword2] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  /** Giriş ↔ Kayıt geçiş animasyonu; ilk yüklemede sınıf yok */
  const [authAnimTick, setAuthAnimTick] = useState(0)
  const [authAnimDir, setAuthAnimDir] = useState<'lr' | 'rl'>('lr')

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
      const rawText = await r.text()
      let d = {} as {
        ok?: boolean
        error?: string
        message?: string
        token?: string
        user?: { mustChangePassword?: boolean }
        devTempPassword?: string
      }
      try {
        d = rawText ? (JSON.parse(rawText) as typeof d) : {}
      } catch {
        d = {}
      }
      if (!r.ok || !d.ok) {
        const hint =
          typeof d.error === 'string'
            ? d.error
            : typeof d.message === 'string'
              ? d.message
              : rawText.trimStart().startsWith('<')
                ? `API yanıtı HTML döndü (${r.status}). Üretimde /api isteklerinin arka uca yönlendirildiğinden veya VITE_BACKEND_URL’in doğru HTTPS adresi olduğundan emin olun.`
                : rawText.slice(0, 200) || `İstek başarısız (${r.status})`
        setError(hint)
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
      const net =
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.toLowerCase().includes('load failed')
      if (net) {
        const origin = getBackendOrigin()
        setError(
          origin
            ? `Sunucuya ulaşılamıyor (${origin}). HTTPS adresinin doğru olduğundan ve sunucunun CORS izni verdiğinden emin olun.`
            : 'Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin; geliştirmede API sunucusunun (ör. localhost:3001) çalıştığından emin olun. Üretimde VITE_BACKEND_URL için tam HTTPS kökü veya boş (aynı site /api) kullanın.',
        )
      } else {
        setError('Beklenmeyen bir hata oluştu.')
      }
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
      const rawText = await r.text()
      let d = {} as {
        ok?: boolean
        error?: string
        message?: string
        devTempPassword?: string
      }
      try {
        d = rawText ? (JSON.parse(rawText) as typeof d) : {}
      } catch {
        d = {}
      }
      if (!r.ok || !d.ok) {
        setError(
          d.error ||
            d.message ||
            rawText.slice(0, 200) ||
            `İstek başarısız (${r.status})`,
        )
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
      const rawText = await r.text()
      let d = {} as { ok?: boolean; error?: string; message?: string }
      try {
        d = rawText ? (JSON.parse(rawText) as typeof d) : {}
      } catch {
        d = {}
      }
      if (!r.ok || !d.ok) {
        setError(
          d.error ||
            d.message ||
            rawText.slice(0, 200) ||
            `İstek başarısız (${r.status})`,
        )
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

  const authFormAnimClass =
    authAnimTick === 0 ? '' : authAnimDir === 'lr' ? 'ss-auth-enter-lr' : 'ss-auth-enter-rl'

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
          <div className="flex rounded-xl border border-slate-200 bg-white/90 p-1 shadow-sm transition-shadow duration-300 dark:border-slate-800 dark:bg-slate-900/40">
            <button
              type="button"
              onClick={() => {
                if (mode !== 'login') {
                  setAuthAnimDir('rl')
                  setAuthAnimTick((t) => t + 1)
                }
                setMode('login')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-300 ease-out ${
                mode === 'login'
                  ? 'scale-[1.02] bg-brand-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              Giriş
            </button>
            <button
              type="button"
              onClick={() => {
                if (mode !== 'register') {
                  setAuthAnimDir('lr')
                  setAuthAnimTick((t) => t + 1)
                }
                setMode('register')
                setError(null)
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all duration-300 ease-out ${
                mode === 'register'
                  ? 'scale-[1.02] bg-brand-600 text-white shadow-md'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
              <div className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Mevcut şifre (geçici)</span>
                <div className="relative mt-1">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[5.5rem] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <label className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showCurrentPassword}
                      onChange={(e) => setShowCurrentPassword(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                    Göster
                  </label>
                </div>
              </div>
              <div className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Yeni şifre</span>
                <div className="relative mt-1">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[5.5rem] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <label className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showNewPassword}
                      onChange={(e) => setShowNewPassword(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                    Göster
                  </label>
                </div>
              </div>
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
              <div className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Yeni şifre (tekrar)</span>
                <div className="relative mt-1">
                  <input
                    type={showNewPassword2 ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[5.5rem] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={newPassword2}
                    onChange={(e) => setNewPassword2(e.target.value)}
                  />
                  <label className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showNewPassword2}
                      onChange={(e) => setShowNewPassword2(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                    Göster
                  </label>
                </div>
              </div>
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
            <div
              key={`${mode}-${authAnimTick}`}
              className={`space-y-4 ${authFormAnimClass}`.trim()}
            >
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
              <div className="block text-sm">
                <span className="text-slate-600 dark:text-slate-400">Şifre</span>
                <div className="relative mt-1">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-[5.5rem] text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <label className="absolute right-2 top-1/2 flex -translate-y-1/2 cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <input
                      type="checkbox"
                      checked={showPassword}
                      onChange={(e) => setShowPassword(e.target.checked)}
                      className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600 dark:bg-slate-900"
                    />
                    Göster
                  </label>
                </div>
              </div>
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
                className="mt-2 w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:hover:scale-100"
              >
                {busy ? '…' : mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
              </button>
            </div>
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
