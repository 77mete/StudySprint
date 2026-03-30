import { createHash } from 'node:crypto'
import { customAlphabet } from 'nanoid'
import type { Server, Socket } from 'socket.io'
import type {
  OwnerExtendPayload,
  OwnerApproveAllPayload,
  OwnerApprovePayload,
  OwnerKickPayload,
  ParticipantStatus,
  PublicParticipant,
  PublicRoomState,
  ResultHighlight,
  RoomCreatePayload,
  RoomJoinPayload,
  RoomPhase,
  SessionResultsPayload,
} from '@studysprint/shared'
import { persistSessionAndProfiles } from './persistence.js'

const nanoidSlug = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10)

const DEBRIEF_MS = 5 * 60 * 1000
const EXTEND_MINUTES_DEFAULT = 5

const clampDuration = (n: number) => Math.min(240, Math.max(5, Math.round(Number(n) || 25)))
const clampTarget = (n: number) => Math.min(1000, Math.max(1, Math.round(Number(n) || 10)))
const clampCapacity = (n: number) => Math.min(100, Math.max(1, Math.round(Number(n) || 8)))

const hashPassword = (slug: string, plain: string) =>
  createHash('sha256').update(`${slug}:${plain}`).digest('hex')

type InternalParticipant = {
  id: string
  socketId: string | null
  displayName: string
  isAnonymous: boolean
  status: ParticipantStatus
  approvedForRoom: boolean
  distractionCount: number
  debriefSubmitted: boolean
  completedTasks: number | null
}

type InternalRoom = {
  slug: string
  roomName: string
  maxParticipants: number
  ownerId: string
  passwordHash: string | null
  requiresApproval: boolean
  durationMinutes: number
  targetTasks: number
  phase: RoomPhase
  extraMs: number
  countdownGen: number
  countdownStep: number | null
  sprintEndsAt: number | null
  debriefDeadlineAt: number | null
  serverMessage: string | null
  participants: Map<string, InternalParticipant>
  sprintTimer: ReturnType<typeof setInterval> | null
  debriefTimer: ReturnType<typeof setInterval> | null
  anonCounter: number
}

const computeCanOwnerStart = (room: InternalRoom): boolean => {
  const nonOwners = [...room.participants.values()].filter(
    (p) => p.id !== room.ownerId && p.socketId !== null,
  )
  if (nonOwners.length === 0) return true
  return nonOwners.every((p) => p.status === 'ready')
}

const toPublicParticipant = (p: InternalParticipant): PublicParticipant => ({
  id: p.id,
  displayName: p.displayName,
  status: p.status,
  isAnonymous: p.isAnonymous,
  distractionCount: p.distractionCount,
  completedTasks: p.completedTasks,
  debriefSubmitted: p.debriefSubmitted,
})

const serialize = (room: InternalRoom): PublicRoomState => ({
  slug: room.slug,
  roomName: room.roomName,
  maxParticipants: room.maxParticipants,
  requiresApproval: room.requiresApproval,
  phase: room.phase,
  durationMinutes: room.durationMinutes,
  targetTasks: room.targetTasks,
  hasPassword: room.passwordHash !== null,
  ownerId: room.ownerId,
  canOwnerStart: computeCanOwnerStart(room),
  countdownStep: room.countdownStep,
  sprintEndsAt: room.sprintEndsAt,
  debriefDeadlineAt: room.debriefDeadlineAt,
  participants: [...room.participants.values()].map(toPublicParticipant),
  serverMessage: room.serverMessage,
})

const broadcast = (io: Server, room: InternalRoom) => {
  io.to(room.slug).emit('room:state', serialize(room))
  room.serverMessage = null
}

const clearSprintTimer = (room: InternalRoom) => {
  if (room.sprintTimer) {
    clearInterval(room.sprintTimer)
    room.sprintTimer = null
  }
}

const clearDebriefTimer = (room: InternalRoom) => {
  if (room.debriefTimer) {
    clearInterval(room.debriefTimer)
    room.debriefTimer = null
  }
}

export class RoomStore {
  private readonly rooms = new Map<string, InternalRoom>()

  private ensureRoom(slug: string): InternalRoom | null {
    return this.rooms.get(slug) ?? null
  }

