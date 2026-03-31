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
    const scanner = new Html5QrcodeScanner(
      elementId,
      // Daha hızlı tarama için fps ve kutu boyutu optimize edildi.
      { fps: 16, qrbox: { width: 200, height: 200 }, aspectRatio: 1 },
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
    scannerRef.current = scanner
    return () => {
      void scanner.clear().catch(() => {})
      scannerRef.current = null
    }
  }, [elementId])

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-xl border border-slate-700 bg-slate-900/30 p-3">
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-brand-400/60"
          aria-hidden="true"
        />
        <div id={elementId} className="mx-auto w-full max-w-xs overflow-hidden rounded-lg" />
      </div>
      <p className="text-center text-xs text-slate-400">{hint}</p>
    </div>
  )
}
