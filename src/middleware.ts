import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const userRole = (req.auth?.user as any)?.rol
  const isAuthPage = nextUrl.pathname.startsWith("/auth")
  const isDashboardPage = nextUrl.pathname.startsWith("/dashboard")

  // 1. Giriş yapmamış kullanıcı dashboard'a girmek isterse login'e at
  if (isDashboardPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl))
  }

  // 2. Onaylanmamış kullanıcı (ADMIN değilse) dashboard'a girerse bekleme sayfasına at
  if (isLoggedIn && isDashboardPage && (req.auth?.user as any)?.onayDurumu !== "ONAYLANDI" && userRole !== "ADMIN") {
      if (nextUrl.pathname !== "/dashboard/bekleme") {
        return NextResponse.redirect(new URL("/dashboard/bekleme", nextUrl))
      }
  }

  // 3. Rol Bazlı Erişim Kontrolü (RBAC)
  if (isLoggedIn && isDashboardPage) {
    // Şoför kısıtlamaları
    if (userRole === "SOFOR") {
        const restrictedPaths = [
            "/dashboard/personel",
            "/dashboard/onay-merkezi",
            "/dashboard/sirketler",
            "/dashboard/finans"
        ];
        
        if (restrictedPaths.some(path => nextUrl.pathname.startsWith(path))) {
            return NextResponse.redirect(new URL("/dashboard", nextUrl));
        }
    }
  }

  // 4. Giriş yapmış kullanıcı auth sayfalarına (login/register) girmek isterse dashboard'a at
  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
