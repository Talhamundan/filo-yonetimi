import type { NextAuthConfig } from "next-auth"
import type { JWT } from "next-auth/jwt"

export const authConfig = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [], // Bu alan auth.ts içerisinde doldurulacak
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const typedUser = user as { rol: string; sirketId: string | null; onayDurumu: string }
        token.rol = typedUser.rol
        token.sirketId = typedUser.sirketId
        token.onayDurumu = typedUser.onayDurumu
      }
      return token
    },
    async session({ session, token }) {
      const typedToken = token as JWT & { rol?: string; sirketId?: string | null; onayDurumu?: string }
      if (token) {
        session.user.id = token.sub || ""
        session.user.rol = typedToken.rol || "SOFOR"
        session.user.sirketId = typedToken.sirketId || null
        session.user.onayDurumu = typedToken.onayDurumu || "BEKLIYOR"
      }
      return session
    }
  },
} satisfies NextAuthConfig
