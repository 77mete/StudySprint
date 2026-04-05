import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QrScanPanel } from '../components/QrScanPanel'
import { primeCountdownAudio } from '../lib/countdownAudio'
import { parseRoomSlugFromText } from '../lib/parseRoomUrl'

export const JoinPage = () => {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showQr, setShowQr] = useState(false)

  const goToRoom = useCallback(
    async (rawSlug: string) => {
      const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!slug) {
        setError('Geçerli bir oda kodu girin.')
        return
      }
      setBusy(true)
      setError(null)
      primeCountdownAudio()
      navigate(`/room/${slug}`)
      setBusy(false)
    },
    [navigate],
  )

  const handleJoin = () => {
    void goToRoom(code)
  }

  const handleQr = useCallback(
    (text: string) => {
      const parsed = parseRoomSlugFromText(text)
      if (parsed) {
        void goToRoom(parsed)
      } else {
        setError('QR geçerli bir oda bağlantısı içermiyor.')
      }
    },
    [goToRoom],
  )

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-16 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Odaya katıl</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Önce oda kodunu doğrulayın; şifre gerekiyorsa bir sonraki ekranda sorulur.
        </p>
        <input
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          placeholder="ör. abcde12345"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          aria-label="Oda kodu"
        />
        {error && <p className="text-sm text-amber-700 dark:text-amber-300">{error}</p>}
        <button
          type="button"
          onClick={handleJoin}
          disabled={busy}
          className="ss-btn-primary w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-md shadow-brand-900/25 hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? 'Kontrol ediliyor…' : 'Devam et'}
        </button>

        <div className="text-left">
          {!showQr ? (
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className="ss-btn-outline mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-100"
            >
              QR ile oda kodu okut
            </button>
          ) : (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="flex items-center justify-between gap-3">
                <p className="text-left text-sm font-semibold text-slate-900 dark:text-white">QR tarayıcı</p>
                <button
                  type="button"
                  onClick={() => setShowQr(false)}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-900/60"
                >
                  Kapat
                </button>
              </div>
              <div className="mt-3">
                <QrScanPanel elementId="qr-reader-join" onDecoded={handleQr} />
              </div>
            </div>
          )}
        </div>

        <Link to="/" className="block text-sm text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300">
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