  peekRoom(slug: string) {
    const room = this.rooms.get(slug)
    if (!room) return null
    return {
      roomName: room.roomName,
      hasPassword: room.passwordHash !== null,
      maxParticipants: room.maxParticipants,
      participantCount: room.participants.size,
    }
  }

  private finishSprint(io: Server, room: InternalRoom) {
    clearSprintTimer(room)
    room.phase = 'debrief'
    room.sprintEndsAt = null
    room.countdownStep = null
    room.debriefDeadlineAt = Date.now() + DEBRIEF_MS
    for (const p of room.participants.values()) {
      p.debriefSubmitted = false
      p.completedTasks = null
    }
    room.serverMessage = 'Süre doldu — tamamladığınız işi girin.'
    broadcast(io, room)
    this.startDebriefWatcher(io, room)
  }

  private startSprint(io: Server, room: InternalRoom) {
    clearSprintTimer(room)
    room.phase = 'sprint'
    room.countdownStep = null
    const ms = room.durationMinutes * 60 * 1000 + room.extraMs
    room.sprintEndsAt = Date.now() + ms
    room.serverMessage = 'Odak seansı başladı.'
    broadcast(io, room)

    room.sprintTimer = setInterval(() => {
      const r = this.ensureRoom(room.slug)
      if (!r || r.phase !== 'sprint' || r.sprintEndsAt === null) {
        if (r) clearSprintTimer(r)
        return
      }
      if (Date.now() >= r.sprintEndsAt) {
        this.finishSprint(io, r)
      }
    }, 1000)
  }

  private runCountdown(io: Server, room: InternalRoom) {
    clearSprintTimer(room)
    clearDebriefTimer(room)
    room.phase = 'countdown'
    room.countdownStep = 3
    room.countdownGen += 1
    const gen = room.countdownGen
    room.serverMessage = 'Hazır olun — geri sayım.'
    broadcast(io, room)

    const stepDown = (step: number) => {
      const r = this.ensureRoom(room.slug)
      if (!r || r.phase !== 'countdown' || r.countdownGen !== gen) return
      if (step === 0) {
        r.countdownStep = null
        this.startSprint(io, r)
        return
      }
      r.countdownStep = step
      broadcast(io, r)
      setTimeout(() => stepDown(step - 1), 1000)
    }

    setTimeout(() => stepDown(2), 1000)
  }

  private startDebriefWatcher(io: Server, room: InternalRoom) {
    clearDebriefTimer(room)
    room.debriefTimer = setInterval(() => {
      const r = this.ensureRoom(room.slug)
      if (!r || r.phase !== 'debrief') {
        if (r) clearDebriefTimer(r)
        return
      }
      const deadline = r.debriefDeadlineAt
      const allDone = [...r.participants.values()].every((p) => p.debriefSubmitted)
      const timedOut = deadline !== null && Date.now() >= deadline
      if (allDone || timedOut) {
        clearDebriefTimer(r)
        void this.transitionToResults(io, r)
      }
    }, 1500)
  }

  private async transitionToResults(io: Server, room: InternalRoom) {
    clearDebriefTimer(room)
    room.phase = 'results'
    room.debriefDeadlineAt = null
    room.countdownStep = null
    room.sprintEndsAt = null

    const participants = [...room.participants.values()].map(toPublicParticipant)
    const nums = participants
      .map((p) => (p.completedTasks !== null ? Number(p.completedTasks) : 0))
      .filter((n) => !Number.isNaN(n))
    const averageCompleted =
      nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length

    const highlights: ResultHighlight[] = participants.map((p) => {
      const completed = p.completedTasks ?? 0
      const targetPercent =
        room.targetTasks > 0 ? Math.min(100, Math.round((completed / room.targetTasks) * 100)) : 0
      return {
        participantId: p.id,
        displayLabel: p.displayName,
        completedTasks: completed,
        targetPercent,
        isTop: false,
      }
    })

    const maxCompleted = Math.max(0, ...highlights.map((h) => h.completedTasks))
    for (const h of highlights) {
      h.isTop = h.completedTasks === maxCompleted && maxCompleted > 0
    }

    const payload: SessionResultsPayload = {
      slug: room.slug,
      targetTasks: room.targetTasks,
      averageCompleted: Math.round(averageCompleted * 10) / 10,
      highlights,
    }

    room.serverMessage = 'Sonuçlar hazır.'
    broadcast(io, room)
    io.to(room.slug).emit('room:results', payload)

    await persistSessionAndProfiles({
      roomSlug: room.slug,
      durationMinutes: room.durationMinutes,
      targetTasks: room.targetTasks,
      participants,
      highlights: highlights.map((h) => ({
        participantId: h.participantId,
        label: h.displayLabel,
        completedTasks: h.completedTasks,
        targetPercent: h.targetPercent,
      })),
    })
  }

