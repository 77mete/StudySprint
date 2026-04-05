import { PrismaClient } from '@prisma/client'

/**
 * Supabase / yönetilen Postgres: eksik parametreleri tamamlar.
 * - Transaction pooler (genelde :6543) → Prisma için `pgbouncer=true` gerekir.
 * - TLS: `sslmode=require` (parametre yoksa ve bilinen bulut host’larında).
 */
const patchDatabaseUrl = () => {
  let raw = process.env.DATABASE_URL?.trim()
  if (!raw) return

  const isSupabase =
    raw.includes('supabase.co') || raw.includes('pooler.supabase.com')
  const isCloudHost =
    isSupabase ||
    raw.includes('neon.tech') ||
    raw.includes('amazonaws.com')

  if (isSupabase && raw.includes(':6543') && !/pgbouncer=true/.test(raw)) {
    raw = `${raw}${raw.includes('?') ? '&' : '?'}pgbouncer=true`
  }

  if (isCloudHost && !/sslmode=/.test(raw)) {
    raw = `${raw}${raw.includes('?') ? '&' : '?'}sslmode=require`
  }

  process.env.DATABASE_URL = raw
}

patchDatabaseUrl()

let prisma: PrismaClient | null = null

export const getPrisma = (): PrismaClient => {
  if (!prisma) {
    prisma = new PrismaClient()
  }
  return prisma
}

export const checkDatabase = async (): Promise<boolean> => {
  try {
    await getPrisma().$queryRaw`SELECT 1`
    return true
  } catch {
    return false
  }
}
