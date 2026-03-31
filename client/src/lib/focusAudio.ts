import { apiUrl } from './apiBase'

/**
 * Odak müzikleri: Sadece `music/` klasöründeki parçalar.
 * Her seçimde çalan mp3, `loop=true` olacak şekilde tekrar eder.
 */
export type FocusMode = 'off' | 'mozart40' | 'odak' | 'gnossienne1' | 'beyazGurultu'

const TRACK_HINTS: Record<Exclude<FocusMode, 'off'>, string[]> = {
  mozart40: ['mozart 40. senfoni', 'mozart 40', 'mozart'],
  odak: ['odaklanma ve konsantrasyon arttırıcı', 'odaklanma', 'konsantrasyon', 'odak'],
  gnossienne1: ['gnossienne no.1', 'gnossienne 1', 'gnossienne'],
  beyazGurultu: ['beyaz gürültü', 'beyaz gurultu', 'white noise'],
}

const TRACK_FILE_CANDIDATES: Record<Exclude<FocusMode, 'off'>, string[]> = {
  mozart40: ['Mozart 40. Senfoni.mp3', 'Mozart.mp3', 'mozart.mp3'],
  odak: ['Odaklanma ve Konsantrasyon Arttırıcı.mp3', 'odak.mp3', 'Odak.mp3'],
  gnossienne1: ['Gnossienne No.1.mp3', 'Gnossienne.mp3', 'gnossienne.mp3'],
  beyazGurultu: ['Beyaz Gürültü.mp3', 'byzGurultu.mp3', 'beyazGurultu.mp3'],
}

type FocusSetResult = {
  ok: boolean
  source: 'off' | 'file'
  message?: string
}

let audio: HTMLAudioElement | null = null
let availableTracksPromise: Promise<string[]> | null = null

const stop = () => {
  if (audio) {
    try {
      audio.pause()
      audio.currentTime = 0
      audio.removeAttribute('src')
      audio.load()
    } catch {
      // yoksay
    }
    audio = null
  }
}

const normalizeTrackName = (v: string) =>
  v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const getAvailableTracks = async (): Promise<string[]> => {
  if (!availableTracksPromise) {
    availableTracksPromise = fetch(apiUrl('/api/music/tracks'))
      .then((r) => r.json())
      .then((d: { ok?: boolean; tracks?: string[] }) => (d.ok ? d.tracks ?? [] : []))
      .catch(() => [])
  }
  return availableTracksPromise
}

const resolveTrackFileName = async (mode: Exclude<FocusMode, 'off'>): Promise<string | null> => {
  const tracks = await getAvailableTracks()
  if (tracks.length === 0) return null
  const normalized = tracks.map((name) => ({ raw: name, normalized: normalizeTrackName(name) }))
  for (const hint of TRACK_HINTS[mode]) {
    const normalizedHint = normalizeTrackName(hint)
    const exact = normalized.find((t) => t.normalized === normalizedHint)
    if (exact) return exact.raw
    const partial = normalized.find((t) => t.normalized.includes(normalizedHint))
    if (partial) return partial.raw
  }
  return null
}

const playFileFocus = (url: string): Promise<{ ok: boolean; reason?: string }> => {
  const a = new Audio()
  a.loop = true
  a.preload = 'auto'
  a.volume = 0.35
  a.src = url
  a.load()
  audio = a

  try {
    a.currentTime = 0
    const p = a.play()
    if (p && typeof (p as Promise<void>).then === 'function') {
      return (p as Promise<void>)
        .then(() => ({ ok: true }))
        .catch((err: unknown) => {
          const msg =
            err instanceof Error
              ? err.message
              : typeof err === 'string'
                ? err
                : 'Bilinmeyen oynatma hatasi'
          return { ok: false, reason: msg }
        })
    }
    return Promise.resolve({ ok: true })
  } catch {
    return Promise.resolve({ ok: false, reason: 'play() cagrisinda hata olustu' })
  }
}

const tryPlayCandidates = async (mode: Exclude<FocusMode, 'off'>) => {
  const candidates = TRACK_FILE_CANDIDATES[mode]
  for (const fileName of candidates) {
    const result = await playFileFocus(apiUrl(`/music/${encodeURIComponent(fileName)}`))
    if (result.ok) return { ok: true as const }
    stop()
  }
  return { ok: false as const, reason: 'Aday dosyalardan hicbiri acilamadi.' }
}

export const setFocusMode = async (mode: FocusMode): Promise<FocusSetResult> => {
  stop()
  if (mode === 'off') return { ok: true, source: 'off' }

  const directPlay = await tryPlayCandidates(mode)
  if (directPlay.ok) return { ok: true, source: 'file' }

  const fileName = await resolveTrackFileName(mode)
  if (!fileName) {
    return {
      ok: false,
      source: 'file',
      message: 'music klasorunde ilgili ses dosyasi bulunamadi. Dosya adini kontrol edin.',
    }
  }

  const url = apiUrl(`/music/${encodeURIComponent(fileName)}`)
  const fileResult = await playFileFocus(url)
  if (fileResult.ok) return { ok: true, source: 'file' }

  const isHttpsPage =
    typeof window !== 'undefined' && window.location.protocol.toLowerCase() === 'https:'
  const backend = apiUrl('/music')
  const isMixedContent = isHttpsPage && backend.startsWith('http://')

  return {
    ok: false,
    source: 'file',
    message: isMixedContent
      ? 'HTTPS sayfada HTTP muzik kaynagi engellenir. VITE_BACKEND_URL adresini HTTPS yapin.'
      : `Ses dosyasi acilamadi. Oynatma nedeni: ${fileResult.reason ?? directPlay.reason ?? 'bilinmiyor'}`,
  }
}
