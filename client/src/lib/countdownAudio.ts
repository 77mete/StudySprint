/**
 * Geri sayım: kullanıcı etkileşimi sonrası AudioContext (tarayıcı politikası).
 * Her saniye başında tek bip (3 ve 2: güçlü; 1: ince/uzun); başlangıçta net "go" uyarısı.
 */

let ctx: AudioContext | null = null

const lastTickAt = new Map<string, number>()
const lastGoAt = { t: 0 }

const DEDUPE_MS = 450

const dedupe = (key: string): boolean => {
  const now = performance.now()
  const prev = lastTickAt.get(key) ?? 0
  if (now - prev < DEDUPE_MS) return false
  lastTickAt.set(key, now)
  if (lastTickAt.size > 32) {
    for (const k of lastTickAt.keys()) {
      if (now - (lastTickAt.get(k) ?? 0) > 10_000) lastTickAt.delete(k)
    }
  }
  return true
}

export const primeCountdownAudio = () => {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return false
    if (!ctx) {
      ctx = new Ctx()
    }
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    return true
  } catch {
    return false
  }
}

const connectOsc = (
  startTime: number,
  type: OscillatorType,
  freq: number,
  duration: number,
  peakGain: number,
  attack = 0.004,
  release = 0.04,
) => {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, startTime)
  const t0 = startTime
  const t1 = startTime + attack
  const t2 = Math.max(t1, startTime + duration - release)
  const t3 = startTime + duration
  g.gain.setValueAtTime(0, t0)
  g.gain.linearRampToValueAtTime(peakGain, t1)
  g.gain.setValueAtTime(peakGain, t2)
  g.gain.exponentialRampToValueAtTime(0.0001, t3)
  o.connect(g)
  g.connect(ctx.destination)
  o.start(t0)
  o.stop(t3 + 0.02)
}

/** 3 ve 2: yarış start tarzı kalın/güçlü kısa bip */
export const playCountdownStrongTick = (gen: number, step: 3 | 2) => {
  if (!dedupe(`s-${gen}-${step}`)) return
  if (!ctx || ctx.state === 'suspended') primeCountdownAudio()
  if (!ctx) return
  const t0 = ctx.currentTime
  connectOsc(t0, 'square', 520, 0.11, 0.38, 0.002, 0.028)
  connectOsc(t0, 'square', 780, 0.09, 0.12, 0.002, 0.025)
}

/** 1: daha ince, biraz daha uzun final tik */
export const playCountdownFinalTick = (gen: number) => {
  if (!dedupe(`f-${gen}`)) return
  if (!ctx || ctx.state === 'suspended') primeCountdownAudio()
  if (!ctx) return
  const t0 = ctx.currentTime
  connectOsc(t0, 'sine', 980, 0.28, 0.22, 0.006, 0.07)
  connectOsc(t0, 'triangle', 1320, 0.22, 0.08, 0.01, 0.06)
}

/** Geri sayım bitti — seans başlıyor: net, duyulabilir uyarı */
export const playCountdownGo = () => {
  const now = performance.now()
  if (now - lastGoAt.t < 600) return
  lastGoAt.t = now
  if (!ctx || ctx.state === 'suspended') primeCountdownAudio()
  if (!ctx) return
  const t0 = ctx.currentTime
  connectOsc(t0, 'square', 440, 0.14, 0.32, 0.002, 0.03)
  connectOsc(t0 + 0.07, 'square', 554, 0.14, 0.3, 0.002, 0.03)
  connectOsc(t0 + 0.14, 'square', 659, 0.2, 0.34, 0.002, 0.045)
  connectOsc(t0 + 0.12, 'sine', 880, 0.35, 0.2, 0.01, 0.1)
}
