import { NextResponse } from "next/server"
import { getSirketFilter } from "@/lib/auth-utils"
import { getDashboardData } from "@/lib/dashboard-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const selectedSirketId = searchParams.get("sirket")
  const sirketFilter = await getSirketFilter(selectedSirketId)
  const data = await getDashboardData(sirketFilter || null)
  return NextResponse.json(data)
}
