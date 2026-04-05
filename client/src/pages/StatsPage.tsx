import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../context/ToastContext'
import { apiUrl } from '../lib/apiBase'
import { getAuthToken } from '../lib/authToken'

type Analytics = {
  ok: boolean
  identity?: 'user' | 'guest'
  xp?: number
  streakDays?: number
  badges?: string[]
  tasks?: { id: string; label: string; xp: number; done: boolean }[]
  totalMinutesStudied?: number
  totalTasksSolved?: number
  roomsCreated?: number
  roomsJoined?: number
  productiveHourLabel?: string
  avgMinutesPerSession?: number
  distractionScore?: number
  awaySecondsTotal?: number
  inactivityScorePercent?: number
  heatmap?: { date: string; minutes: number }[]
  todayMinutes?: number
  todayTasks?: number
}

export const StatsPage = () => {
  const { pushToast } = useToast()
  const [data, setData] = useState<Analytics | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const prevXpRef = useRef<number | null>(null)

  const load = useCallback(async () => {
    const token = getAuthToken()
    const url = apiUrl('/api/analytics/full')
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    try {
      const r = await fetch(url, { headers })
      const j = (await r.json()) as Analytics
      if (!r.ok || !j.ok) {
        setErr('Veriler yüklenemedi. Oturumunuzu kontrol edin.')
        return
      }
      const prev = prevXpRef.current
      const nextXp = j.xp ?? 0
      if (prev !== null && nextXp > prev) {
        pushToast(`+${nextXp - prev} XP kazandın!`, 'success')
      }
      prevXpRef.current = nextXp
      setData(j)
      setErr(null)
    } catch {
      setErr('Bağlantı hatası. HTTPS API adresini ve ağınızı kontrol edin.')
    }
  }, [pushToast])

  useEffect(() => {
    void load()
  }, [load])

  const maxHeat = useMemo(() => {
    const hm = data?.heatmap ?? []
    return Math.max(1, ...hm.map((x) => x.minutes))
  }, [data?.heatmap])

  const roomsTotal = (data?.roomsCreated ?? 0) + (data?.roomsJoined ?? 0)

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-4 py-10 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-600 dark:text-brand-400">StudySprint</p>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">İstatistiklerim</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-500">
              Günlük çalışma, odalar ve odak metrikleri — yalnızca hesabınıza bağlı veriler.
            </p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Ana sayfa
          </Link>
        </div>

        {err && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            {err}
          </p>
        )}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Bugünkü çalışma süresi" value={`${data.todayMinutes ?? 0} dk`} />
              <StatCard label="Katıldığın / oluşturduğun oda (toplam)" value={String(roomsTotal)} />
              <StatCard label="Çözülen toplam soru / görev" value={String(data.totalTasksSolved ?? 0)} />
              <StatCard label="En verimli saat (yerel)" value={data.productiveHourLabel ?? '—'} />
              <StatCard
                label="Odalarda ortalama süre"
                value={`${data.avgMinutesPerSession ?? 0} dk / oturum`}
              />
              <StatCard label="Dikkat dağılımı (odadaki kayıt)" value={String(data.distractionScore ?? 0)} />
              <StatCard
                label="XP"
                value={String(data.xp ?? 0)}
                valueClassName="ss-xp-pop"
                valueKey={data.xp ?? 0}
              />
              <StatCard label="Seri (gün)" value={String(data.streakDays ?? 0)} />
              <StatCard label="Toplam çalışma (tüm zamanlar)" value={`${data.totalMinutesStudied ?? 0} dk`} />
              <StatCard label="Oluşturulan oda" value={String(data.roomsCreated ?? 0)} />
              <StatCard label="Katılınan oda" value={String(data.roomsJoined ?? 0)} />
              <StatCard
                label="Sekme dışı süre (toplam)"
                value={`${Math.round((data.awaySecondsTotal ?? 0) / 60)} dk`}
              />
              <StatCard
                label="İnaktivite tahmini"
                value={`%${data.inactivityScorePercent ?? 0}`}
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Günlük görevler &amp; rozetler</h2>
              <ul className="mt-4 space-y-2">
                {(data.tasks ?? []).map((t) => (
                  <li
                    key={t.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      t.done
                        ? 'border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-950/30'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <span className={t.done ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}>
                      {t.done ? '✓ ' : '○ '}
                      {t.label}
                    </span>
                    <span className="text-xs text-brand-600 dark:text-brand-300">+{t.xp} XP</span>
                  </li>
                ))}
              </ul>
              {data.badges && data.badges.length > 0 && (
                <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
                  Rozetler:{' '}
                  <span className="text-brand-600 dark:text-brand-300">{data.badges.join(', ')}</span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white/90 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Çalışma takvimi (son 365 gün)</h2>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
                Koyu renk = daha çok dakika (oda oturumları toplamı).
              </p>
              <div className="mt-4 max-w-full overflow-x-auto pb-2">
                <div className="flex min-w-max flex-wrap gap-1">
                {(data.heatmap ?? []).map((cell) => {
                  const intensity = cell.minutes <= 0 ? 0 : 0.2 + (cell.minutes / maxHeat) * 0.8
                  return (
                    <div
                      key={cell.date}
                      title={`${cell.date}: ${cell.minutes} dk`}
                      className="size-2.5 rounded-sm bg-slate-200 sm:size-3 dark:bg-slate-800"
                      style={{
                        backgroundColor:
                          cell.minutes <= 0
                            ? undefined
                            : `rgba(34, 197, 94, ${intensity.toFixed(2)})`,
                      }}
                    />
                  )
                })}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

const StatCard = ({
  label,
  value,
  valueClassName,
  valueKey,
}: {
  label: string
  value: string
  valueClassName?: string
  valueKey?: string | number
}) => (
  <div className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40">
    <p className="text-xs text-slate-600 dark:text-slate-500">{label}</p>
    <p
      key={valueKey}
      className={`mt-1 text-lg font-semibold text-slate-900 dark:text-white ${valueClassName ?? ''}`}
    >
      {value}
    </p>
  </div>
)
