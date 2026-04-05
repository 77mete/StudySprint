import { SignJWT, jwtVerify } from 'jose'

const getSecret = () => {
  const s = process.env.JWT_SECRET
  if (s && s.length >= 16) return new TextEncoder().encode(s)
  return new TextEncoder().encode('dev-studysprint-secret-change-me')
}

export const signUserToken = async (userId: string, email: string) => {
  return new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getSecret())
}

export const verifyUserToken = async (
  token: string,
): Promise<{ sub: string; email: string } | null> => {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    const sub = typeof payload.sub === 'string' ? payload.sub : ''
    const email = typeof payload.email === 'string' ? payload.email : ''
    if (!sub) return null
    return { sub, email }
  } catch {
    return null
  }
}
