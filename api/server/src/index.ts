import './env.js'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { createServer } from 'node:http'
import { Server } from 'socket.io'
import { checkDatabase, getPrisma } from './db.js'
import { RoomStore } from './roomStore.js'

const PORT = Number(process.env.PORT) || 3001
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173'

const app = express()
const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
})

app.use(express.json({ limit: '32kb' }))
app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
)

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api', apiLimiter)

const startedAt = Date.now()

app.get('/api/health', async (_req, res) => {
  const db = await checkDatabase()
  res.json({
    ok: true,
    db,
    uptimeMs: Date.now() - startedAt,
    serverTime: new Date().toISOString(),
  })
})

app.get('/api/profile/:clientId', async (req, res) => {
  try {
    const prisma = getPrisma()
    const row = await prisma.userProfile.findUnique({
      where: { clientId: req.params.clientId },
    })
    if (!row) {
      res.json({ ok: true, streakDays: 0, badges: [] as string[] })
      return
    }
    const badges = row.badges ?? []
    res.json({ ok: true, streakDays: row.streakDays, badges })
  } catch {
    res.json({ ok: false, streakDays: 0, badges: [] as string[] })
  }
})

const store = new RoomStore()

app.get('/api/rooms/:slug', (req, res) => {
  const slug = req.params.slug.trim().toLowerCase()
  const info = store.peekRoom(slug)
  if (!info) {
    res.status(404).json({ ok: false, error: 'Oda bulunamadı.' })
    return
  }
  res.json({
    ok: true,
    roomName: info.roomName,
    hasPassword: info.hasPassword,
    maxParticipants: info.maxParticipants,
    participantCount: info.participantCount,
  })
})

io.on('connection', (socket) => {
  socket.emit('welcome', {
    message: 'StudySprint sunucusuna bağlandınız — gerçek zamanlı sprint için hazır.',
  })

  socket.on('room:create', (payload, ack) => {
    const result = store.createRoom(io, socket, payload)
    if (typeof ack === 'function') ack(result)
  })

  socket.on('room:join', (payload, ack) => {
    const result = store.joinRoom(io, socket, payload)
    if (typeof ack === 'function') ack(result)
  })

  socket.on('room:leave', () => {
    store.leaveRoom(io, socket)
  })

  socket.on(
    'room:ready',
    (payload: { slug: string; clientId: string; ready: boolean }) => {
      store.setReady(io, payload.slug, payload.clientId, payload.ready)
    },
  )

  socket.on('room:resync', (payload: { slug: string; clientId: string }) => {
    store.resync(io, socket, payload.slug, payload.clientId)
  })

  socket.on('owner:start', (payload: { slug: string; ownerClientId: string }) => {
    store.ownerStart(io, payload.slug, payload.ownerClientId)
  })

  socket.on('owner:forceEnd', (payload: { slug: string; ownerClientId: string }) => {
    store.ownerForceEnd(io, payload.slug, payload.ownerClientId)
  })

  socket.on('owner:extend', (payload) => {
    store.ownerExtend(io, payload)
  })

  socket.on('owner:kick', (payload) => {
    store.ownerKick(io, payload)
  })

  socket.on(
    'debrief:submit',
    (payload: { slug: string; clientId: string; completedTasks: number }) => {
      store.submitDebrief(io, payload.slug, payload.clientId, payload.completedTasks)
    },
  )

  socket.on('session:distraction', (payload: { slug: string; clientId: string }) => {
    store.distraction(io, payload.slug, payload.clientId)
  })

  socket.on('disconnect', () => {
    store.onDisconnect(io, socket)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT} · CORS: ${CLIENT_ORIGIN}`)
})