  createRoom(io: Server, socket: Socket, payload: RoomCreatePayload) {
    const roomName = payload.roomName.trim()
    if (!roomName) {
      return { ok: false as const, error: 'Oda adı gerekli.' }
    }

    if (!payload.isAnonymous && !payload.displayName.trim()) {
      return { ok: false as const, error: 'Görünen ad gerekli veya anonim katılmayı seçin.' }
    }

    const durationMinutes = clampDuration(payload.durationMinutes)
    const targetTasks = clampTarget(payload.targetTasks)
    const maxParticipants = clampCapacity(payload.maxParticipants)

    let slug = nanoidSlug()
    while (this.rooms.has(slug)) {
      slug = nanoidSlug()
    }

    const passwordHash =
      payload.password && payload.password.length > 0 ? hashPassword(slug, payload.password) : null

    let anonCounter = 0
    let ownerDisplay = payload.displayName.trim()
    if (payload.isAnonymous) {
      anonCounter += 1
      ownerDisplay = `Anonim #${anonCounter}`
    } else if (!ownerDisplay) {
      ownerDisplay = 'Kurucu'
    }

    const owner: InternalParticipant = {
      id: payload.clientId,
      socketId: socket.id,
      displayName: ownerDisplay,
      isAnonymous: payload.isAnonymous,
      status: 'waiting',
      approvedForRoom: true,
      distractionCount: 0,
      debriefSubmitted: false,
      completedTasks: null,
    }

    const room: InternalRoom = {
      slug,
      roomName,
      maxParticipants,
      ownerId: owner.id,
      passwordHash,
      requiresApproval: payload.requiresApproval,
      durationMinutes,
      targetTasks,
      phase: 'lobby',
      extraMs: 0,
      countdownGen: 0,
      countdownStep: null,
      sprintEndsAt: null,
      debriefDeadlineAt: null,
      serverMessage: 'Oda oluşturuldu. Davet linkini paylaşın.',
      participants: new Map([[owner.id, owner]]),
      sprintTimer: null,
      debriefTimer: null,
      anonCounter,
    }

    this.rooms.set(slug, room)
    void socket.join(slug)

    broadcast(io, room)
    return { ok: true as const, slug, invitePath: `/room/${slug}` }
  }

  joinRoom(io: Server, socket: Socket, payload: RoomJoinPayload) {
    const slug = payload.slug.trim().toLowerCase()
    const room = this.rooms.get(slug)
    if (!room) {
      return { ok: false as const, error: 'Oda bulunamadı.' }
    }

    if (!payload.isAnonymous && !payload.displayName.trim()) {
      return { ok: false as const, error: 'Görünen ad gerekli veya anonim katılmayı seçin.' }
    }

    const existing = room.participants.get(payload.clientId)

    if (room.passwordHash) {
      if (!payload.password || payload.password.length === 0) {
        return { ok: false as const, error: 'Bu oda şifre korumalı — şifre gerekli.' }
      }
      const attempt = hashPassword(slug, payload.password)
      if (attempt !== room.passwordHash) {
        return { ok: false as const, error: 'Şifre hatalı.' }
      }
    } else if (!existing && payload.password && payload.password.trim().length > 0) {
      return { ok: false as const, error: 'Bu odanın şifresi yok — şifre alanını boş bırakın.' }
    }

    if (existing) {
      existing.socketId = socket.id
      if (payload.isAnonymous) {
        existing.isAnonymous = true
      } else {
        existing.displayName = payload.displayName.trim()
        existing.isAnonymous = false
      }
      if (room.phase === 'lobby') {
        if (existing.approvedForRoom) {
          existing.status = 'waiting'
        } else {
          existing.status = room.requiresApproval ? 'pending' : 'waiting'
        }
      }
      if (existing.status === 'offline') {
        if (room.requiresApproval && !existing.approvedForRoom) {
          existing.status = 'pending'
        } else {
          existing.status = 'waiting'
        }
      }
    } else {
      if (room.phase !== 'lobby') {
        return {
          ok: false as const,
          error: 'Oturum başladı — yeni katılım kapalı.',
        }
      }
      if (room.participants.size >= room.maxParticipants) {
        return { ok: false as const, error: 'Oda dolu.' }
      }

      room.anonCounter += 1
      const displayName = payload.isAnonymous
        ? `Anonim #${room.anonCounter}`
        : payload.displayName.trim()

      const p: InternalParticipant = {
        id: payload.clientId,
        socketId: socket.id,
        displayName,
        isAnonymous: payload.isAnonymous,
        status: room.requiresApproval && payload.clientId !== room.ownerId ? 'pending' : 'waiting',
        approvedForRoom: room.requiresApproval && payload.clientId !== room.ownerId ? false : true,
        distractionCount: 0,
        debriefSubmitted: false,
        completedTasks: null,
      }
      room.participants.set(p.id, p)
    }

    void socket.join(slug)
    const joinedP = room.participants.get(payload.clientId)
    room.serverMessage = `${joinedP?.displayName ?? 'Bir katılımcı'} odaya katıldı.`
    broadcast(io, room)
    return { ok: true as const, slug, invitePath: `/room/${slug}` }
  }

