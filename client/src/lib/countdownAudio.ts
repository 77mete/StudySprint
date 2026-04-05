/**
 * Geri sayım: kullanıcı etkileşimi sonrası AudioContext açılır (tarayıcı politikası).
 * Web Audio ile tek dizide 3 kısa bip (bip-bip-bip); tekrar/loop yok.
 */

let ctx: AudioContext | null = null

export const primeCountdownAudio = () => {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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

const playBeep = (startTime: number, freq: number, duration: number, gain: number) => {
  if (!ctx) return
  const o = ctx.createOscillator()
  const g = ctx.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.value = gain
  o.connect(g)
  g.connect(ctx.destination)
  o.start(startTime)
  o.stop(startTime + duration)
}

/** Tek sefer: 3 kısa bip */
export const playCountdownBurst = () => {
  if (!ctx || ctx.state === 'suspended') {
    primeCountdownAudio()
  }
  if (!ctx) return
  const t0 = ctx.currentTime
  const baseGain = 0.42
  const f = 1040
  const short = 0.065
  const gap = 0.07
  for (let i = 0; i < 3; i++) {
    const s = t0 + i * (short + gap)
    playBeep(s, f, short, baseGain)
  }
}
