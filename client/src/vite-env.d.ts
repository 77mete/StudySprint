/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'html5-qrcode' {
  export class Html5Qrcode {
    constructor(elementId: string, verbose?: boolean)
    start(
      cameraConfig: { facingMode: string } | { deviceId: { exact: string } },
      config: { fps?: number; qrbox?: { width: number; height: number }; aspectRatio?: number },
      qrCodeSuccessCallback: (decodedText: string) => void,
      qrCodeErrorCallback?: (errorMessage: string) => void,
    ): Promise<void>
    stop(): Promise<void>
    clear(): void
  }
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
