import bcrypt from 'bcryptjs'

const ROUNDS = 10

export const validatePasswordStrength = (plain: string): string | null => {
  if (plain.length < 8) {
    return 'Şifre en az 8 karakter olmalı.'
  }
  if (!/[A-Z]/.test(plain)) {
    return 'Şifre en az bir büyük harf içermeli.'
  }
  if (!/[0-9]/.test(plain)) {
    return 'Şifre en az bir rakam içermeli.'
  }
  if (!/[^A-Za-z0-9]/.test(plain)) {
    return 'Şifre en az bir özel karakter içermeli (örn. . ! + @ #).'
  }
  return null
}

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const DIGITS = '23456789'
const SPECIAL = '.!+@#$%&*-_'

export const generateTempPassword = (): string => {
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)]!
  const parts: string[] = [pick(UPPER), pick(DIGITS), pick(SPECIAL)]
  const pool = UPPER + LOWER + DIGITS + SPECIAL
  for (let i = 0; i < 9; i++) parts.push(pick(pool))
  for (let i = parts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[parts[i], parts[j]] = [parts[j]!, parts[i]!]
  }
  return parts.join('')
}

export const hashPassword = async (plain: string) => bcrypt.hash(plain, ROUNDS)

export const verifyPassword = async (plain: string, hash: string) =>
  bcrypt.compare(plain, hash)
