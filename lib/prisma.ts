import { PrismaClient } from '@prisma/client'

const prismaClientSingleton = () => {
    // Prisma 7'de bağlantı ayarları prisma.config.ts dosyasından otomatik alınır
    return new PrismaClient()
}

declare global {
    var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma