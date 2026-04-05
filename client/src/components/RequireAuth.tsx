import { Navigate, useLocation } from 'react-router-dom'
import { useAuthToken } from '../hooks/useAuthToken'

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation()
  const token = useAuthToken()
  if (!token) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />
  }
  return children
}
