import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

type GlobalWithPrisma = typeof globalThis & {
    __prismaClient?: PrismaClient;
    __prismaPool?: Pool;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

function createPrismaClient() {
    const pool = globalForPrisma.__prismaPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.__prismaPool = pool;
    }

    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.__prismaClient = prisma;
}

export default prisma;
