import type { PublicParticipant } from '@studysprint/shared'
import { getPrisma } from './db.js'

export type SessionPayload = {
  roomSlug: string
  durationMinutes: number
  targetTasks: number
  ownerId: string
  participants: Array<PublicParticipant & { awaySeconds: number; localHour: number }>
  highlights: {
    participantId: string
    label: string
    completedTasks: number
    targetPercent: number
  }[]
}

const xpForSession = (targetPercent: number) =>
  10 + Math.min(40, Math.floor(targetPercent / 3))

export const persistSessionAndProfiles = async (payload: SessionPayload) => {
  try {
    const prisma = getPrisma()
    await prisma.sessionLog.create({
      data: {
        roomSlug: payload.roomSlug,
        durationMinutes: payload.durationMinutes,
        targetTasks: payload.targetTasks,
        payload: payload as object,
      },
    })
  } catch {
    // Veritabanı yoksa veya bağlantı hatası
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endedAt = new Date()

  const sortedHighlights = [...payload.highlights].sort(
    (a, b) => b.completedTasks - a.completedTasks,
  )
  const topId = sortedHighlights[0]?.participantId

  try {
    const prisma = getPrisma()

    for (const p of payload.participants) {
      if (p.isAnonymous) continue

      const highlight = payload.highlights.find((h) => h.participantId === p.id)
      if (!highlight) continue

      const awaySeconds = Math.max(0, Math.round(Number(p.awaySeconds) || 0))
      const localHour = Math.min(23, Math.max(0, Math.round(Number(p.localHour) || 0)))

      try {
        await prisma.sessionParticipantLog.create({
          data: {
            clientId: p.id,
            roomSlug: payload.roomSlug,
            endedAt,
            durationMinutes: payload.durationMinutes,
            completedTasks: highlight.completedTasks,
            targetTasks: payload.targetTasks,
            targetPercent: highlight.targetPercent,
            distractionCount: p.distractionCount,
            awaySeconds,
            isOwner: p.id === payload.ownerId,
            localHour,
          },
        })
      } catch {
        // yoksay
      }

      const xpGain = xpForSession(highlight.targetPercent)

      const binding = await prisma.clientBinding.findUnique({
        where: { clientId: p.id },
      })

      if (binding) {
        const userRow = await prisma.user.findUnique({ where: { id: binding.userId } })
        if (!userRow) continue

        let streakDays = 1
        let lastStreakDate = today

        if (userRow.lastStreakDate) {
          const last = new Date(userRow.lastStreakDate)
          last.setHours(0, 0, 0, 0)
          const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000)
          if (diffDays === 0) {
            streakDays = userRow.streakDays
            lastStreakDate = last
          } else if (diffDays === 1) {
            streakDays = userRow.streakDays + 1
          } else {
            streakDays = 1
          }
        }

        const badges: string[] = userRow.badges ? [...userRow.badges] : []
        if (highlight.targetPercent >= 100 && !badges.includes('goal_hunter')) {
          badges.push('goal_hunter')
        }
        if (topId === p.id && !badges.includes('most_productive')) {
          badges.push('most_productive')
        }
        if (streakDays >= 7 && !badges.includes('week_warrior')) {
          badges.push('week_warrior')
        }
        if (userRow.xp + xpGain >= 500 && !badges.includes('xp_500')) {
          badges.push('xp_500')
        }

        await prisma.user.update({
          where: { id: binding.userId },
          data: {
            xp: userRow.xp + xpGain,
            streakDays,
            lastStreakDate,
            badges,
          },
        })
        continue
      }

      const existing = await prisma.userProfile.findUnique({
        where: { clientId: p.id },
      })

      let streakDays = 1
      let lastStreakDate = today

      if (existing?.lastStreakDate) {
        const last = new Date(existing.lastStreakDate)
        last.setHours(0, 0, 0, 0)
        const diffDays = Math.round((today.getTime() - last.getTime()) / 86400000)
        if (diffDays === 0) {
          streakDays = existing.streakDays
          lastStreakDate = last
        } else if (diffDays === 1) {
          streakDays = existing.streakDays + 1
        } else {
          streakDays = 1
        }
      }

      const badges: string[] = existing?.badges ? [...existing.badges] : []

      if (highlight.targetPercent >= 100 && !badges.includes('goal_hunter')) {
        badges.push('goal_hunter')
      }
      if (topId === p.id && !badges.includes('most_productive')) {
        badges.push('most_productive')
      }
      if (streakDays >= 7 && !badges.includes('week_warrior')) {
        badges.push('week_warrior')
      }

      const guestXp = (existing?.xp ?? 0) + xpGain
      if (guestXp >= 500 && !badges.includes('xp_500')) {
        badges.push('xp_500')
      }

      await prisma.userProfile.upsert({
        where: { clientId: p.id },
        create: {
          clientId: p.id,
          streakDays,
          lastStreakDate,
          badges,
          xp: guestXp,
        },
        update: {
          streakDays,
          lastStreakDate,
          badges,
          xp: guestXp,
        },
      })
    }
  } catch {
    // yoksay
  }
}
