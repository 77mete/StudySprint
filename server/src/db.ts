import { PrismaClient } from '@prisma/client'

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
