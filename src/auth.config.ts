import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  providers: [], // Bu alan auth.ts içerisinde doldurulacak
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        token.rol = user.rol
        token.sirketId = user.sirketId
        token.onayDurumu = user.onayDurumu
      }
      return token
    },
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.sub
        session.user.rol = token.rol
        session.user.sirketId = token.sirketId
        session.user.onayDurumu = token.onayDurumu
      }
      return session
    }
  },
} satisfies NextAuthConfig
