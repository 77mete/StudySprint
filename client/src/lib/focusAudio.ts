import { apiUrl } from './apiBase'

/**
 * Odak müzikleri: Sadece `music/` klasöründeki parçalar.
 * Her seçimde çalan mp3, `loop=true` olacak şekilde tekrar eder.
 */
export type FocusMode = 'off' | 'mozart40' | 'odak' | 'gnossienne1' | 'beyazGurultu'

const TRACKS: Record<Exclude<FocusMode, 'off'>, { fileName: string }> = {
  mozart40: { fileName: 'Mozart 40. Senfoni.mp3' },
  odak: { fileName: 'Odaklanma ve Konsantrasyon Arttırıcı.mp3' },
  gnossienne1: { fileName: 'Gnossienne No.1.mp3' },
  beyazGurultu: { fileName: 'Beyaz Gürültü.mp3' },
}

type FocusSetResult = {
  ok: boolean
  source: 'off' | 'file' | 'fallback'
  message?: string
}

let audio: HTMLAudioElement | null = null
let audioCtx: AudioContext | null = null
let fallbackCleanup: (() => void) | null = null

const closeFallback = async () => {
  if (fallbackCleanup) {
    fallbackCleanup()
    fallbackCleanup = null
  }
  if (audioCtx) {
    try {
      await audioCtx.close()
    } catch {
      // yoksay
    }
    audioCtx = null
  }
}

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
  await closeFallback()
}

const createNoiseBuffer = (ctx: AudioContext, seconds: number, brown = false) => {
  const sampleRate = ctx.sampleRate
  const frameCount = Math.max(1, Math.floor(sampleRate * seconds))
  const buffer = ctx.createBuffer(1, frameCount, sampleRate)
  const data = buffer.getChannelData(0)
  let lastOut = 0
  for (let i = 0; i < frameCount; i += 1) {
    const white = Math.random() * 2 - 1
    if (brown) {
      lastOut = (lastOut + 0.02 * white) / 1.02
      data[i] = lastOut * 3.5
    } else {
      data[i] = white * 0.45
    }
  }
  return buffer
}

const startFallbackFocus = async (mode: Exclude<FocusMode, 'off'>) => {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return false

  const ctx = new Ctx()
  audioCtx = ctx
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume()
    } catch {
      // yoksay
    }
  }

  const master = ctx.createGain()
  master.gain.value = mode === 'beyazGurultu' ? 0.18 : 0.12
  master.connect(ctx.destination)

  if (mode === 'beyazGurultu' || mode === 'odak') {
    const source = ctx.createBufferSource()
    source.buffer = createNoiseBuffer(ctx, 3, mode === 'odak')
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = mode === 'odak' ? 'lowpass' : 'highshelf'
    filter.frequency.value = mode === 'odak' ? 800 : 1200
    filter.gain.value = mode === 'odak' ? 0 : -4
    source.connect(filter)
    filter.connect(master)
    source.start()
    fallbackCleanup = () => source.stop()
    return true
  }

  const baseFreq = mode === 'mozart40' ? 261.63 : 293.66
  const o1 = ctx.createOscillator()
  const o2 = ctx.createOscillator()
  const g1 = ctx.createGain()
  const g2 = ctx.createGain()
  const slowLfo = ctx.createOscillator()
  const slowGain = ctx.createGain()

  o1.type = 'sine'
  o2.type = 'triangle'
  o1.frequency.value = baseFreq
  o2.frequency.value = baseFreq * 1.5
  g1.gain.value = 0.05
  g2.gain.value = 0.03
  slowLfo.frequency.value = 0.07
  slowGain.gain.value = 8

  slowLfo.connect(slowGain)
  slowGain.connect(o1.frequency)

  o1.connect(g1)
  o2.connect(g2)
  g1.connect(master)
  g2.connect(master)

  o1.start()
  o2.start()
  slowLfo.start()

  fallbackCleanup = () => {
    o1.stop()
    o2.stop()
    slowLfo.stop()
  }
  return true
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

export const setFocusMode = async (mode: FocusMode): Promise<FocusSetResult> => {
  await stop()
  if (mode === 'off') return { ok: true, source: 'off' }

  const { fileName } = TRACKS[mode]
  const url = apiUrl(`/music/${encodeURIComponent(fileName)}`)
  const fileOk = await playFileFocus(url)
  if (fileOk) return { ok: true, source: 'file' }

  // Dosya/route yoksa veya oynatma başarısızsa Web Audio fallback ile devam et.
  audio = null
  const fallbackOk = await startFallbackFocus(mode)
  if (fallbackOk) {
    return {
      ok: true,
      source: 'fallback',
      message: 'Yerel ses dosyası bulunamadı, sentetik odak sesi kullanılıyor.',
    }
  }
  return {
    ok: false,
    source: 'fallback',
    message: 'Odak sesi başlatılamadı. Tarayıcı ses iznini kontrol edin.',
  }
}
