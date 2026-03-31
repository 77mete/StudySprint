import type { RoomCreatePayload } from '../shared'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getOrCreateClientId } from '../lib/clientId'
import { getSocket } from '../lib/socket'

export const HomePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [roomName, setRoomName] = useState('Çalışma odası')
  const [maxParticipants, setMaxParticipants] = useState(8)
  const [durationMinutes, setDurationMinutes] = useState(25)
  const [targetTasks, setTargetTasks] = useState(12)
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [requiresApproval, setRequiresApproval] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const bannerMessage = (location.state as { bannerMessage?: string } | null)?.bannerMessage ?? null

  const handleSubmit = () => {
    if (!roomName.trim()) {
      setError('Oda adı gerekli.')
      return
    }
    if (!isAnonymous && !displayName.trim()) {
      setError('Görünen ad gerekli veya anonim katılmayı seçin.')
      return
    }

    setBusy(true)
    setError(null)
    const socket = getSocket()
    const payload: RoomCreatePayload = {
      roomName: roomName.trim(),
      maxParticipants,
      durationMinutes,
      targetTasks,
      password: password.trim() || undefined,
      displayName: isAnonymous ? '' : displayName.trim(),
      isAnonymous,
      requiresApproval,
      clientId: getOrCreateClientId(),
    }
    socket.emit('room:create', payload, (ack: { ok: boolean; slug?: string; error?: string }) => {
      setBusy(false)
      if (!ack.ok || !ack.slug) {
        setError(ack.error ?? 'Oda oluşturulamadı')
        return
      }
      sessionStorage.setItem(`studysprint_joined_${ack.slug}`, '1')
      navigate(`/room/${ack.slug}`)
    })
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-14 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        {bannerMessage && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-center text-sm text-slate-200">
            {bannerMessage}
          </div>
        )}
        <header className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-400">StudySprint</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Yeni oda oluştur</h1>
          <p className="mt-2 text-sm text-slate-400">
            Oda adı, kapasite ve süreyi belirleyin; herkes hazır olunca kurucu başlatır.
          </p>
        </header>

        <section
          aria-labelledby="form-heading"
          className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-6 shadow-xl backdrop-blur"
        >
          <h2 id="form-heading" className="sr-only">
            Oda ayarları
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Oda adı
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Örn. Gece çalışması"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Oda kapasitesi (kurucu dahil kaç kişi)
              </span>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Görünen ad (kurucu)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adınız (örn. Mete)"
                autoComplete="nickname"
                disabled={isAnonymous}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked)
                  if (e.target.checked) setDisplayName('')
                }}
                className="size-4 rounded border-slate-600"
              />
              Anonim katıl (isim gizli, benzersiz takma ad atanır)
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="size-4 rounded border-slate-600"
              />
              Katılımcılar için kurucu onayı (bekleme odası)
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Çalışma süresi (dk)
                </span>
                <input
                  type="number"
                  min={5}
                  max={240}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Hedef soru / görev
                </span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
                  value={targetTasks}
                  onChange={(e) => setTargetTasks(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Oda şifresi (isteğe bağlı)
              </span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none ring-brand-500/40 focus:ring-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Boş bırakılabilir"
                autoComplete="new-password"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? 'Oluşturuluyor…' : 'Oda oluştur'}
            </button>
          </div>
        </section>

        <p className="text-center text-sm text-slate-500">
          Davet aldınız mı?{' '}
          <Link to="/join" className="text-brand-400 hover:text-brand-300">
            Odaya katıl
          </Link>
        </p>
      </div>
    </div>
  )
}
