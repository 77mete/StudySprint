import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { RootLayout } from './components/RootLayout'
import { AuthPage } from './pages/AuthPage'
import { HomePage } from './pages/HomePage'
import { JoinPage } from './pages/JoinPage'
import { RoomPage } from './pages/RoomPage'
import { StatsPage } from './pages/StatsPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <AppErrorBoundary>
        <RootLayout />
      </AppErrorBoundary>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'join', element: <JoinPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'room/:slug', element: <RoomPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export const App = () => <RouterProvider router={router} />
