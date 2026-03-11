import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        eposta: { label: "E-Posta", type: "email" },
        sifre: { label: "Şifre", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.eposta || !credentials?.sifre) return null

        try {
          const user = await (prisma as any).kullanici.findUnique({
            where: { eposta: credentials.eposta as string },
            include: { sirket: true }
          })

          if (!user || !user.sifre) return null

          const isValid = await bcrypt.compare(credentials.sifre as string, user.sifre)

          if (!isValid) return null
          
          return {
            id: user.id,
            name: `${user.ad} ${user.soyad}`,
            email: user.eposta,
            rol: user.rol,
            sirketId: user.sirketId,
            onayDurumu: user.onayDurumu
          }
        } catch (error) {
          console.error("Authorize error:", error);
          return null;
        }
      }
    })
  ]
})
