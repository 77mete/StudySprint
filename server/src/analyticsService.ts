import { getPrisma } from './db.js'

const dayKey = (d: Date) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.toISOString().slice(0, 10)
}

export const getBoundClientIds = async (userId: string): Promise<string[]> => {
  const prisma = getPrisma()
  const rows = await prisma.clientBinding.findMany({
    where: { userId },
    select: { clientId: true },
  })
  return rows.map((r) => r.clientId)
}

export const buildAnalyticsForClientIds = async (clientIds: string[]) => {
  const prisma = getPrisma()
  if (clientIds.length === 0) {
    return emptyAnalytics()
  }

  const logs = await prisma.sessionParticipantLog.findMany({
    where: { clientId: { in: clientIds } },
    orderBy: { endedAt: 'desc' },
    take: 5000,
  })

  const totalMinutes = logs.reduce((a, l) => a + l.durationMinutes, 0)
  const totalTasks = logs.reduce((a, l) => a + l.completedTasks, 0)
  const roomsCreated = new Set(logs.filter((l) => l.isOwner).map((l) => l.roomSlug)).size
  const roomsJoined = new Set(logs.filter((l) => !l.isOwner).map((l) => l.roomSlug)).size

  const hourBuckets = new Array(24).fill(0)
  for (const l of logs) {
    const h = Math.min(23, Math.max(0, l.localHour))
    hourBuckets[h] += l.durationMinutes
  }
  let bestHour = 0
  let bestVal = -1
  for (let h = 0; h < 24; h++) {
    if (hourBuckets[h] > bestVal) {
      bestVal = hourBuckets[h]
      bestHour = h
    }
  }
  const productiveHourLabel =
    bestVal <= 0
      ? '—'
      : `${String(bestHour).padStart(2, '0')}:00 – ${String(bestHour).padStart(2, '0')}:59`

  const avgRoomMinutes =
    logs.length === 0 ? 0 : Math.round((totalMinutes / logs.length) * 10) / 10

  const totalAway = logs.reduce((a, l) => a + l.awaySeconds, 0)
  const totalDistraction = logs.reduce((a, l) => a + l.distractionCount, 0)
  const sessionCount = logs.length
  const awayRatio =
    sessionCount === 0 ? 0 : Math.min(100, Math.round((totalAway / (sessionCount * 60 * 25)) * 100))

  const heatmapMap = new Map<string, number>()
  for (const l of logs) {
    const k = dayKey(l.endedAt)
    heatmapMap.set(k, (heatmapMap.get(k) ?? 0) + l.durationMinutes)
  }
  const heatmap: { date: string; minutes: number }[] = []
  const now = new Date()
  for (let i = 364; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const k = dayKey(d)
    heatmap.push({ date: k, minutes: heatmapMap.get(k) ?? 0 })
  }

  const today = dayKey(new Date())
  const todayLogs = logs.filter((l) => dayKey(l.endedAt) === today)
  const todayMinutes = todayLogs.reduce((a, l) => a + l.durationMinutes, 0)
  const todayTasks = todayLogs.reduce((a, l) => a + l.completedTasks, 0)

  return {
    totalMinutesStudied: totalMinutes,
    totalTasksSolved: totalTasks,
    roomsCreated,
    roomsJoined,
    productiveHourLabel,
    avgMinutesPerSession: avgRoomMinutes,
    distractionScore: totalDistraction,
    awaySecondsTotal: totalAway,
    inactivityScorePercent: awayRatio,
    heatmap,
    todayMinutes,
    todayTasks,
  }
}

const emptyAnalytics = () => ({
  totalMinutesStudied: 0,
  totalTasksSolved: 0,
  roomsCreated: 0,
  roomsJoined: 0,
  productiveHourLabel: '—',
  avgMinutesPerSession: 0,
  distractionScore: 0,
  awaySecondsTotal: 0,
  inactivityScorePercent: 0,
  heatmap: [] as { date: string; minutes: number }[],
  todayMinutes: 0,
  todayTasks: 0,
})

export const buildDailyTasks = (
  todayMinutes: number,
  todayTasks: number,
  streakDays: number,
) => {
  const tasks = [
    {
      id: 'study_25',
      label: 'Bugün toplam 25 dk odada çalış',
      xp: 15,
      done: todayMinutes >= 25,
    },
    {
      id: 'tasks_5',
      label: 'Bugün en az 5 görev/soru tamamla',
      xp: 20,
      done: todayTasks >= 5,
    },
    {
      id: 'streak_3',
      label: '3 gün üst üste çalış (seri)',
      xp: 25,
      done: streakDays >= 3,
    },
  ]
  return tasks
}
