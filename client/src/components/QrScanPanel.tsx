import { Html5QrcodeScanner } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'

type Props = {
  elementId: string
  onDecoded: (text: string) => void
}

export const QrScanPanel = ({ elementId, onDecoded }: Props) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const onDecodedRef = useRef(onDecoded)
  const [hint, setHint] = useState('Tarama yapılıyor…')

  useEffect(() => {
    onDecodedRef.current = onDecoded
  }, [onDecoded])

  useEffect(() => {
    const tr = (s: string) =>
      s
        .replace('Request Camera Permissions', 'Kamera izni iste')
        .replace('Request Permission', 'Izin iste')
        .replace('Start Scanning', 'Taramayi baslat')
        .replace('Stop Scanning', 'Taramayi durdur')
        .replace('Stop Camera', 'Kamerayi durdur')
        .replace('Scan an Image File', 'Resim dosyasindan tara')
        .replace('Choose Image', 'Resim sec')
        .replace('No camera found', 'Kamera bulunamadi')
        .replace('Camera streaming has started', 'Kamera acildi')

    const applyTurkish = () => {
      const root = document.getElementById(elementId)
      if (!root) return
      const nodes = root.querySelectorAll('button, span, label, a, option, div')
      nodes.forEach((n) => {
        if (!n.textContent) return
        const next = tr(n.textContent)
        if (next !== n.textContent) n.textContent = next
      })
    }

    const scanner = new Html5QrcodeScanner(
      elementId,
      // Daha hızlı tarama için fps ve kutu boyutu optimize edildi.
      { fps: 16, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
      false,
    )
    scanner.render(
      (decoded) => {
        setHint('Kod algılandı!')
        onDecodedRef.current(decoded)
        void scanner.clear()
      },
      () => {
        setHint('Tarama yapılıyor…')
      },
    )
    const localizeTimer = window.setInterval(applyTurkish, 500)
    scannerRef.current = scanner
    return () => {
      window.clearInterval(localizeTimer)
      void scanner.clear().catch(() => {})
      scannerRef.current = null
    }
  }, [elementId])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
        <span
          className="inline-flex size-5 items-center justify-center rounded-full bg-brand-500/20 text-brand-300"
          aria-hidden="true"
        >
          QR
        </span>
        Kamera ile kod okut
      </div>
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-brand-400/60 bg-brand-400/5"
          aria-hidden="true"
        />
        <div id={elementId} className="mx-auto w-full overflow-hidden rounded-xl" />
      </div>
      <p className="text-center text-xs text-slate-400" aria-live="polite">
        {hint}
      </p>
    </div>
  )
}
