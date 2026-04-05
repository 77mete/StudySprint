import type { Express } from 'express'
import { getPrisma } from './db.js'
import { hashPassword, verifyPassword } from './auth/password.js'
import { signUserToken, verifyUserToken } from './auth/jwt.js'
import {
  buildAnalyticsForClientIds,
  buildDailyTasks,
  getBoundClientIds,
} from './analyticsService.js'

const dayKey = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

const parseClientId = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const h = req.headers['x-client-id']
  if (typeof h === 'string' && h.trim()) return h.trim()
  return ''
}

const parseBearer = (req: { headers: Record<string, string | string[] | undefined> }) => {
  const h = req.headers.authorization
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return null
  return h.slice(7).trim()
}

export const registerApiRoutes = (app: Express) => {
  app.post('/api/auth/register', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '')
        .trim()
        .toLowerCase()
      const password = String(req.body?.password ?? '')
      const clientId = String(req.body?.clientId ?? '').trim()
      if (!email || !email.includes('@')) {
        res.status(400).json({ ok: false, error: 'Geçerli e-posta gerekli.' })
        return
      }
      if (password.length < 6) {
        res.status(400).json({ ok: false, error: 'Şifre en az 6 karakter olmalı.' })
        return
      }
      if (!clientId) {
        res.status(400).json({ ok: false, error: 'clientId gerekli.' })
        return
      }
      const prisma = getPrisma()
      const exists = await prisma.user.findUnique({ where: { email } })
      if (exists) {
        res.status(409).json({ ok: false, error: 'Bu e-posta zaten kayıtlı.' })
        return
      }
      const taken = await prisma.clientBinding.findUnique({ where: { clientId } })
      if (taken) {
        res.status(409).json({ ok: false, error: 'Bu cihaz zaten bir hesaba bağlı.' })
        return
      }

      const passwordHash = await hashPassword(password)
      const guest = await prisma.userProfile.findUnique({ where: { clientId } })

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          streakDays: guest?.streakDays ?? 0,
          lastStreakDate: guest?.lastStreakDate ?? null,
          badges: guest?.badges?.length ? [...guest.badges] : [],
          xp: guest?.xp ?? 0,
          dailyMinutesGoal: guest?.dailyMinutesGoal ?? null,
          dailyTasksGoal: guest?.dailyTasksGoal ?? null,
          goalDay: guest?.goalDay ?? null,
        },
      })

      await prisma.clientBinding.create({
        data: { clientId, userId: user.id },
      })

      const token = await signUserToken(user.id, user.email)
      res.json({
        ok: true,
        token,
        user: { id: user.id, email: user.email, xp: user.xp, streakDays: user.streakDays },
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'Kayıt başarısız.' })
    }
  })

  app.post('/api/auth/login', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '')
        .trim()
        .toLowerCase()
      const password = String(req.body?.password ?? '')
      const clientId = String(req.body?.clientId ?? '').trim()
      if (!email || !password) {
        res.status(400).json({ ok: false, error: 'E-posta ve şifre gerekli.' })
        return
      }
      const prisma = getPrisma()
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        res.status(401).json({ ok: false, error: 'E-posta veya şifre hatalı.' })
        return
      }
      const ok = await verifyPassword(password, user.passwordHash)
      if (!ok) {
        res.status(401).json({ ok: false, error: 'E-posta veya şifre hatalı.' })
        return
      }

      if (clientId) {
        const existing = await prisma.clientBinding.findUnique({ where: { clientId } })
        if (!existing) {
          await prisma.clientBinding.create({
            data: { clientId, userId: user.id },
          })
        } else if (existing.userId !== user.id) {
          res.status(409).json({ ok: false, error: 'Bu cihaz başka bir hesaba bağlı.' })
          return
        }
      }

      const token = await signUserToken(user.id, user.email)
      res.json({
        ok: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          xp: user.xp,
          streakDays: user.streakDays,
          badges: user.badges,
        },
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'Giriş başarısız.' })
    }
  })

  app.get('/api/auth/me', async (req, res) => {
    const token = parseBearer(req)
    if (!token) {
      res.status(401).json({ ok: false, error: 'Yetkisiz' })
      return
    }
    const payload = await verifyUserToken(token)
    if (!payload) {
      res.status(401).json({ ok: false, error: 'Geçersiz token' })
      return
    }
    try {
      const prisma = getPrisma()
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      })
      if (!user) {
        res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı' })
        return
      }
      res.json({
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          xp: user.xp,
          streakDays: user.streakDays,
          badges: user.badges,
          dailyMinutesGoal: user.dailyMinutesGoal,
          dailyTasksGoal: user.dailyTasksGoal,
          goalDay: user.goalDay,
        },
      })
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.put('/api/goals', async (req, res) => {
    const minutesGoal = Math.min(720, Math.max(5, Math.round(Number(req.body?.minutesGoal) || 25)))
    const tasksGoal = Math.min(500, Math.max(1, Math.round(Number(req.body?.tasksGoal) || 10)))
    const clientId = String(req.body?.clientId ?? '').trim()
    const token = parseBearer(req)
    const today = dayKey()

    try {
      const prisma = getPrisma()
      if (token) {
        const payload = await verifyUserToken(token)
        if (!payload) {
          res.status(401).json({ ok: false })
          return
        }
        await prisma.user.update({
          where: { id: payload.sub },
          data: {
            dailyMinutesGoal: minutesGoal,
            dailyTasksGoal: tasksGoal,
            goalDay: today,
          },
        })
        res.json({ ok: true, minutesGoal, tasksGoal, goalDay: today })
        return
      }
      if (!clientId) {
        res.status(400).json({ ok: false, error: 'clientId veya giriş gerekli' })
        return
      }
      await prisma.userProfile.upsert({
        where: { clientId },
        create: {
          clientId,
          dailyMinutesGoal: minutesGoal,
          dailyTasksGoal: tasksGoal,
          goalDay: today,
        },
        update: {
          dailyMinutesGoal: minutesGoal,
          dailyTasksGoal: tasksGoal,
          goalDay: today,
        },
      })
      res.json({ ok: true, minutesGoal, tasksGoal, goalDay: today })
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.get('/api/goals', async (req, res) => {
    const clientId = String(req.query.clientId ?? '').trim()
    const token = parseBearer(req)
    try {
      const prisma = getPrisma()
      if (token) {
        const payload = await verifyUserToken(token)
        if (!payload) {
          res.status(401).json({ ok: false })
          return
        }
        const u = await prisma.user.findUnique({ where: { id: payload.sub } })
        res.json({
          ok: true,
          minutesGoal: u?.dailyMinutesGoal ?? 25,
          tasksGoal: u?.dailyTasksGoal ?? 10,
          goalDay: u?.goalDay ?? null,
        })
        return
      }
      if (!clientId) {
        res.json({ ok: true, minutesGoal: 25, tasksGoal: 10, goalDay: null })
        return
      }
      const p = await prisma.userProfile.findUnique({ where: { clientId } })
      res.json({
        ok: true,
        minutesGoal: p?.dailyMinutesGoal ?? 25,
        tasksGoal: p?.dailyTasksGoal ?? 10,
        goalDay: p?.goalDay ?? null,
      })
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.get('/api/analytics/full', async (req, res) => {
    const token = parseBearer(req)
    const clientId = String(req.query.clientId ?? '').trim() || parseClientId(req)

    try {
      const prisma = getPrisma()
      if (token) {
        const payload = await verifyUserToken(token)
        if (!payload) {
          res.status(401).json({ ok: false, error: 'Geçersiz token' })
          return
        }
        const ids = await getBoundClientIds(payload.sub)
        const user = await prisma.user.findUnique({ where: { id: payload.sub } })
        const analytics = await buildAnalyticsForClientIds(ids)
        const tasks = buildDailyTasks(
          analytics.todayMinutes,
          analytics.todayTasks,
          user?.streakDays ?? 0,
        )
        res.json({
          ok: true,
          identity: 'user' as const,
          xp: user?.xp ?? 0,
          streakDays: user?.streakDays ?? 0,
          badges: user?.badges ?? [],
          tasks,
          ...analytics,
        })
        return
      }

      if (!clientId) {
        res.status(400).json({ ok: false, error: 'clientId gerekli (misafir)' })
        return
      }

      const analytics = await buildAnalyticsForClientIds([clientId])
      const prof = await prisma.userProfile.findUnique({ where: { clientId } })
      const tasks = buildDailyTasks(
        analytics.todayMinutes,
        analytics.todayTasks,
        prof?.streakDays ?? 0,
      )
      res.json({
        ok: true,
        identity: 'guest' as const,
        xp: prof?.xp ?? 0,
        streakDays: prof?.streakDays ?? 0,
        badges: prof?.badges ?? [],
        tasks,
        ...analytics,
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'Analiz yüklenemedi' })
    }
  })

  app.get('/api/profile/:clientId', async (req, res) => {
    try {
      const prisma = getPrisma()
      const binding = await prisma.clientBinding.findUnique({
        where: { clientId: req.params.clientId },
      })
      if (binding) {
        const u = await prisma.user.findUnique({ where: { id: binding.userId } })
        if (u) {
          res.json({
            ok: true,
            streakDays: u.streakDays,
            badges: u.badges ?? [],
            xp: u.xp,
          })
          return
        }
      }
      const row = await prisma.userProfile.findUnique({
        where: { clientId: req.params.clientId },
      })
      if (!row) {
        res.json({ ok: true, streakDays: 0, badges: [] as string[], xp: 0 })
        return
      }
      res.json({
        ok: true,
        streakDays: row.streakDays,
        badges: row.badges ?? [],
        xp: row.xp,
      })
    } catch {
      res.json({ ok: false, streakDays: 0, badges: [] as string[], xp: 0 })
    }
  })
}
