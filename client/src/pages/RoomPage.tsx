import type { PublicRoomState, RoomPeekResponse, SessionResultsPayload } from '../shared'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { RoomQr } from '../components/RoomQr'
import { getOrCreateClientId } from '../lib/clientId'
import type { FocusMode } from '../lib/focusAudio'
import { setFocusMode } from '../lib/focusAudio'
import {
  playCountdownFinalTick,
  playCountdownGo,
  playCountdownStrongTick,
  primeCountdownAudio,
} from '../lib/countdownAudio'
import { parseRoomSlugFromText } from '../lib/parseRoomUrl'
import { playSessionEndChime } from '../lib/sound'
import { apiFetch, apiUrl } from '../lib/apiBase'
import { useTheme } from '../context/ThemeContext'
import { getSocket } from '../lib/socket'

const joinKey = (slug: string) => `studysprint_joined_${slug}`
const resultsKey = (slug: string) => `studysprint_results_${slug}`

const LEAVE_SESSION_CONFIRM =
  'Seans devam ediyor. Odadan cikmak istediginize emin misiniz?'

type PeekOk = {
  roomName: string
  hasPassword: boolean
  maxParticipants: number
  participantCount: number
}

export const RoomPage = () => {
  const { slug: rawSlug = '' } = useParams()
  const slug = rawSlug.trim().toLowerCase()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const clientId = useMemo(() => getOrCreateClientId(), [])

  const [room, setRoom] = useState<PublicRoomState | null>(null)
  const [results, setResults] = useState<SessionResultsPayload | null>(null)
  const [joined, setJoined] = useState(false)

  const [peekLoading, setPeekLoading] = useState(true)
  const [peekError, setPeekError] = useState(false)
  const [peek, setPeek] = useState<PeekOk | null>(null)

  const [joinName, setJoinName] = useState('')
  const [joinPassword, setJoinPassword] = useState('')
  const [joinAnonymous, setJoinAnonymous] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [notes, setNotes] = useState('')
  const [debriefInput, setDebriefInput] = useState('')
  const [debriefHideResults, setDebriefHideResults] = useState(false)
  const [focusMode, setFocusModeState] = useState<FocusMode>('off')
  const [profile, setProfile] = useState<{ streak: number; badges: string[]; xp: number } | null>(
    null,
  )

  const prevPhase = useRef<string | null>(null)
  /** Geri tuşu için tek seferlik history katmanı (useBlocker mobilde güvenilir olmayabiliyor) */
  const backGuardPushedRef = useRef(false)
  const awayMsRef = useRef(0)
  const hiddenAtRef = useRef<number | null>(null)

  const inActiveSession = Boolean(
    room &&
      (room.phase === 'countdown' || room.phase === 'sprint' || room.phase === 'debrief'),
  )

  /** Oturum devam ederken geri tuşu: önce onay; iptal edilirse sayfada kal */
  useEffect(() => {
    if (!joined || !inActiveSession) {
      backGuardPushedRef.current = false
      return
    }
    if (!backGuardPushedRef.current) {
      window.history.pushState({ studySprintRoomGuard: true }, '', window.location.href)
      backGuardPushedRef.current = true
    }
    const onPopState = () => {
      const ok = window.confirm(LEAVE_SESSION_CONFIRM)
      if (ok) {
        backGuardPushedRef.current = false
        void setFocusMode('off')
        setFocusModeState('off')
        try {
          sessionStorage.removeItem(joinKey(slug))
        } catch {
          // yoksay
        }
        navigate('/', { replace: true })
      } else {
        window.history.pushState({ studySprintRoomGuard: true }, '', window.location.href)
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
    }
  }, [joined, inActiveSession, slug, navigate])

  /** Oturum devam ederken footer vb. iç linkler: geri tuşuyla aynı onay */
  useEffect(() => {
    if (!joined || !inActiveSession) return
    const onCaptureClick = (e: MouseEvent) => {
      const raw = (e.target as HTMLElement | null)?.closest?.('a[href]') as
        | HTMLAnchorElement
        | null
        | undefined
      if (!raw || raw.closest('[data-no-leave-guard]')) return
      if (raw.target === '_blank' || raw.getAttribute('download')) return
      let url: URL
      try {
        url = new URL(raw.href, window.location.href)
      } catch {
        return
      }
      if (url.origin !== window.location.origin) return
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search &&
        url.hash === window.location.hash
      ) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      const ok = window.confirm(LEAVE_SESSION_CONFIRM)
      if (!ok) return
      void setFocusMode('off')
      setFocusModeState('off')
      try {
        sessionStorage.removeItem(joinKey(slug))
      } catch {
        // yoksay
      }
      navigate(`${url.pathname}${url.search}${url.hash}`)
    }
    document.addEventListener('click', onCaptureClick, true)
    return () => document.removeEventListener('click', onCaptureClick, true)
  }, [joined, inActiveSession, slug, navigate])

  /** bfcache ile geri gelince odak sesi sürerse kapat */
  useEffect(() => {
    const onPageShow = (ev: PageTransitionEvent) => {
      if (ev.persisted) void setFocusMode('off')
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])

  useEffect(() => {
    setRoom(null)
    setResults(null)
    setBanner(null)
    setPeek(null)
    setPeekError(false)
    setPeekLoading(true)
    setJoined(sessionStorage.getItem(joinKey(slug)) === '1')
  }, [slug])

  useEffect(() => {
    if (joined) return
    let cancelled = false
    setPeek(null)
    setPeekError(false)
    setPeekLoading(true)

    const socket = getSocket()

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return
      setPeekError(true)
      setPeekLoading(false)
    }, 5000)

    socket.emit('room:peek', { slug }, (d: RoomPeekResponse) => {
      if (cancelled) return
      window.clearTimeout(timeoutId)

      if (d.ok) {
        setPeek({
          roomName: d.roomName,
          hasPassword: Boolean(d.hasPassword),
          maxParticipants: d.maxParticipants,
          participantCount: d.participantCount,
        })
      } else {
        setPeekError(true)
      }
      setPeekLoading(false)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [slug, joined])

  useEffect(() => {
    if (peek && !peek.hasPassword) {
      setJoinPassword('')
    }
  }, [peek])

  useEffect(() => {
    void apiFetch(`/api/profile/${clientId}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; streakDays?: number; badges?: string[]; xp?: number }) => {
        if (d.ok)
          setProfile({ streak: d.streakDays ?? 0, badges: d.badges ?? [], xp: d.xp ?? 0 })
      })
      .catch(() => {})
  }, [clientId])

  useEffect(() => {
    if (!joined) return
    const socket = getSocket()

    const onState = (s: PublicRoomState) => {
      setRoom(s)
      if (s.serverMessage) setBanner(s.serverMessage)
    }
    const onResults = (r: SessionResultsPayload) => {
      setResults(r)
      try {
        sessionStorage.setItem(resultsKey(slug), JSON.stringify(r))
      } catch {
        // yoksay
      }
    }
    const onError = (e: { message: string }) => {
      void setFocusMode('off')
      // Resync sırasında oda bulunamazsa/başka bir problem olursa,
      // bu odaya "zaten katılmış" durumunu sıfırlayıp join akışına düşelim.
      try {
        sessionStorage.removeItem(joinKey(slug))
      } catch {
        // yoksay
      }
      setJoined(false)
      setRoom(null)
      setResults(null)
      setJoinError(e.message)
      setBanner(null)
    }
    const onKicked = (payload?: { message?: string }) => {
      void setFocusMode('off')
      sessionStorage.removeItem(joinKey(slug))
      setJoined(false)
      setBanner(payload?.message ?? 'Odadan çıkartıldınız.')
      navigate('/', {
        replace: true,
        state: { bannerMessage: payload?.message ?? 'Odadan çıkartıldınız.' },
      })
    }

    const onClosed = (payload?: { message?: string }) => {
      void setFocusMode('off')
      sessionStorage.removeItem(joinKey(slug))
      setJoined(false)
      setBanner(payload?.message ?? 'Oda kapatıldı.')
      navigate('/', {
        replace: true,
        state: { bannerMessage: payload?.message ?? 'Oda kapatıldı.' },
      })
    }

    socket.on('room:state', onState)
    socket.on('room:results', onResults)
    socket.on('room:error', onError)
    socket.on('room:kicked', onKicked)
    socket.on('room:closed', onClosed)

    socket.emit('room:resync', { slug, clientId })

    return () => {
      socket.off('room:state', onState)
      socket.off('room:results', onResults)
      socket.off('room:error', onError)
      socket.off('room:kicked', onKicked)
      socket.off('room:closed', onClosed)
      void setFocusMode('off')
      socket.emit('room:leave')
    }
  }, [slug, clientId, joined, navigate])

  useEffect(() => {
    if (!room || room.phase !== 'results' || results) return
    try {
      const raw = sessionStorage.getItem(resultsKey(slug))
      if (raw) setResults(JSON.parse(raw) as SessionResultsPayload)
    } catch {
      // yoksay
    }
  }, [room, results, slug])

  useEffect(() => {
    if (!room) return
    if (prevPhase.current === 'countdown' && room.phase === 'sprint') {
      playCountdownGo()
    }
    if (prevPhase.current === 'sprint' && room.phase === 'debrief') {
      playSessionEndChime()
      void setFocusMode('off')
      setFocusModeState('off')
    }
    if (prevPhase.current !== 'results' && room.phase === 'results') {
      void setFocusMode('off')
      setFocusModeState('off')
    }
    prevPhase.current = room.phase
  }, [room])

  useEffect(() => {
    if (room?.phase === 'results') {
      void setFocusMode('off')
      setFocusModeState('off')
    }
  }, [room?.phase])

  useEffect(() => {
    if (!room || room.phase !== 'countdown' || room.countdownStep == null) return
    const step = room.countdownStep
    const gen = room.countdownGen
    if (step === 3 || step === 2) {
      playCountdownStrongTick(gen, step)
    } else if (step === 1) {
      playCountdownFinalTick(gen)
    }
  }, [room])

  useEffect(() => {
    if (room?.phase === 'debrief') setDebriefHideResults(false)
  }, [room?.phase])

  useEffect(() => {
    if (room?.phase === 'sprint') {
      awayMsRef.current = 0
      hiddenAtRef.current = null
    }
  }, [room?.phase, room?.slug])

  useEffect(() => {
    if (!room || room.phase !== 'sprint') return
    const onVis = () => {
      if (document.hidden) {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current != null) {
        awayMsRef.current += Date.now() - hiddenAtRef.current
        hiddenAtRef.current = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [room])

  useEffect(() => {
    if (!room || room.phase !== 'sprint' || room.sprintEndsAt === null) {
      setRemainingMs(0)
      return
    }
    const tick = () => {
      setRemainingMs(Math.max(0, room.sprintEndsAt! - Date.now()))
    }
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [room])

  useEffect(() => {
    if (!room || room.phase !== 'sprint') return
    if (room.durationMinutes < 25) return
    if (!('Notification' in window)) return
    const intervalMin = 25
    const id = window.setInterval(() => {
      if (Notification.permission === 'granted') {
        new Notification('StudySprint', {
          body: 'Kısa mola — su için, gözlerini dinlendir.',
        })
      }
    }, intervalMin * 60 * 1000)
    return () => window.clearInterval(id)
  }, [room])

  useEffect(() => {
    if (!room) return
    const inActiveSession =
      room.phase === 'countdown' || room.phase === 'sprint' || room.phase === 'debrief'
    if (!inActiveSession) return
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [room])

  useEffect(() => {
    if (!room || room.phase !== 'sprint') return
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [room])

  const handleJoin = useCallback(() => {
    if (!joinAnonymous && !joinName.trim()) {
      setJoinError('Görünen ad gerekli veya anonim katılmayı seçin.')
      return
    }
    primeCountdownAudio()
    setJoinError(null)
    const socket = getSocket()
    socket.emit(
      'room:join',
      {
        slug,
        password: joinPassword.trim() || undefined,
        displayName: joinAnonymous ? '' : joinName.trim(),
        isAnonymous: joinAnonymous,
        clientId,
      },
      (ack: { ok: boolean; error?: string }) => {
        if (!ack.ok) {
          setJoinError(ack.error ?? 'Katılım başarısız')
          return
        }
        sessionStorage.setItem(joinKey(slug), '1')
        setJoined(true)
      },
    )
  }, [clientId, joinAnonymous, joinName, joinPassword, slug])

  const handleReady = (ready: boolean) => {
    getSocket().emit('room:ready', { slug, clientId, ready })
  }

  const handleOwnerStart = () => {
    getSocket().emit('owner:start', { slug, ownerClientId: clientId })
  }

  const handleLeaveRoom = () => {
    const active =
      room?.phase === 'countdown' || room?.phase === 'sprint' || room?.phase === 'debrief'
    if (active) {
      const ok = window.confirm(LEAVE_SESSION_CONFIRM)
      if (!ok) return
    }
    void setFocusMode('off')
    setFocusModeState('off')
    try {
      sessionStorage.removeItem(joinKey(slug))
    } catch {
      // yoksay
    }
    navigate('/')
  }

  const isOwner = room?.ownerId === clientId

  const inviteUrl = useMemo(() => `${window.location.origin}/room/${slug}`, [slug])

  const sortedLeaderboard = useMemo(() => {
    if (!results) return []
    const copy = [...results.highlights]
    copy.sort((a, b) => {
      if (a.isHidden !== b.isHidden) return a.isHidden ? 1 : -1
      if (b.completedTasks !== a.completedTasks) return b.completedTasks - a.completedTasks
      return b.targetPercent - a.targetPercent
    })
    return copy
  }, [results])

  const chartData = useMemo(() => {
    if (!sortedLeaderboard.length) return []
    return sortedLeaderboard.map((h) => ({
      name: h.displayLabel.slice(0, 12),
      tamamlanan: h.isHidden ? 0 : h.completedTasks,
      hedefYuzde: h.isHidden ? 0 : h.targetPercent,
    }))
  }, [sortedLeaderboard])

  const chartPalette = useMemo(
    () =>
      theme === 'dark'
        ? {
            grid: '#334155',
            tick: '#94a3b8',
            tooltipBg: '#0f172a',
            tooltipBorder: '#334155',
          }
        : {
            grid: '#cbd5e1',
            tick: '#475569',
            tooltipBg: '#ffffff',
            tooltipBorder: '#e2e8f0',
          },
    [theme],
  )

  const handleFocusChange = async (mode: FocusMode) => {
    setFocusModeState(mode)
    const result = await setFocusMode(mode)
    if (result.message) {
      setBanner(result.message)
    }
  }

  const handleQrDecoded = useCallback(
    (text: string) => {
      const parsed = parseRoomSlugFromText(text)
      if (parsed === slug) {
        setJoinError(null)
      } else if (parsed) {
        setJoinError('Bu QR başka bir odaya ait. Kodu elle girin veya doğru QR’ı okutun.')
      } else {
        setJoinError('QR geçerli bir oda bağlantısı içermiyor.')
      }
    },
    [slug],
  )

  if (!slug) {
    return (
      <div className="p-8 text-center text-slate-600 dark:text-slate-400">
        Geçersiz oda.{' '}
        <Link to="/" className="text-brand-700 dark:text-brand-400">
          Ana sayfa
        </Link>
      </div>
    )
  }

  if (!joined) {
    if (peekLoading) {
      return (
        <div className="flex min-h-full items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Oda kontrol ediliyor…
        </div>
      )
    }
    if (peekError || !peek) {
      return (
        <div className="min-h-full bg-slate-100 px-4 py-16 text-center dark:bg-slate-950">
          <p className="text-lg text-amber-800 dark:text-amber-200">
            Bu kodla bir oda bulunamadı.
          </p>
          <Link to="/" className="mt-4 inline-block text-brand-700 dark:text-brand-400">
            Ana sayfaya dön
          </Link>
        </div>
      )
    }

    return (
      <div className="min-h-full bg-slate-100 px-4 py-12 dark:bg-slate-950">
        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-white">Odaya katıl</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{peek.roomName}</span>
            {' · '}
            {peek.participantCount}/{peek.maxParticipants} kişi
          </p>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-500">Görünen ad</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              disabled={joinAnonymous}
              placeholder={joinAnonymous ? 'Anonim katılım' : 'Adınız'}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={joinAnonymous}
              onChange={(e) => {
                setJoinAnonymous(e.target.checked)
                if (e.target.checked) setJoinName('')
              }}
            />
            Anonim katıl
          </label>
          {peek.hasPassword && (
            <label className="block text-sm">
              <span className="text-slate-600 dark:text-slate-500">Oda şifresi</span>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={joinPassword}
                onChange={(e) => setJoinPassword(e.target.value)}
                autoComplete="off"
              />
            </label>
          )}
          {joinError && (
            <p className="text-sm text-amber-800 dark:text-amber-300">{joinError}</p>
          )}
          <button
            type="button"
            onClick={handleJoin}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white"
          >
            Katıl
          </button>
          <Link to="/" className="block text-center text-sm text-brand-700 dark:text-brand-400">
            Ana sayfa
          </Link>
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="flex min-h-full items-center justify-center bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Oda yükleniyor…
      </div>
    )
  }

  const selfParticipant = room.participants.find((p) => p.id === clientId)
  const selfDistractionCount = selfParticipant?.distractionCount ?? 0
  const debriefWaitingOthers =
    room.phase === 'debrief' &&
    Boolean(selfParticipant?.debriefSubmitted) &&
    room.participants.some((p) => !p.debriefSubmitted)

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 px-3 py-8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 sm:px-6">
      {banner && (
        <div
          className="mx-auto mb-4 max-w-3xl rounded-lg border border-slate-200 bg-white/95 px-4 py-2 text-center text-sm text-slate-800 shadow-sm dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200 dark:shadow-none"
          role="status"
        >
          {banner}
        </div>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-wrap items-start gap-4">
            <RoomQr url={inviteUrl} />
            <div>
              <p className="text-xs uppercase tracking-widest text-brand-700 dark:text-brand-400">
                StudySprint
              </p>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white sm:text-2xl">
                {room.roomName}
              </h1>
              <p className="text-xs text-slate-600 dark:text-slate-500">
                Kod:{' '}
                <span className="font-mono text-base text-slate-800 dark:text-slate-200">{slug}</span> ·{' '}
                {room.participants.length}/{room.maxParticipants} kişi
              </p>
              {profile && (
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
                  XP: {profile.xp} · Seri: {profile.streak} gün
                  {profile.badges.length > 0 && (
                    <span className="ml-2 text-brand-700 dark:text-brand-300">
                      Rozetler: {profile.badges.join(', ')}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                void navigator.clipboard.writeText(inviteUrl)
                setBanner('Davet linki kopyalandı.')
              }}
            >
              Linki kopyala
            </button>
            <Link
              to="/"
              data-no-leave-guard
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={(e) => {
                e.preventDefault()
                handleLeaveRoom()
              }}
            >
              Çık
            </Link>
          </div>
        </header>

        {room.phase === 'lobby' && (
          <LobbySection
            room={room}
            clientId={clientId}
            isOwner={Boolean(isOwner)}
            slug={slug}
            onReady={handleReady}
            onOwnerStart={handleOwnerStart}
          />
        )}

        {room.phase === 'countdown' && (
          <div
            className="flex min-h-[40vh] flex-col items-center justify-center rounded-2xl border border-brand-500/40 bg-white/95 p-8 text-center shadow-sm dark:border-brand-500/30 dark:bg-slate-900/60 dark:shadow-none"
            aria-live="assertive"
          >
            <p className="text-sm font-medium text-brand-800 dark:text-brand-300">Hazır olun</p>
            <p className="mt-4 text-7xl font-bold text-slate-900 tabular-nums dark:text-white">
              {room.countdownStep ?? '·'}
            </p>
            {isOwner && (
              <OwnerBar slug={slug} ownerClientId={clientId} phase={room.phase} />
            )}
          </div>
        )}

        {room.phase === 'sprint' && (
          <SprintSection
            room={room}
            clientId={clientId}
            remainingMs={remainingMs}
            notes={notes}
            onNotes={setNotes}
            focusMode={focusMode}
            onFocusMode={handleFocusChange}
            slug={slug}
            isOwner={Boolean(isOwner)}
          />
        )}

        {room.phase === 'debrief' && (
          <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Ne kadar ilerledin?
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Tamamladığın soru veya görev sayısını gir (hedef: {room.targetTasks}).
            </p>
            {!selfParticipant?.debriefSubmitted && (
              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  type="number"
                  min={0}
                  className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={debriefInput}
                  onChange={(e) => setDebriefInput(e.target.value)}
                  aria-label="Tamamlanan görev sayısı"
                />
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={debriefHideResults}
                    onChange={(e) => setDebriefHideResults(e.target.checked)}
                    className="size-4 rounded border-slate-400 dark:border-slate-600"
                  />
                  Sonuçlarımı gizle
                </label>
                <button
                  type="button"
                  className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    const n = Number(debriefInput)
                    if (hiddenAtRef.current != null) {
                      awayMsRef.current += Date.now() - hiddenAtRef.current
                      hiddenAtRef.current = null
                    }
                    getSocket().emit('debrief:submit', {
                      slug,
                      clientId,
                      completedTasks: Number.isFinite(n) ? n : 0,
                      hideResults: debriefHideResults,
                      awaySeconds: Math.round(awayMsRef.current / 1000),
                      localHour: new Date().getHours(),
                    })
                  }}
                >
                  Gönder
                </button>
              </div>
            )}
            {debriefWaitingOthers && (
              <p className="mt-4 text-sm text-slate-600 dark:text-slate-400" role="status">
                Diğer kullanıcıların da yanıtlaması bekleniyor…
              </p>
            )}
          </div>
        )}

        {room.phase === 'results' && !results && (
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            Sonuçlar hesaplanıyor…
          </p>
        )}

        {room.phase === 'results' && results && (
          <div className="space-y-6 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:shadow-none">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Liderlik tablosu
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Grup ortalaması:{' '}
              <strong className="text-slate-900 dark:text-white">{results.averageCompleted}</strong> ·
              Hedef: {results.targetTasks}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Dikkat dağıtıcı işaretlerin:{' '}
              <strong className="text-slate-900 dark:text-white">{selfDistractionCount}</strong>
            </p>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.grid} />
                  <XAxis
                    dataKey="name"
                    tick={{ fill: chartPalette.tick, fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: chartPalette.tick, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: chartPalette.tooltipBg,
                      border: `1px solid ${chartPalette.tooltipBorder}`,
                    }}
                  />
                  <Bar dataKey="tamamlanan" fill="#16a34a" name="Tamamlanan" />
                  <Bar dataKey="hedefYuzde" fill="#0284c7" name="Hedef %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2">
              {sortedLeaderboard.map((h, idx) => (
                <li
                  key={h.participantId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800"
                >
                  <span className="text-slate-800 dark:text-slate-200">
                    <span className="mr-2 font-mono text-xs text-slate-500">{idx + 1}.</span>
                    {h.displayLabel}
                    {h.isTop && (
                      <span className="ml-2 text-xs text-amber-700 dark:text-amber-300">
                        En verimli
                      </span>
                    )}
                    {h.isHidden && (
                      <span className="ml-2 text-xs text-slate-500">(gizli)</span>
                    )}
                  </span>
                  <span className="tabular-nums text-slate-600 dark:text-slate-400">
                    {h.isHidden ? 'Gizli' : `${h.completedTasks} · %${h.targetPercent}`}
                  </span>
                </li>
              ))}
            </ul>
            <Link
              to="/"
              className="inline-flex w-full justify-center rounded-xl border border-brand-600/40 bg-brand-50 py-3 text-sm font-semibold text-brand-900 hover:bg-brand-100 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-200 dark:hover:bg-brand-500/20"
            >
              Yeniden başla — ana sayfa
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

const LobbySection = ({
  room,
  clientId,
  isOwner,
  slug,
  onReady,
  onOwnerStart,
}: {
  room: PublicRoomState
  clientId: string
  isOwner: boolean
  slug: string
  onReady: (r: boolean) => void
  onOwnerStart: () => void
}) => {
  const self = room.participants.find((p) => p.id === clientId)
  const ready = self?.status === 'ready'
  const pendingApproval = room.requiresApproval && self?.status === 'pending'
  const socket = getSocket()

  const pendingParticipants =
    room.requiresApproval && isOwner
      ? room.participants.filter((p) => p.id !== room.ownerId && p.status === 'pending')
      : []

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:shadow-none">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Bekleme odası</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {room.requiresApproval ? (
          <>
            Katılımcılar önce kurucu onayı bekler. Onaydan sonra &quot;Hazırım&quot; diyerek hazır olur.
            Herkes hazır olduğunda kurucu{' '}
            <strong className="text-slate-900 dark:text-slate-200">Başlat</strong> ile oturumu
            başlatır.
          </>
        ) : (
          <>
            Katılımcılar &quot;Hazırım&quot; dediğinde burada görünür. Herkes hazır olduğunda kurucu{' '}
            <strong className="text-slate-900 dark:text-slate-200">Başlat</strong> ile oturumu
            başlatır.
          </>
        )}
      </p>
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {room.participants.map((p) => (
          <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
            <span className="text-slate-800 dark:text-slate-200">
              {p.displayName}
              {p.id === room.ownerId && (
                <span className="ml-2 text-xs text-brand-700 dark:text-brand-400">Kurucu</span>
              )}
            </span>
            <span
              className={
                p.status === 'ready'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : p.status === 'pending'
                    ? 'text-amber-800 dark:text-amber-300'
                  : p.status === 'offline'
                    ? 'text-slate-500'
                    : 'text-amber-800 dark:text-amber-300'
              }
            >
              {p.id === room.ownerId
                ? '—'
                : p.status === 'ready'
                  ? 'Hazır'
                  : p.status === 'pending'
                    ? 'Onay bekliyor'
                  : p.status === 'offline'
                    ? 'Çevrimdışı'
                    : 'Bekleniyor'}
            </span>
          </li>
        ))}
      </ul>

      {isOwner && room.requiresApproval && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Katılımcı izinleri</p>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-500">
            Onay verdiklerin oturumda Hazırım diyebilir.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={pendingParticipants.length === 0}
              onClick={() =>
                socket.emit('owner:approveAll', {
                  slug,
                  ownerClientId: clientId,
                })
              }
            >
              Tümünü onayla
            </button>
          </div>

          <ul className="mt-3 space-y-1">
            {pendingParticipants.length === 0 ? (
              <li className="text-sm text-slate-600 dark:text-slate-400">Onay bekleyen yok.</li>
            ) : (
              pendingParticipants.map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800 dark:text-slate-300">{p.displayName}</span>
                  <button
                    type="button"
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                    onClick={() =>
                      socket.emit('owner:approve', {
                        slug,
                        ownerClientId: clientId,
                        targetParticipantId: p.id,
                      })
                    }
                  >
                    Onayla
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!isOwner && (
          <button
            type="button"
            disabled={pendingApproval}
            onClick={() => {
              if (pendingApproval) return
              onReady(!ready)
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              pendingApproval
                ? 'border border-slate-300 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
                : ready
                  ? 'border border-slate-300 text-slate-800 dark:border-slate-600 dark:text-slate-200'
                  : 'bg-brand-600 text-white hover:bg-brand-500'
            } disabled:opacity-90 disabled:cursor-not-allowed`}
          >
            {pendingApproval ? 'Onay bekleniyor' : ready ? 'Hazır değilim' : 'Hazırım'}
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            onClick={onOwnerStart}
            disabled={!room.canOwnerStart}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Başlat
          </button>
        )}
      </div>
      {isOwner && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-500">Katılımcı çıkar</p>
          <ul className="mt-2 space-y-1">
            {room.participants
              .filter((p) => p.id !== room.ownerId)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800 dark:text-slate-300">{p.displayName}</span>
                  <button
                    type="button"
                    className="text-xs text-rose-700 hover:underline dark:text-rose-300"
                    onClick={() =>
                      socket.emit('owner:kick', {
                        slug,
                        ownerClientId: clientId,
                        targetParticipantId: p.id,
                      })
                    }
                  >
                    Çıkar
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  )
}

const OwnerBar = ({
  slug,
  ownerClientId,
  phase,
}: {
  slug: string
  ownerClientId: string
  phase: PublicRoomState['phase']
}) => {
  const socket = getSocket()
  if (phase !== 'sprint' && phase !== 'countdown') return null
  return (
    <div className="flex flex-wrap gap-2">
      {(phase === 'sprint' || phase === 'countdown') && (
        <button
          type="button"
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-900 dark:border-transparent dark:bg-rose-900/60 dark:text-rose-100"
          onClick={() => socket.emit('owner:forceEnd', { slug, ownerClientId })}
        >
          {phase === 'sprint' ? 'Seansı bitir' : 'Geri sayımı iptal'}
        </button>
      )}
      {phase === 'sprint' && (
        <button
          type="button"
          className="rounded-lg border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-800 dark:border-transparent dark:bg-slate-800 dark:text-white"
          onClick={() =>
            socket.emit('owner:extend', { slug, ownerClientId, extraMinutes: 5 })
          }
        >
          +5 dk
        </button>
      )}
    </div>
  )
}

const SprintSection = ({
  room,
  clientId,
  remainingMs,
  notes,
  onNotes,
  focusMode,
  onFocusMode,
  slug,
  isOwner,
}: {
  room: PublicRoomState
  clientId: string
  remainingMs: number
  notes: string
  onNotes: (v: string) => void
  focusMode: FocusMode
  onFocusMode: (m: FocusMode) => void
  slug: string
  isOwner: boolean
}) => {
  const socket = getSocket()
  const mm = Math.floor(remainingMs / 60000)
  const ss = Math.floor((remainingMs % 60000) / 1000)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white/95 p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900/70 dark:shadow-none">
        <p className="text-sm text-slate-600 dark:text-slate-400">Odak seansı</p>
        <p className="mt-2 text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </p>
        {isOwner && (
          <div className="mt-4 flex justify-center">
            <OwnerBar slug={slug} ownerClientId={clientId} phase="sprint" />
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Odak müzikleri (yerel)
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ['off', 'Kapalı'],
                ['mozart40', 'Mozart 40. Senfoni'],
                ['odak', 'Odaklanma ve Konsantrasyon Arttırıcı'],
                ['gnossienne1', 'Gnossienne No.1'],
                ['beyazGurultu', 'Beyaz Gürültü'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => void onFocusMode(mode)}
                className={`rounded-lg px-3 py-1.5 text-xs ${
                  focusMode === mode
                    ? 'bg-brand-600 text-white'
                    : 'border border-slate-200 bg-slate-100 text-slate-800 dark:border-transparent dark:bg-slate-800 dark:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:shadow-none">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Odak koruyucu</h3>
          <button
            type="button"
            className="mt-3 w-full rounded-lg border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
            onClick={() =>
              socket.emit('session:distraction', {
                slug,
                clientId,
              })
            }
          >
            Dikkatim dağıldı
          </button>
          <p className="mt-2 text-xs text-slate-600 dark:text-slate-500">
            Bu oturumdaki işaretlerin sayısı seans sonunda görünür.
          </p>
        </div>
      </div>

      <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          Notlar (yalnızca bu cihazda)
        </span>
        <textarea
          className="mt-2 min-h-[100px] w-full rounded-lg border border-slate-300 bg-white p-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          placeholder="Kısa notlar…"
        />
      </label>

      {isOwner && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Katılımcı yönetimi
          </h3>
          <ul className="mt-2 space-y-2">
            {room.participants
              .filter((p) => p.id !== room.ownerId)
              .map((p) => (
                <li key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-800 dark:text-slate-300">{p.displayName}</span>
                  <button
                    type="button"
                    className="text-xs text-rose-700 hover:underline dark:text-rose-300"
                    onClick={() =>
                      socket.emit('owner:kick', {
                        slug,
                        ownerClientId: clientId,
                        targetParticipantId: p.id,
                      })
                    }
                  >
                    Çıkar
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-100/80 p-3 text-xs text-slate-600 dark:border-slate-800/80 dark:bg-slate-900/30 dark:text-slate-500">
        <p>
          Dikkat dağıtıcı sayısı:{' '}
          {room.participants.find((x) => x.id === clientId)?.distractionCount ?? 0}
        </p>
      </div>
    </div>
  )
}
