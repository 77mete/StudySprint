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

const stop = async () => {
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

const playFileFocus = async (url: string): Promise<boolean> => {
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
    if (p && typeof (p as Promise<void>).catch === 'function') {
      await p
    }
    return true
  } catch {
    return false
  }
}

const tryPlayCandidates = async (mode: Exclude<FocusMode, 'off'>) => {
  const candidates = TRACK_FILE_CANDIDATES[mode]
  for (const fileName of candidates) {
    const ok = await playFileFocus(apiUrl(`/music/${encodeURIComponent(fileName)}`))
    if (ok) return true
    await stop()
  }
  return false
}

export const setFocusMode = async (mode: FocusMode): Promise<FocusSetResult> => {
  await stop()
  if (mode === 'off') return { ok: true, source: 'off' }

  const directPlay = await tryPlayCandidates(mode)
  if (directPlay) return { ok: true, source: 'file' }

  const fileName = await resolveTrackFileName(mode)
  if (!fileName) {
    return {
      ok: false,
      source: 'file',
      message: 'music klasorunde ilgili ses dosyasi bulunamadi. Dosya adini kontrol edin.',
    }
  }

  const url = apiUrl(`/music/${encodeURIComponent(fileName)}`)
  const fileOk = await playFileFocus(url)
  if (fileOk) return { ok: true, source: 'file' }

  return {
    ok: false,
    source: 'file',
    message: 'Ses dosyasi acilamadi. Dosya yolu veya tarayici ses iznini kontrol edin.',
  }
}
