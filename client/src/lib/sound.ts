/** Bitiş uyarısı — Web Audio API (harici dosya yok) */
export const playSessionEndChime = () => {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    g.gain.value = 0.08
    o.connect(g)
    g.connect(ctx.destination)
    o.start()
    setTimeout(() => {
      o.stop()
      void ctx.close()
    }, 420)
  } catch {
    // sessiz
  }
}