  leaveRoom(io: Server, socket: Socket) {
    const rooms = [...socket.rooms].filter((r) => r !== socket.id)
    for (const slug of rooms) {
      const room = this.rooms.get(slug)
      if (!room) continue
      const p = [...room.participants.values()].find((x) => x.socketId === socket.id)
      if (p) {
        p.socketId = null
        p.status = 'offline'
      }
      void socket.leave(slug)
      room.serverMessage = 'Bir katılımcı ayrıldı veya bağlantı koptu.'
      broadcast(io, room)
    }
  }

  onDisconnect(io: Server, socket: Socket) {
    this.leaveRoom(io, socket)
  }

  setReady(io: Server, slug: string, clientId: string, ready: boolean) {
    const room = this.rooms.get(slug)
    if (!room || room.phase !== 'lobby') return
    if (clientId === room.ownerId) return
    const p = room.participants.get(clientId)
    if (!p || p.socketId === null) return
    if (room.requiresApproval && p.status === 'pending') return
    p.status = ready ? 'ready' : 'waiting'
    broadcast(io, room)
  }

  private ownerApproveOne(io: Server, room: InternalRoom, targetParticipantId: string) {
    const target = room.participants.get(targetParticipantId)
    if (!target) return
    if (target.id === room.ownerId) return
    target.approvedForRoom = true
    if (room.phase === 'lobby' && target.socketId) {
      if (target.status === 'pending') target.status = 'waiting'
    }
    broadcast(io, room)
  }

  private approveAllInternal(io: Server, room: InternalRoom) {
    let changed = false
    for (const p of room.participants.values()) {
      if (p.id === room.ownerId) continue
      if (!p.approvedForRoom) {
        p.approvedForRoom = true
        if (room.phase === 'lobby' && p.socketId && p.status === 'pending') {
          p.status = 'waiting'
        }
        changed = true
      }
    }
    if (changed) broadcast(io, room)
  }

  ownerApprove(io: Server, payload: OwnerApprovePayload) {
    const room = this.rooms.get(payload.slug)
    if (!room || room.ownerId !== payload.ownerClientId || room.phase !== 'lobby') return
    this.ownerApproveOne(io, room, payload.targetParticipantId)
  }

  ownerApproveAll(io: Server, payload: OwnerApproveAllPayload) {
    const room = this.rooms.get(payload.slug)
    if (!room || room.ownerId !== payload.ownerClientId || room.phase !== 'lobby') return
    this.approveAllInternal(io, room)
  }

  ownerStart(io: Server, slug: string, ownerClientId: string) {
    const room = this.rooms.get(slug)
    if (!room || room.ownerId !== ownerClientId || room.phase !== 'lobby') return
    if (!computeCanOwnerStart(room)) {
      room.serverMessage = 'Tüm katılımcılar hazır olmadan başlatılamaz.'
      broadcast(io, room)
      return
    }
    this.runCountdown(io, room)
  }

