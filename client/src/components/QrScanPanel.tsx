import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'

type Props = {
  elementId: string
  onDecoded: (text: string) => void
}

export const QrScanPanel = ({ elementId, onDecoded }: Props) => {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const onDecodedRef = useRef(onDecoded)
  const [scanning, setScanning] = useState(false)
  const [hint, setHint] = useState('QR okumayi baslatin.')

  useEffect(() => {
    onDecodedRef.current = onDecoded
  }, [onDecoded])

  const handleStartScan = async () => {
    if (scanning) return
    try {
      const scanner = new Html5Qrcode(elementId, false)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 12, qrbox: { width: 230, height: 230 }, aspectRatio: 1 },
        async (decodedText) => {
          setHint('Kod algilandi.')
          onDecodedRef.current(decodedText)
          if (scannerRef.current) {
            try {
              await scannerRef.current.stop()
              scannerRef.current.clear()
            } catch {
              // yoksay
            }
            scannerRef.current = null
          }
          setScanning(false)
        },
        () => {
          setHint('QR kod bekleniyor...')
        },
      )
      setScanning(true)
      setHint('Kamera acildi. QR kodu kadraja getirin.')
    } catch {
      setHint('Kamera baslatilamadi. Tarayici iznini ve HTTPS baglantisini kontrol edin.')
      setScanning(false)
    }
  }

  const handleStopScan = async () => {
    if (!scannerRef.current) return
    try {
      await scannerRef.current.stop()
      scannerRef.current.clear()
    } catch {
      // yoksay
    }
    scannerRef.current = null
    setScanning(false)
    setHint('Tarama durduruldu.')
  }

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        void scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear()
            scannerRef.current = null
          })
          .catch(() => {
            scannerRef.current = null
          })
      }
    }
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span
          className="inline-flex size-5 items-center justify-center rounded-full bg-cyan-400/20 text-cyan-300"
          aria-hidden="true"
        >
          ◉
        </span>
        QR okuyucu
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/70 p-4 shadow-lg">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-cyan-300/60 bg-cyan-300/5"
          aria-hidden="true"
        />
        <div id={elementId} className="mx-auto min-h-56 w-full overflow-hidden rounded-xl bg-slate-950/60" />
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleStartScan()}
          disabled={scanning}
          className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
        >
          Taramayi baslat
        </button>
        <button
          type="button"
          onClick={() => void handleStopScan()}
          disabled={!scanning}
          className="rounded-xl border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-700 disabled:opacity-50"
        >
          Taramayi durdur
        </button>
      </div>
      <p className="text-center text-xs text-slate-400" aria-live="polite">
        {hint}
      </p>
    </div>
  )
}
