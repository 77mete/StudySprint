/** Yumuşak, düşük sesli ortam — odak için sakinleştirici tonlar (harici dosya yok) */

export type FocusMode = 'off' | 'white' | 'lofi' | 'nature'

let ctx: AudioContext | null = null
let nodes: AudioNode[] = []

const stopNodes = () => {
  for (const n of nodes) {
    try {
      if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
        ;(n as OscillatorNode).stop()
      }
      n.disconnect()
    } catch {
      // yoksay
    }
  }
  nodes = []
}

const ensureCtx = () => {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

/** Pembe gürültüye yakın — çok düşük frekans, yumuşak filtre */
const createPinkishNoise = (c: AudioContext) => {
  const bufferSize = 4 * c.sampleRate
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  for (let i = 0; i < bufferSize; i += 1) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = white * 0.5362 + b4 * 0.115926
    data[i] = b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362
    data[i] *= 0.11
  }
  const noise = c.createBufferSource()
  noise.buffer = buffer
  noise.loop = true
  const low = c.createBiquadFilter()
  low.type = 'lowpass'
  low.frequency.value = 420
  low.Q.value = 0.7
  const high = c.createBiquadFilter()
  high.type = 'highpass'
  high.frequency.value = 90
  const gain = c.createGain()
  gain.gain.value = 0.022
  noise.connect(high)
  high.connect(low)
  low.connect(gain)
  gain.connect(c.destination)
  noise.start()
  nodes.push(noise, high, low, gain)
}

/** Yumuşak ambient pad — düşük sinüsler, yavaşçasına yükselen ses */
const createAmbientPad = (c: AudioContext) => {
  const freqs = [130.81, 164.81, 196.0]
  for (const f of freqs) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f
    const g = c.createGain()
    g.gain.value = 0
    const now = c.currentTime
    g.gain.linearRampToValueAtTime(0.014, now + 2.2)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    nodes.push(o, g)
  }
}

/** Hafif rüzgar / nefes — çok düşük bandlı gürültü */
const createCalmAir = (c: AudioContext) => {
  const bufferSize = 5 * c.sampleRate
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i += 1) {
    data[i] = (Math.random() * 2 - 1) * 0.12
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const f1 = c.createBiquadFilter()
  f1.type = 'lowpass'
  f1.frequency.value = 280
  const f2 = c.createBiquadFilter()
  f2.type = 'peaking'
  f2.frequency.value = 400
  f2.gain.value = -2
  const g = c.createGain()
  g.gain.value = 0.028
  src.connect(f1)
  f1.connect(f2)
  f2.connect(g)
  g.connect(c.destination)
  src.start()
  nodes.push(src, f1, f2, g)
}

export const setFocusMode = async (mode: FocusMode) => {
  stopNodes()
  if (mode === 'off') {
    await ctx?.close()
    ctx = null
    return
  }
  const c = ensureCtx()
  if (c.state === 'suspended') {
    await c.resume()
  }
  if (mode === 'white') createPinkishNoise(c)
  if (mode === 'lofi') createAmbientPad(c)
  if (mode === 'nature') createCalmAir(c)
}
