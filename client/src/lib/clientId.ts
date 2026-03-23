import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 20)

const KEY = 'studysprint_client_id'

export const getOrCreateClientId = (): string => {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = nanoid()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    return nanoid()
  }
}
