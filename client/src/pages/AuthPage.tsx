import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiUrl } from '../lib/apiBase'
import { getAuthToken, setAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'

export const AuthPage = () => {
  const navigate = useNavigate()
  const clientId = getOrCreateClientId()
  const [sessionToken, setSessionToken] = useState<string | null>(() => getAuthToken())
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async () => {
    setError(null)
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
      const d = await r.json()
      if (!d.ok) {
        setError(d.error ?? 'İşlem başarısız')
        return
      }
      if (d.token) {
        setAuthToken(d.token)
        setSessionToken(d.token)
        navigate('/')
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-14">
      <div className="mx-auto max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-white">Giriş / Kayıt</h1>
          <p className="mt-2 text-sm text-slate-400">
            Misafir olarak da uygulamayı kullanabilirsiniz; kayıt ile verileriniz cihazlar arası
            senkronize olur.
          </p>
        </div>

        <div className="flex rounded-xl border border-slate-800 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'login' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            Giriş
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              mode === 'register' ? 'bg-brand-600 text-white' : 'text-slate-400'
            }`}
          >
            Kayıt
          </button>
        </div>

        <label className="block text-sm">
          <span className="text-slate-500">E-posta</span>
          <input
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-500">Şifre (en az 6 karakter)</span>
          <input
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="text-sm text-amber-300">{error}</p>}

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={busy}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? '…' : mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Cihaz kimliği: <span className="font-mono text-slate-400">{clientId.slice(0, 8)}…</span>
        </p>

        {sessionToken && (
          <button
            type="button"
            onClick={() => {
              setAuthToken(null)
              setSessionToken(null)
            }}
            className="w-full rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:bg-slate-900"
          >
            Çıkış yap
          </button>
        )}

        <Link to="/" className="block text-center text-sm text-brand-400">
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
