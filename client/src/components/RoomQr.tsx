import { QRCodeSVG } from 'qrcode.react'

type Props = {
  url: string
  size?: number
}

export const RoomQr = ({ url, size = 80 }: Props) => {
  return (
    <div className="inline-block rounded-lg bg-white p-1.5 shadow-md" title="Odaya katılmak için QR okutun">
      <QRCodeSVG value={url} size={size} level="M" includeMargin={false} />
    </div>
  )
}
