import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuthToken } from '../hooks/useAuthToken'
import { useTheme } from '../context/ThemeContext'
import { setAuthToken } from '../lib/authToken'

const goalsHref = (token: string | null) =>
  token ? '/?goals=1' : '/auth?reason=goals'

export const AppHeader = () => {
  const token = useAuthToken()
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const onAuth = location.pathname === '/auth'

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-950/90">
      <div className="mx-auto grid max-w-5xl grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-3 sm:px-6">
        <div className="hidden min-w-0 items-center gap-2 sm:flex">
          <Link
            to="/stats"
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-brand-200 dark:hover:bg-slate-800"
          >
            İstatistiklerim
          </Link>
          <Link
            to={goalsHref(token)}
            className="rounded-xl border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 transition hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
          >
            Günlük hedef belirle
          </Link>
        </div>

        <div className="flex justify-center sm:contents">
          <Link
            to="/"
            className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400"
          >
            StudySprint
          </Link>
        </div>

        <div className="hidden items-center justify-end gap-2 sm:flex">
          <button
            type="button"
            onClick={() => toggleTheme()}
            className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={theme === 'dark' ? 'Açık tema' : 'Koyu tema'}
          >
            {theme === 'dark' ? 'Açık mod' : 'Koyu mod'}
          </button>
          {token ? (
            <button
              type="button"
              onClick={() => {
                setAuthToken(null)
                if (location.pathname.startsWith('/stats')) {
                  window.location.href = '/'
                }
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Çıkış
            </button>
          ) : (
            <Link
              to="/auth"
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-900/20 transition hover:bg-brand-500"
            >
              Giriş / Kayıt
            </Link>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 sm:hidden">
          <button
            type="button"
            onClick={() => toggleTheme()}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-300"
            aria-label="Tema"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            Menü
          </button>
        </div>
      </div>

      {menuOpen && (
        <div
          id="mobile-nav"
          className="border-t border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-950 sm:hidden"
        >
          <div className="mx-auto flex max-w-md flex-col gap-2">
            {!token && (
              <Link
                to="/auth"
                className="rounded-xl bg-brand-600 py-3 text-center text-sm font-semibold text-white"
                onClick={() => setMenuOpen(false)}
              >
                Giriş yap / Kayıt ol
              </Link>
            )}
            {token && (
              <button
                type="button"
                onClick={() => {
                  setAuthToken(null)
                  setMenuOpen(false)
                  window.location.href = '/'
                }}
                className="rounded-xl border border-slate-300 py-3 text-sm font-medium text-slate-800 dark:border-slate-700 dark:text-slate-200"
              >
                Çıkış yap
              </button>
            )}
            <Link
              to="/stats"
              className="rounded-xl border border-slate-300 py-3 text-center text-sm font-medium dark:border-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              İstatistiklerim
            </Link>
            <Link
              to={goalsHref(token)}
              className="rounded-xl border border-amber-500/50 bg-amber-50 py-3 text-center text-sm font-medium text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
              onClick={() => setMenuOpen(false)}
            >
              Günlük hedef belirle
            </Link>
            <Link
              to="/join"
              className="rounded-xl border border-slate-300 py-3 text-center text-sm dark:border-slate-700"
              onClick={() => setMenuOpen(false)}
            >
              Odaya katıl
            </Link>
            {!onAuth && (
              <Link
                to="/auth"
                className="rounded-xl border border-slate-300 py-3 text-center text-sm dark:border-slate-700"
                onClick={() => setMenuOpen(false)}
              >
                Hesap
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
