/// <reference types="vite/client" />

declare module 'html5-qrcode' {
  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: { fps: number; qrbox?: { width: number; height: number }; aspectRatio?: number },
      verbose: boolean,
    )
    render(
      qrCodeSuccessCallback: (decodedText: string) => void,
      qrCodeErrorCallback: (errorMessage: string) => void,
    ): void
    clear(): Promise<void>
  }
}
