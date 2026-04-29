import { DefaultSession } from "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      rol: string
      sirketId: string | null
      yetkiliSirketIds: string[]
      onayDurumu: string
    } & DefaultSession["user"]
  }

  interface User {
    rol: string
    sirketId: string | null
    yetkiliSirketIds?: string[]
    onayDurumu: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    rol: string
    sirketId: string | null
    yetkiliSirketIds?: string[]
    onayDurumu: string
  }
}
