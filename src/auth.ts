import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { ActivityActionType, ActivityEntityType } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { authConfig } from "./auth.config"
import { logActivity } from "@/lib/activity-log"

const trustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  process.env.NODE_ENV === "development"

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        eposta: { label: "E-Posta", type: "email" },
        sifre: { label: "Şifre", type: "password" }
      },
      async authorize(credentials) {
        const email = String(credentials?.eposta || "").trim().toLowerCase()
        if (!credentials?.eposta || !credentials?.sifre) {
          await logActivity({
            actionType: ActivityActionType.LOGIN_FAILURE,
            entityType: ActivityEntityType.OTURUM,
            entityId: email || "UNKNOWN",
            summary: "Giriş denemesi başarısız: eksik kimlik bilgisi.",
            metadata: { email: email || null, reason: "MISSING_CREDENTIALS" },
          })
          return null
        }

        try {
          const user = await prisma.kullanici.findUnique({
            where: { eposta: email },
            select: {
              id: true,
              ad: true,
              soyad: true,
              eposta: true,
              sifre: true,
              rol: true,
              sirketId: true,
              onayDurumu: true,
            },
          })

          if (!user || !user.sifre) {
            await logActivity({
              actionType: ActivityActionType.LOGIN_FAILURE,
              entityType: ActivityEntityType.OTURUM,
              entityId: email || "UNKNOWN",
              summary: "Giriş denemesi başarısız: kullanıcı bulunamadı.",
              metadata: { email: email || null, reason: "USER_NOT_FOUND" },
            })
            return null
          }

          const isValid = await bcrypt.compare(credentials.sifre as string, user.sifre)

          if (!isValid) {
            await logActivity({
              actionType: ActivityActionType.LOGIN_FAILURE,
              entityType: ActivityEntityType.OTURUM,
              entityId: user.id,
              summary: "Giriş denemesi başarısız: şifre doğrulanamadı.",
              userId: user.id,
              companyId: user.sirketId,
              metadata: { email: user.eposta, reason: "INVALID_PASSWORD" },
            })
            return null
          }

          await logActivity({
            actionType: ActivityActionType.LOGIN_SUCCESS,
            entityType: ActivityEntityType.OTURUM,
            entityId: user.id,
            summary: "Kullanıcı sisteme başarıyla giriş yaptı.",
            userId: user.id,
            companyId: user.sirketId,
            metadata: { email: user.eposta },
          })
          
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
          await logActivity({
            actionType: ActivityActionType.LOGIN_FAILURE,
            entityType: ActivityEntityType.OTURUM,
            entityId: email || "UNKNOWN",
            summary: "Giriş denemesi sırasında sunucu hatası oluştu.",
            metadata: { email: email || null, reason: "AUTHORIZE_EXCEPTION" },
          })
          return null;
        }
      }
    })
  ]
})
