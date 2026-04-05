import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

type Props = { children: ReactNode }

type State = { hasError: boolean; message: string }

export class AppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(err: unknown): State {
    const message =
      err instanceof Error ? err.message : typeof err === 'string' ? err : 'Bilinmeyen hata'
    return { hasError: true, message }
  }

  componentDidCatch(err: unknown, info: ErrorInfo) {
    console.error('AppErrorBoundary', err, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-full flex-col items-center justify-center bg-slate-950 px-4 py-16 text-center">
          <p className="text-lg font-semibold text-amber-200">Bir şeyler ters gitti</p>
          <p className="mt-2 max-w-md text-sm text-slate-400">{this.state.message}</p>
          <Link
            to="/"
            className="mt-6 inline-flex rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Ana sayfaya dön
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}