  ownerForceEnd(io: Server, slug: string, ownerClientId: string) {
    const room = this.rooms.get(slug)
    if (!room || room.ownerId !== ownerClientId) return
    if (room.phase === 'sprint') {
      this.finishSprint(io, room)
      return
    }
    if (room.phase === 'countdown') {
      room.countdownGen += 1
      clearSprintTimer(room)
      room.phase = 'lobby'
      room.countdownStep = null
      for (const p of room.participants.values()) {
        if (p.socketId) p.status = 'waiting'
      }
      room.serverMessage = 'Geri sayım iptal edildi.'
      broadcast(io, room)
    }
  }

  ownerExtend(io: Server, payload: OwnerExtendPayload) {
    const room = this.rooms.get(payload.slug)
    if (!room || room.ownerId !== payload.ownerClientId || room.phase !== 'sprint') return
    if (room.sprintEndsAt === null) return
    const addMin = payload.extraMinutes ?? EXTEND_MINUTES_DEFAULT
    const addMs = Math.min(120, Math.max(1, addMin)) * 60 * 1000
    room.extraMs += addMs
    room.sprintEndsAt += addMs
    room.serverMessage = `Süre uzatıldı (+${Math.round(addMs / 60000)} dk).`
    broadcast(io, room)
  }

  ownerKick(io: Server, payload: OwnerKickPayload) {
    const room = this.rooms.get(payload.slug)
    if (!room || room.ownerId !== payload.ownerClientId) return
    if (payload.targetParticipantId === room.ownerId) return
    const target = room.participants.get(payload.targetParticipantId)
    if (target?.socketId) {
      const sock = io.sockets.sockets.get(target.socketId)
      sock?.emit('room:kicked', {
        message: 'Odadan çıkartıldınız.',
      })
      sock?.leave(payload.slug)
      sock?.disconnect(true)
    }
    room.participants.delete(payload.targetParticipantId)
    room.serverMessage = 'Bir katılımcı odadan çıkarıldı.'
    broadcast(io, room)
  }

  distraction(io: Server, slug: string, clientId: string) {
    const room = this.rooms.get(slug)
    if (!room || room.phase !== 'sprint') return
    const p = room.participants.get(clientId)
    if (!p || p.socketId === null) return
    p.distractionCount += 1
    broadcast(io, room)
  }

  submitDebrief(io: Server, slug: string, clientId: string, completedTasks: number) {
    const room = this.rooms.get(slug)
    if (!room || room.phase !== 'debrief') return
    const p = room.participants.get(clientId)
    if (!p || p.socketId === null) return
    const n = Math.max(0, Math.round(Number(completedTasks)))
    p.completedTasks = n
    p.debriefSubmitted = true
    broadcast(io, room)

    const allDone = [...room.participants.values()].every((q) => q.debriefSubmitted)
    if (allDone) {
      clearDebriefTimer(room)
      void this.transitionToResults(io, room)
    }
  }

  syncState(io: Server, socket: Socket, slug: string) {
    const room = this.rooms.get(slug)
    if (!room) {
      socket.emit('room:error', { message: 'Oda bulunamadı veya süresi doldu.' })
      return
    }
    socket.emit('room:state', serialize(room))
  }

  resync(io: Server, socket: Socket, slug: string, clientId: string) {
    const room = this.rooms.get(slug)
    if (!room) {
      socket.emit('room:error', { message: 'Oda bulunamadı.' })
      return
    }
    const p = room.participants.get(clientId)
    if (!p) {
      socket.emit('room:error', { message: 'Bu odada kayıtlı değilsiniz — tekrar katılın.' })
      return
    }
    if (room.requiresApproval && !p.approvedForRoom && room.phase !== 'lobby') {
      socket.emit('room:kicked', {
        message: 'Oturum başlamadan önce onay almadan katılamazsın.',
      })
      room.participants.delete(clientId)
      socket.disconnect(true)
      return
    }
    p.socketId = socket.id
    if (p.status === 'offline') {
      if (room.requiresApproval && !p.approvedForRoom) {
        p.status = 'pending'
      } else {
        p.status = 'waiting'
      }
    }
    void socket.join(slug)
    broadcast(io, room)
  }
}
