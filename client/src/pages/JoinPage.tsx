import { useCallback, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { QrScanPanel } from '../components/QrScanPanel'
import { parseRoomSlugFromText } from '../lib/parseRoomUrl'

export const JoinPage = () => {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const goToRoom = useCallback(
    async (rawSlug: string) => {
      const slug = rawSlug.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
      if (!slug) {
        setError('Geçerli bir oda kodu girin.')
        return
      }
      setBusy(true)
      setError(null)
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
    <div className="min-h-full bg-slate-950 px-4 py-16">
      <div className="mx-auto max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-semibold text-white">Odaya katıl</h1>
        <p className="text-sm text-slate-400">
          Önce oda kodunu doğrulayın; şifre gerekiyorsa bir sonraki ekranda sorulur.
        </p>
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-center text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
          placeholder="ör. abcde12345"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          aria-label="Oda kodu"
        />
        {error && <p className="text-sm text-amber-300">{error}</p>}
        <button
          type="button"
          onClick={handleJoin}
          disabled={busy}
          className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
        >
          {busy ? 'Kontrol ediliyor…' : 'Devam et'}
        </button>

        <div className="text-left">
          <p className="mb-2 text-center text-xs text-slate-500">veya QR okut</p>
          <QrScanPanel elementId="qr-reader-join" onDecoded={handleQr} />
        </div>

        <Link to="/" className="block text-sm text-brand-400 hover:text-brand-300">
          Ana sayfa
        </Link>
      </div>
    </div>
  )
}
