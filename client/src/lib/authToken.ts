const KEY = 'studysprint_auth_token'

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
  } catch {
    // yoksay
  }
}
