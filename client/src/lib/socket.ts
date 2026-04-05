import { io, type Socket } from 'socket.io-client'
import { getBackendOrigin } from './apiBase'

let socket: Socket | null = null
let boundOrigin: string | null = null

export const getSocket = (): Socket => {
  const origin = getBackendOrigin()
  const target = origin || (typeof window !== 'undefined' ? window.location.origin : '')

  if (!socket || boundOrigin !== target) {
    socket?.removeAllListeners()
    socket?.disconnect()
    socket = io(origin || undefined, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 800,
    })
    boundOrigin = target
  } else if (socket.disconnected) {
    socket.connect()
  }
  return socket
}
