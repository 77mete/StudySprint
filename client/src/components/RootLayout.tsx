import { Outlet } from 'react-router-dom'
import { AppFooter } from './AppFooter'

export const RootLayout = () => {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
      <AppFooter />
    </div>
  )
}
