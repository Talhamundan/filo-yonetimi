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
        kullaniciAdi: { label: "Kullanıcı Adı", type: "text" },
        sifre: { label: "Şifre", type: "password" }
      },
      async authorize(credentials) {
        const creds = credentials as Record<string, unknown> | undefined
        const identifier = String(creds?.kullaniciAdi || creds?.eposta || "").trim().toLowerCase()
        const password = String(creds?.sifre || "")

        if (!identifier || !password) {
          await logActivity({
            actionType: ActivityActionType.LOGIN_FAILURE,
            entityType: ActivityEntityType.OTURUM,
            entityId: identifier || "UNKNOWN",
            summary: "Giriş denemesi başarısız: eksik kimlik bilgisi.",
            metadata: { email: identifier || null, reason: "MISSING_CREDENTIALS" },
          })
          return null
        }

        try {
          const hesap = await prisma.hesap.findUnique({
            where: { kullaniciAdi: identifier },
            select: {
              id: true,
              kullaniciAdi: true,
              sifreHash: true,
              aktifMi: true,
              personel: {
                select: {
                  id: true,
                  ad: true,
                  soyad: true,
                  eposta: true,
                  rol: true,
                  sirketId: true,
                  onayDurumu: true,
                  deletedAt: true,
                },
              },
            },
          })

          const user = hesap?.personel;
          if (!hesap || !hesap.sifreHash || !hesap.aktifMi || !user || user.deletedAt) {
              await logActivity({
                actionType: ActivityActionType.LOGIN_FAILURE,
                entityType: ActivityEntityType.OTURUM,
                entityId: identifier || "UNKNOWN",
                summary: "Giriş denemesi başarısız: kullanıcı bulunamadı.",
                metadata: { email: identifier || null, reason: "USER_NOT_FOUND" },
              })
              return null
            }

          const isValid = await bcrypt.compare(password, hesap.sifreHash)

          if (!isValid) {
            await logActivity({
              actionType: ActivityActionType.LOGIN_FAILURE,
              entityType: ActivityEntityType.OTURUM,
              entityId: user.id,
              summary: "Giriş denemesi başarısız: şifre doğrulanamadı.",
              userId: user.id,
              companyId: user.sirketId,
              metadata: { username: hesap.kullaniciAdi, reason: "INVALID_PASSWORD" },
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
            metadata: { username: hesap.kullaniciAdi },
          })
          
          return {
            id: user.id,
            name: `${user.ad} ${user.soyad}`,
            email: hesap.kullaniciAdi,
            rol: user.rol,
            sirketId: user.sirketId,
            onayDurumu: user.onayDurumu
          }
        } catch (error) {
          console.error("Authorize error:", error);
          await logActivity({
            actionType: ActivityActionType.LOGIN_FAILURE,
            entityType: ActivityEntityType.OTURUM,
            entityId: identifier || "UNKNOWN",
            summary: "Giriş denemesi sırasında sunucu hatası oluştu.",
            metadata: { email: identifier || null, reason: "AUTHORIZE_EXCEPTION" },
          })
          return null;
        }
      }
    })
  ]
})
