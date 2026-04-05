import './env.js'
import type { IncomingMessage } from 'node:http'
import express from 'express'
import { existsSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'path'
import rateLimit from 'express-rate-limit'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { Server } from 'socket.io'
import { checkDatabase } from './db.js'
import { registerApiRoutes } from './apiRoutes.js'
import { RoomStore } from './roomStore.js'

const PORT = Number(process.env.PORT) || 3001

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'https://study-sprint-black.vercel.app',
]

const parseClientOrigins = (): string[] => {
  const raw = process.env.CLIENT_ORIGIN
  if (raw && raw.trim()) {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

/** İzinli kökenler: varsayılanlar + CLIENT_ORIGIN (virgülle çoklu). */
const ALLOWED_ORIGINS = [...new Set([...DEFAULT_ORIGINS, ...parseClientOrigins()])]

/** Tarayıcıdan gelen Origin başlığını kabul et (CORS + Socket.IO). * kullanılmaz. */
const isClientOriginAllowed = (origin: string | undefined): boolean => {
  if (origin === undefined || origin === '') return true
  const o = origin.trim()
  if (o === '') return true
  if (ALLOWED_ORIGINS.includes(o)) return true
  try {
    const u = new URL(o)
    if (u.protocol === 'https:' && u.hostname.endsWith('.vercel.app')) return true
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}

const corsAllowedHeaders = [
  'Content-Type',
  'Authorization',
  'X-Client-Id',
  'Accept',
  'X-Requested-With',
  'Cache-Control',
]

const applyExpressCors = (req: express.Request, res: express.Response): boolean => {
  const origin = req.get('Origin')
  if (origin && isClientOriginAllowed(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.vary('Origin')
  }
  if (req.method === 'OPTIONS') {
    if (!origin || !isClientOriginAllowed(origin)) {
      res.status(403).end()
      return true
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', corsAllowedHeaders.join(', '))
    res.setHeader('Access-Control-Max-Age', '86400')
    res.status(204).end()
    return true
  }
  return false
}

const allowSocketHandshake = (req: IncomingMessage): boolean => {
  const origin = req.headers.origin
  if (typeof origin !== 'string' || origin === '') return true
  return isClientOriginAllowed(origin)
}

const app = express()
app.set('trust proxy', 1)

const httpServer = createServer(app)

const io = new Server(httpServer, {
  cors: {
    origin: (origin, cb) => {
      cb(null, isClientOriginAllowed(origin))
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: corsAllowedHeaders,
    credentials: true,
  },
  allowRequest: (req, callback) => {
    callback(null, allowSocketHandshake(req))
  },
})

/** Manuel CORS: preflight ve yanıtlarda tek tutarlı başlıklar (cors paketinden bağımsız). */
app.use((req, res, next) => {
  if (applyExpressCors(req, res)) return
  next()
})
app.use(express.json({ limit: '32kb' }))

const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  /** Preflight asla limite takılmasın; yanıtta ACAO olmayınca tarayıcı "CORS hatası" gösterir. */
  skip: (req) => req.method === 'OPTIONS',
})

app.use('/api', apiLimiter)
registerApiRoutes(app)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverMusicDir = path.resolve(__dirname, '../music')
const rootMusicDir = path.resolve(__dirname, '../../music')
const musicDir = existsSync(serverMusicDir) ? serverMusicDir : rootMusicDir
app.use('/music', express.static(musicDir))

app.get('/api/music/tracks', async (_req, res) => {
  try {
    const entries = await fs.readdir(musicDir, { withFileTypes: true })
    const tracks = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => /\.(mp3|wav|ogg|m4a)$/i.test(name))
      .sort((a, b) => a.localeCompare(b, 'tr'))
    res.json({ ok: true, tracks })
  } catch {
    res.json({ ok: false, tracks: [] as string[] })
  }
})

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

  socket.on(
    'room:peek',
    (payload: { slug: string }, ack?: (res: any) => void) => {
      const slug = payload.slug.trim().toLowerCase()
      const info = store.peekRoom(slug)
      if (!info) {
        ack?.({ ok: false as const, error: 'Oda bulunamadı.' })
        return
      }
      ack?.({
        ok: true as const,
        roomName: info.roomName,
        hasPassword: info.hasPassword,
        maxParticipants: info.maxParticipants,
        participantCount: info.participantCount,
      })
    },
  )

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

  socket.on('owner:approve', (payload) => {
    store.ownerApprove(io, payload)
  })

  socket.on('owner:approveAll', (payload) => {
    store.ownerApproveAll(io, payload)
  })

  socket.on(
    'debrief:submit',
    (payload: {
      slug: string
      clientId: string
      completedTasks: number
      hideResults: boolean
      awaySeconds?: number
      localHour?: number
    }) => {
      store.submitDebrief(
        io,
        payload.slug,
        payload.clientId,
        payload.completedTasks,
        payload.hideResults,
        payload.awaySeconds,
        payload.localHour,
      )
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
  console.log(`[server] http://localhost:${PORT} · CORS: ${ALLOWED_ORIGINS.join(', ')}`)
})
