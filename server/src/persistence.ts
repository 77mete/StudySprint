import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

import type { PublicParticipant } from '@studysprint/shared'
import { getPrisma } from './db.js'

export type SessionPayload = {
  roomSlug: string
  durationMinutes: number
  targetTasks: number
  participants: PublicParticipant[]
  highlights: {
    participantId: string
    label: string
    completedTasks: number
    targetPercent: number
  }[]
}

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

  const sortedHighlights = [...payload.highlights].sort(
    (a, b) => b.completedTasks - a.completedTasks,
  )
  const topId = sortedHighlights[0]?.participantId

  for (const p of payload.participants) {
    if (p.isAnonymous) continue
    const highlight = payload.highlights.find((h) => h.participantId === p.id)
    if (!highlight) continue

    try {
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

      await prisma.userProfile.upsert({
        where: { clientId: p.id },
        create: {
          clientId: p.id,
          streakDays,
          lastStreakDate,
          badges,
        },
        update: {
          streakDays,
          lastStreakDate,
          badges,
        },
      })
    } catch {
      // yoksay
    }
  }
}
