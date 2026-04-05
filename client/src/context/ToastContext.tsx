import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react'

export type ToastKind = 'success' | 'error' | 'info'

export type ToastItem = {
  id: number
  message: string
  kind: ToastKind
}

const ToastContext = createContext<{
  toasts: ToastItem[]
  pushToast: (message: string, kind?: ToastKind) => void
  dismiss: (id: number) => void
} | null>(null)

let idSeq = 0

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((xs) => xs.filter((t) => t.id !== id))
  }, [])

  const pushToast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = ++idSeq
      setToasts((xs) => [...xs, { id, message, kind }])
      window.setTimeout(() => {
        dismiss(id)
      }, 4200)
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({ toasts, pushToast, dismiss }),
    [toasts, pushToast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur transition-opacity duration-300 dark:shadow-black/40 ${
              t.kind === 'success'
                ? 'border-emerald-500/50 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/90 dark:text-emerald-50'
                : t.kind === 'error'
                  ? 'border-red-500/50 bg-red-50 text-red-950 dark:border-red-500/40 dark:bg-red-950/90 dark:text-red-50'
                  : 'border-slate-300 bg-white text-slate-800 dark:border-slate-600 dark:bg-slate-900/95 dark:text-slate-100'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}
