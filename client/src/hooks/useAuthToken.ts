import { useSyncExternalStore } from 'react'
import { getAuthToken, subscribeAuth } from '../lib/authToken'

export const useAuthToken = () =>
  useSyncExternalStore(subscribeAuth, getAuthToken, () => null)
