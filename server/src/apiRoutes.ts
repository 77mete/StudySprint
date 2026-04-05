import type { Express } from 'express'
import { getPrisma } from './db.js'
import {
  generateTempPassword,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './auth/password.js'
import { sendTemporaryPasswordEmail, isSmtpConfigured } from './mail.js'
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
      const pwErr = validatePasswordStrength(password)
      if (pwErr) {
        res.status(400).json({ ok: false, error: pwErr })
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
        user: {
          id: user.id,
          email: user.email,
          xp: user.xp,
          streakDays: user.streakDays,
          mustChangePassword: user.mustChangePassword,
        },
      })
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'Kayıt başarısız.' })
    }
  })

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const email = String(req.body?.email ?? '')
        .trim()
        .toLowerCase()
      if (!email || !email.includes('@')) {
        res.status(400).json({ ok: false, error: 'Geçerli bir e-posta girin.' })
        return
      }
      const prisma = getPrisma()
      const user = await prisma.user.findUnique({ where: { email } })
      const genericOk = {
        ok: true as const,
        message:
          'Bu adrese kayıtlı bir hesap varsa, geçici şifre e-posta ile gönderildi.',
      }
      if (!user) {
        res.json(genericOk)
        return
      }

      const temp = generateTempPassword()
      const passwordHash = await hashPassword(temp)
      const prevHash = user.passwordHash

      if (!isSmtpConfigured()) {
        if (process.env.NODE_ENV === 'development') {
          await prisma.user.update({
            where: { id: user.id },
            data: { passwordHash, mustChangePassword: true },
          })
          res.json({
            ok: true,
            message:
              'Geliştirme ortamı: SMTP yok; geçici şifre yanıtta. Üretimde SMTP_HOST, SMTP_USER, SMTP_PASS ayarlayın.',
            devTempPassword: temp,
          })
          return
        }
        res.status(503).json({
          ok: false,
          error:
            'E-posta sunucusu yapılandırılmamış. Şifre sıfırlama için yönetici ile iletişime geçin.',
        })
        return
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: true },
      })

      const mailResult = await sendTemporaryPasswordEmail(email, temp)
      if (!mailResult.sent) {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: prevHash, mustChangePassword: false },
        })
        res.status(503).json({
          ok: false,
          error: mailResult.error ?? 'E-posta gönderilemedi. Bir süre sonra tekrar deneyin.',
        })
        return
      }

      res.json(genericOk)
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'İşlem tamamlanamadı.' })
    }
  })

  app.post('/api/auth/change-password', async (req, res) => {
    try {
      const token = parseBearer(req)
      if (!token) {
        res.status(401).json({ ok: false, error: 'Oturum gerekli.' })
        return
      }
      const payload = await verifyUserToken(token)
      if (!payload) {
        res.status(401).json({ ok: false, error: 'Geçersiz oturum.' })
        return
      }
      const currentPassword = String(req.body?.currentPassword ?? '')
      const newPassword = String(req.body?.newPassword ?? '')
      const pwErr = validatePasswordStrength(newPassword)
      if (pwErr) {
        res.status(400).json({ ok: false, error: pwErr })
        return
      }
      const prisma = getPrisma()
      const user = await prisma.user.findUnique({ where: { id: payload.sub } })
      if (!user) {
        res.status(404).json({ ok: false, error: 'Kullanıcı bulunamadı.' })
        return
      }
      const ok = await verifyPassword(currentPassword, user.passwordHash)
      if (!ok) {
        res.status(401).json({ ok: false, error: 'Mevcut şifre hatalı.' })
        return
      }
      const newHash = await hashPassword(newPassword)
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash, mustChangePassword: false },
      })
      res.json({ ok: true, message: 'Şifre güncellendi.' })
    } catch (e) {
      console.error(e)
      res.status(500).json({ ok: false, error: 'Şifre değiştirilemedi.' })
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
          mustChangePassword: user.mustChangePassword,
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
          mustChangePassword: user.mustChangePassword,
        },
      })
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.put('/api/goals', async (req, res) => {
    const minutesGoal = Math.min(720, Math.max(5, Math.round(Number(req.body?.minutesGoal) || 25)))
    const tasksGoal = Math.min(500, Math.max(1, Math.round(Number(req.body?.tasksGoal) || 10)))
    const token = parseBearer(req)
    const today = dayKey()

    try {
      const prisma = getPrisma()
      if (!token) {
        res.status(401).json({ ok: false, error: 'Giriş gerekli.' })
        return
      }
      const payload = await verifyUserToken(token)
      if (!payload) {
        res.status(401).json({ ok: false, error: 'Geçersiz oturum.' })
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
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.get('/api/goals', async (req, res) => {
    const token = parseBearer(req)
    try {
      const prisma = getPrisma()
      if (!token) {
        res.status(401).json({ ok: false, error: 'Giriş gerekli.' })
        return
      }
      const payload = await verifyUserToken(token)
      if (!payload) {
        res.status(401).json({ ok: false, error: 'Geçersiz oturum.' })
        return
      }
      const u = await prisma.user.findUnique({ where: { id: payload.sub } })
      res.json({
        ok: true,
        minutesGoal: u?.dailyMinutesGoal ?? 25,
        tasksGoal: u?.dailyTasksGoal ?? 10,
        goalDay: u?.goalDay ?? null,
      })
    } catch {
      res.status(500).json({ ok: false })
    }
  })

  app.get('/api/analytics/full', async (req, res) => {
    const token = parseBearer(req)

    try {
      const prisma = getPrisma()
      if (!token) {
        res.status(401).json({ ok: false, error: 'Giriş gerekli.' })
        return
      }
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
