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

let audio: HTMLAudioElement | null = null

const stop = () => {
  if (!audio) return
  try {
    audio.pause()
    audio.currentTime = 0
    audio.src = ''
  } catch {
    // yoksay
  }
  audio = null
}

export const setFocusMode = async (mode: FocusMode) => {
  stop()
  if (mode === 'off') return

  const { fileName } = TRACKS[mode]
  const url = apiUrl(`/music/${encodeURIComponent(fileName)}`)

  const a = new Audio(url)
  a.loop = true
  a.preload = 'auto'
  a.volume = 0.35

  audio = a

  try {
    a.currentTime = 0
    await a.play()
  } catch {
    // Tarayıcı autoplay kısıtları uygulayabilir.
  }
}
