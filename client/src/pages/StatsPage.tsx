import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiUrl } from '../lib/apiBase'
import { getAuthToken } from '../lib/authToken'
import { getOrCreateClientId } from '../lib/clientId'

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
}

export const StatsPage = () => {
  const clientId = useMemo(() => getOrCreateClientId(), [])
  const [data, setData] = useState<Analytics | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const token = getAuthToken()
    const url = token
      ? apiUrl('/api/analytics/full')
      : apiUrl(`/api/analytics/full?clientId=${encodeURIComponent(clientId)}`)
    const headers: Record<string, string> = {}
    if (token) headers.Authorization = `Bearer ${token}`
    else headers['X-Client-Id'] = clientId
    try {
      const r = await fetch(url, { headers })
      const j = (await r.json()) as Analytics
      if (!j.ok) {
        setErr('Veriler yüklenemedi.')
        return
      }
      setData(j)
      setErr(null)
    } catch {
      setErr('Bağlantı hatası.')
    }
  }, [clientId])

  useEffect(() => {
    void load()
  }, [load])

  const maxHeat = useMemo(() => {
    const hm = data?.heatmap ?? []
    return Math.max(1, ...hm.map((x) => x.minutes))
  }, [data?.heatmap])

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-brand-400">StudySprint</p>
            <h1 className="text-2xl font-semibold text-white">İstatistiklerim / Analizlerim</h1>
            <p className="mt-1 text-sm text-slate-500">
              {data?.identity === 'guest'
                ? 'Misafir modu — kayıt olunca veriler tüm cihazlarda senkronize olur.'
                : 'Hesabın bağlı — veriler sunucuda saklanıyor.'}
            </p>
          </div>
          <Link
            to="/"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
          >
            Ana sayfa
          </Link>
        </div>

        {err && (
          <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
            {err}
          </p>
        )}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="XP" value={String(data.xp ?? 0)} />
              <StatCard label="Seri (gün)" value={String(data.streakDays ?? 0)} />
              <StatCard
                label="Toplam çalışma"
                value={`${data.totalMinutesStudied ?? 0} dk`}
              />
              <StatCard label="Çözülen soru / görev" value={String(data.totalTasksSolved ?? 0)} />
              <StatCard label="Oluşturulan oda" value={String(data.roomsCreated ?? 0)} />
              <StatCard label="Katılınan oda" value={String(data.roomsJoined ?? 0)} />
              <StatCard
                label="En verimli saat (yerel)"
                value={data.productiveHourLabel ?? '—'}
              />
              <StatCard
                label="Oturum başına ort. süre"
                value={`${data.avgMinutesPerSession ?? 0} dk`}
              />
              <StatCard
                label="Dikkat işareti (tıklama)"
                value={String(data.distractionScore ?? 0)}
              />
              <StatCard
                label="Sekme dışı süre (toplam)"
                value={`${Math.round((data.awaySecondsTotal ?? 0) / 60)} dk`}
              />
              <StatCard
                label="İnaktivite skoru (tahmini)"
                value={`%${data.inactivityScorePercent ?? 0}`}
              />
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white">Günlük görevler &amp; rozetler</h2>
              <ul className="mt-4 space-y-2">
                {(data.tasks ?? []).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-2 text-sm"
                  >
                    <span className={t.done ? 'text-emerald-300' : 'text-slate-300'}>
                      {t.done ? '✓ ' : '○ '}
                      {t.label}
                    </span>
                    <span className="text-xs text-brand-300">+{t.xp} XP</span>
                  </li>
                ))}
              </ul>
              {data.badges && data.badges.length > 0 && (
                <p className="mt-4 text-sm text-slate-400">
                  Rozetler:{' '}
                  <span className="text-brand-300">{data.badges.join(', ')}</span>
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
              <h2 className="text-lg font-semibold text-white">Çalışma takvimi (son 365 gün)</h2>
              <p className="mt-1 text-xs text-slate-500">
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
                      className="size-2.5 rounded-sm bg-slate-800 sm:size-3"
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

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
    <p className="text-xs text-slate-500">{label}</p>
    <p className="mt-1 text-lg font-semibold text-white">{value}</p>
  </div>
)
