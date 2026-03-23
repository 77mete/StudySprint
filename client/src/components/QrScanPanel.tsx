import { Html5QrcodeScanner } from 'html5-qrcode'
import { useEffect, useRef } from 'react'

type Props = {
  elementId: string
  onDecoded: (text: string) => void
}

export const QrScanPanel = ({ elementId, onDecoded }: Props) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      elementId,
      { fps: 8, qrbox: { width: 220, height: 220 }, aspectRatio: 1 },
      false,
    )
    scanner.render(
      (decoded) => {
        onDecoded(decoded)
        void scanner.clear()
      },
      () => {},
    )
    scannerRef.current = scanner
    return () => {
      void scanner.clear().catch(() => {})
      scannerRef.current = null
    }
  }, [elementId, onDecoded])

  return <div id={elementId} className="w-full overflow-hidden rounded-xl border border-slate-700" />
}
