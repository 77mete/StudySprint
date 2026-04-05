const KEY = 'studysprint_auth_token'

const listeners = new Set<() => void>()

export const subscribeAuth = (fn: () => void) => {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

const notifyAuth = () => {
  listeners.forEach((fn) => {
    try {
      fn()
    } catch {
      // yoksay
    }
  })
}

export const getAuthToken = (): string | null => {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const setAuthToken = (token: string | null) => {
  try {
    if (token) localStorage.setItem(KEY, token)
    else localStorage.removeItem(KEY)
    notifyAuth()
  } catch {
    // yoksay
  }
}
