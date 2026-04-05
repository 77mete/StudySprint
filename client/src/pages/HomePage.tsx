import type { RoomCreatePayload } from '../shared'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiUrl } from '../lib/apiBase'
import { getAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'
import { primeCountdownAudio } from '../lib/countdownAudio'
import { getSocket } from '../lib/socket'

export const HomePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const clientId = useMemo(() => getOrCreateClientId(), [])
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

  const [minutesGoal, setMinutesGoal] = useState(25)
  const [tasksGoal, setTasksGoal] = useState(10)
  const [showGoalModal, setShowGoalModal] = useState(false)
  const [goalDraftMin, setGoalDraftMin] = useState(25)
  const [goalDraftTasks, setGoalDraftTasks] = useState(10)
  const [todayMinutes, setTodayMinutes] = useState(0)
  const [todayTasks, setTodayTasks] = useState(0)

  const bannerMessage = (location.state as { bannerMessage?: string } | null)?.bannerMessage ?? null

  const authHeaders = useCallback(() => {
    const t = getAuthToken()
    const h: Record<string, string> = {}
    if (t) h.Authorization = `Bearer ${t}`
    else h['X-Client-Id'] = clientId
    return h
  }, [clientId])

  const loadGoalsAndProgress = useCallback(async () => {
    const token = getAuthToken()
    const gUrl = token
      ? apiUrl('/api/goals')
      : apiUrl(`/api/goals?clientId=${encodeURIComponent(clientId)}`)
    const aUrl = token
      ? apiUrl('/api/analytics/full')
      : apiUrl(`/api/analytics/full?clientId=${encodeURIComponent(clientId)}`)
    try {
      const [gr, ar] = await Promise.all([
        fetch(gUrl, { headers: authHeaders() }).then((r) => r.json()),
        fetch(aUrl, { headers: authHeaders() }).then((r) => r.json()),
      ])
      if (gr?.ok) {
        setMinutesGoal(Number(gr.minutesGoal) || 25)
        setTasksGoal(Number(gr.tasksGoal) || 10)
      }
      if (ar?.ok) {
        setTodayMinutes(Number(ar.todayMinutes) || 0)
        setTodayTasks(Number(ar.todayTasks) || 0)
      }
    } catch {
      // yoksay
    }
  }, [authHeaders, clientId])

  useEffect(() => {
    void loadGoalsAndProgress()
  }, [loadGoalsAndProgress])

  useEffect(() => {
    const id = window.setInterval(() => void loadGoalsAndProgress(), 30_000)
    return () => window.clearInterval(id)
  }, [loadGoalsAndProgress])

  const timePct = Math.min(100, minutesGoal > 0 ? (todayMinutes / minutesGoal) * 100 : 0)
  const taskPct = Math.min(100, tasksGoal > 0 ? (todayTasks / tasksGoal) * 100 : 0)
  const combinedPct = Math.round((timePct + taskPct) / 2)
  const remMin = Math.max(0, minutesGoal - todayMinutes)
  const remTasks = Math.max(0, tasksGoal - todayTasks)

  const handleSaveGoals = async () => {
    const token = getAuthToken()
    const body: Record<string, unknown> = {
      minutesGoal: goalDraftMin,
      tasksGoal: goalDraftTasks,
    }
    if (!token) body.clientId = clientId
    try {
      const r = await fetch(apiUrl('/api/goals'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d?.ok) {
        setMinutesGoal(goalDraftMin)
        setTasksGoal(goalDraftTasks)
        setShowGoalModal(false)
        void loadGoalsAndProgress()
      }
    } catch {
      // yoksay
    }
  }

  const handleSubmit = () => {
    if (!roomName.trim()) {
      setError('Oda adı gerekli.')
      return
    }
    if (!isAnonymous && !displayName.trim()) {
      setError('Görünen ad gerekli veya anonim katılmayı seçin.')
      return
    }

    primeCountdownAudio()

    setBusy(true)
    setError(null)
    const socket = getSocket()
    if (socket.disconnected) {
      socket.connect()
    }
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
    let handled = false
    const failSafeId = window.setTimeout(() => {
      if (handled) return
      handled = true
      setBusy(false)
      setError('Sunucuya baglanilamadi. Baglantiyi kontrol edip tekrar deneyin.')
    }, 8000)

    socket.emit('room:create', payload, (ack: { ok: boolean; slug?: string; error?: string }) => {
      if (handled) return
      handled = true
      window.clearTimeout(failSafeId)
      setBusy(false)
      if (!ack.ok || !ack.slug) {
        setError(ack.error ?? 'Oda oluşturulamadı')
        return
      }
      sessionStorage.setItem(`studysprint_joined_${ack.slug}`, '1')
      navigate(`/room/${ack.slug}`)
    })
  }

  const openGoalModal = () => {
    setGoalDraftMin(minutesGoal)
    setGoalDraftTasks(tasksGoal)
    setShowGoalModal(true)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        {bannerMessage && (
          <div className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-3 text-center text-sm text-slate-200">
            {bannerMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/stats"
            className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-2 text-sm font-medium text-brand-200 hover:bg-slate-800"
          >
            İstatistiklerim
          </Link>
          <button
            type="button"
            onClick={openGoalModal}
            className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-500/20"
          >
            Günlük hedef belirle
          </button>
          <Link
            to="/auth"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
          >
            Giriş / Kayıt
          </Link>
          <button
            type="button"
            onClick={() => primeCountdownAudio()}
            className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800"
          >
            Geri sayım sesini aç
          </button>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <h2 className="text-sm font-semibold text-white">Bugünkü hedeflerin</h2>
          <p className="mt-1 text-xs text-slate-500">
            Çalışma: {todayMinutes} / {minutesGoal} dk · Soru: {todayTasks} / {tasksGoal}
          </p>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-500"
              style={{ width: `${combinedPct}%` }}
            />
          </div>
          <p className="mt-2 text-center text-lg font-semibold tabular-nums text-white">
            %{combinedPct}
          </p>
          <p className="mt-1 text-center text-xs text-slate-400">
            Kalan süre: <strong className="text-slate-200">{remMin} dk</strong> · Kalan soru:{' '}
            <strong className="text-slate-200">{remTasks}</strong>
          </p>
        </section>

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

        {showGoalModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goal-title"
          >
            <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
              <h2 id="goal-title" className="text-lg font-semibold text-white">
                Günlük hedef
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Bugün için toplam çalışma süresi ve çözülecek soru hedefini girin.
              </p>
              <label className="mt-4 block text-sm">
                <span className="text-slate-500">Dakika</span>
                <input
                  type="number"
                  min={5}
                  max={720}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  value={goalDraftMin}
                  onChange={(e) => setGoalDraftMin(Number(e.target.value))}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="text-slate-500">Soru / görev</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  value={goalDraftTasks}
                  onChange={(e) => setGoalDraftTasks(Number(e.target.value))}
                />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGoals()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
