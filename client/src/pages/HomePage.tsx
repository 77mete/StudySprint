import type { RoomCreatePayload } from '../shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { apiFetch } from '../lib/apiBase'
import { getAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'
import { primeCountdownAudio } from '../lib/countdownAudio'
import { useAuthToken } from '../hooks/useAuthToken'
import { getSocket } from '../lib/socket'

export const HomePage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { pushToast } = useToast()
  const authToken = useAuthToken()
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
  const prevTodayRef = useRef<{ m: number; t: number } | null>(null)

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
    if (!token) {
      setMinutesGoal(25)
      setTasksGoal(10)
      setTodayMinutes(0)
      setTodayTasks(0)
      return
    }
    try {
      const [gr, ar] = await Promise.all([
        apiFetch('/api/goals', { headers: authHeaders() }).then((r) => r.json()),
        apiFetch('/api/analytics/full', { headers: authHeaders() }).then((r) => r.json()),
      ])
      if (ar?.ok) {
        const tm = Number(ar.todayMinutes) || 0
        const tt = Number(ar.todayTasks) || 0
        const mg = gr?.ok ? Number(gr.minutesGoal) || 25 : 25
        const tg = gr?.ok ? Number(gr.tasksGoal) || 10 : 10
        setTodayMinutes(tm)
        setTodayTasks(tt)
        if (gr?.ok) {
          setMinutesGoal(Number(gr.minutesGoal) || 25)
          setTasksGoal(Number(gr.tasksGoal) || 10)
        }
        const prev = prevTodayRef.current
        if (prev) {
          if (prev.m < mg && tm >= mg) {
            pushToast('Günlük süre hedefin tamamlandı.', 'success')
          }
          if (prev.t < tg && tt >= tg) {
            pushToast('Günlük soru/görev hedefin tamamlandı.', 'success')
          }
        }
        prevTodayRef.current = { m: tm, t: tt }
      }
    } catch {
      // yoksay
    }
  }, [authHeaders, pushToast])

  useEffect(() => {
    void loadGoalsAndProgress()
  }, [loadGoalsAndProgress, authToken])

  useEffect(() => {
    const id = window.setInterval(() => void loadGoalsAndProgress(), 30_000)
    return () => window.clearInterval(id)
  }, [loadGoalsAndProgress])

  useEffect(() => {
    if (searchParams.get('goals') === '1' && authToken) {
      setGoalDraftMin(minutesGoal)
      setGoalDraftTasks(tasksGoal)
      setShowGoalModal(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, authToken, minutesGoal, tasksGoal, setSearchParams])

  const timePct = Math.min(100, minutesGoal > 0 ? (todayMinutes / minutesGoal) * 100 : 0)
  const taskPct = Math.min(100, tasksGoal > 0 ? (todayTasks / tasksGoal) * 100 : 0)
  const combinedPct = Math.round((timePct + taskPct) / 2)
  const remMin = Math.max(0, minutesGoal - todayMinutes)
  const remTasks = Math.max(0, tasksGoal - todayTasks)

  const handleSaveGoals = async () => {
    const token = getAuthToken()
    if (!token) {
      navigate('/auth?reason=goals')
      return
    }
    const body: Record<string, unknown> = {
      minutesGoal: goalDraftMin,
      tasksGoal: goalDraftTasks,
    }
    try {
      const r = await apiFetch('/api/goals', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json().catch(() => ({}))
      if (d?.ok) {
        setMinutesGoal(goalDraftMin)
        setTasksGoal(goalDraftTasks)
        setShowGoalModal(false)
        void loadGoalsAndProgress()
        pushToast('Günlük hedef kaydedildi.', 'success')
      } else {
        pushToast(d?.error ?? 'Hedef kaydedilemedi. Oturumunuzu kontrol edin.', 'error')
      }
    } catch {
      pushToast('Bağlantı hatası. İnternetinizi kontrol edip tekrar deneyin.', 'error')
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
    if (!authToken) {
      navigate('/auth?reason=goals')
      return
    }
    setGoalDraftMin(minutesGoal)
    setGoalDraftTasks(tasksGoal)
    setShowGoalModal(true)
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-lg flex-col gap-8">
        {bannerMessage && (
          <div className="rounded-lg border border-slate-300 bg-white/80 px-4 py-3 text-center text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
            {bannerMessage}
          </div>
        )}

        {authToken && (
          <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Bugünkü hedeflerin</h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
              Çalışma: {todayMinutes} / {minutesGoal} dk · Soru: {todayTasks} / {tasksGoal}
            </p>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-emerald-500 transition-all duration-500"
                style={{ width: `${combinedPct}%` }}
              />
            </div>
            <p className="mt-2 text-center text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
              %{combinedPct} tamamlandı
            </p>
            <p className="mt-1 text-center text-xs text-slate-600 dark:text-slate-400">
              Kalan süre: <strong className="text-slate-800 dark:text-slate-200">{remMin} dk</strong> · Kalan
              soru/görev:{' '}
              <strong className="text-slate-800 dark:text-slate-200">{remTasks}</strong>
            </p>
            <div className="mt-3 flex justify-center">
              <button
                type="button"
                onClick={openGoalModal}
                className="ss-btn-outline rounded-xl border border-amber-500/50 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
              >
                Günlük hedef belirle
              </button>
            </div>
          </section>
        )}

        <header className="text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">
            StudySprint
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">Yeni oda oluştur</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Oda adı, kapasite ve süreyi belirleyin; herkes hazır olunca kurucu başlatır.
          </p>
        </header>

        <section
          aria-labelledby="form-heading"
          className="rounded-2xl border border-slate-200/80 bg-white/90 p-6 shadow-xl backdrop-blur dark:border-slate-800/80 dark:bg-slate-900/50"
        >
          <h2 id="form-heading" className="sr-only">
            Oda ayarları
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Oda adı
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="Örn. Gece çalışması"
                autoComplete="off"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Oda kapasitesi (kurucu dahil kaç kişi)
              </span>
              <input
                type="number"
                min={1}
                max={100}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Görünen ad (kurucu)
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Adınız (örn. Mete)"
                autoComplete="nickname"
                disabled={isAnonymous}
              />
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked)
                  if (e.target.checked) setDisplayName('')
                }}
                className="size-4 rounded border-slate-400 dark:border-slate-600"
              />
              Anonim katıl (isim gizli, benzersiz takma ad atanır)
            </label>

            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={requiresApproval}
                onChange={(e) => setRequiresApproval(e.target.checked)}
                className="size-4 rounded border-slate-400 dark:border-slate-600"
              />
              Katılımcılar için kurucu onayı (bekleme odası)
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                  Çalışma süresi (dk)
                </span>
                <input
                  type="number"
                  min={5}
                  max={240}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                  Hedef soru / görev
                </span>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={targetTasks}
                  onChange={(e) => setTargetTasks(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-500">
                Oda şifresi (isteğe bağlı)
              </span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-brand-500/40 focus:ring-2 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Boş bırakılabilir"
                autoComplete="new-password"
              />
            </label>

            {error && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={busy}
              className="ss-btn-primary w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-900/40 hover:bg-brand-500 disabled:opacity-50"
            >
              {busy ? 'Oluşturuluyor…' : 'Oda oluştur'}
            </button>
          </div>
        </section>

        <p className="text-center text-sm text-slate-600 dark:text-slate-500">
          Davet aldınız mı?{' '}
          <Link to="/join" className="text-brand-600 hover:text-brand-500 dark:text-brand-400 dark:hover:text-brand-300">
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
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <h2 id="goal-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                Günlük hedef
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Bugün için toplam çalışma süresi ve çözülecek soru hedefini girin.
              </p>
              <label className="mt-4 block text-sm">
                <span className="text-slate-600 dark:text-slate-500">Dakika</span>
                <input
                  type="number"
                  min={5}
                  max={720}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={goalDraftMin}
                  onChange={(e) => setGoalDraftMin(Number(e.target.value))}
                />
              </label>
              <label className="mt-3 block text-sm">
                <span className="text-slate-600 dark:text-slate-500">Soru / görev</span>
                <input
                  type="number"
                  min={1}
                  max={500}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={goalDraftTasks}
                  onChange={(e) => setGoalDraftTasks(Number(e.target.value))}
                />
              </label>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="ss-btn-ghost rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 dark:border-slate-600 dark:text-slate-300"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveGoals()}
                  className="ss-btn-primary rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-900/25"
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
