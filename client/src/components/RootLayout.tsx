import { Outlet } from 'react-router-dom'
import { ThemeProvider } from '../context/ThemeContext'
import { ToastProvider } from '../context/ToastContext'
import { AppFooter } from './AppFooter'
import { AppHeader } from './AppHeader'

export const RootLayout = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <div className="flex min-h-full flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
          <AppHeader />
          <div className="flex-1">
            <Outlet />
          </div>
          <AppFooter />
        </div>
      </ToastProvider>
    </ThemeProvider>
  )
}
