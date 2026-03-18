import { NextResponse } from "next/server"
import { getSirketFilter } from "@/lib/auth-utils"
import { getDashboardData } from "@/lib/dashboard-data"
import { getSelectedAy, getSelectedYil } from "@/lib/company-scope"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const selectedSirketId = searchParams.get("sirket")
  const rawAy = searchParams.get("ay")
  const comparisonGranularity = rawAy ? "AY" : "YIL"
  const selectedYil = await getSelectedYil({ yil: searchParams.get("yil") || undefined })
  const selectedAy = await getSelectedAy({ ay: searchParams.get("ay") || undefined })
  const sirketFilter = await getSirketFilter(selectedSirketId)
  const data = await getDashboardData(sirketFilter || null, selectedYil, selectedAy, comparisonGranularity)
  return NextResponse.json(data)
}
