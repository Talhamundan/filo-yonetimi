import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import { isAdminRole, isDashboardPathRestrictedForRole, shouldForceWaitingPage } from "@/lib/policy"

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const authUser = req.auth?.user as { rol?: string; onayDurumu?: string } | undefined
  const userRole = authUser?.rol
  const userOnayDurumu = authUser?.onayDurumu
  const isAuthPage = nextUrl.pathname.startsWith("/auth")
  const isDashboardPage = nextUrl.pathname.startsWith("/dashboard")
  const isCompanyManagementPage = nextUrl.pathname.startsWith("/dashboard/sirketler")

  if (isDashboardPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/auth/login", nextUrl))
  }

  if (isLoggedIn && isDashboardPage && shouldForceWaitingPage(userRole, userOnayDurumu)) {
    if (nextUrl.pathname !== "/dashboard/bekleme") {
      return NextResponse.redirect(new URL("/dashboard/bekleme", nextUrl))
    }
  }

  if (isLoggedIn && isDashboardPage && isDashboardPathRestrictedForRole(userRole, nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  if (isLoggedIn && isCompanyManagementPage && !isAdminRole(userRole)) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
