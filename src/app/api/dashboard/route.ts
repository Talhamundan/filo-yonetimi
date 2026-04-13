import { NextResponse } from "next/server"
import { getAracUsageFilter, getSirketFilter } from "@/lib/auth-utils"
import { getDashboardData } from "@/lib/dashboard-data"
import { getSelectedAy, getSelectedYil, getSelectedKategori } from "@/lib/company-scope"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const selectedSirketId = searchParams.get("sirket")
  const rawAy = searchParams.get("ay")
  const parsedAy = Number(rawAy)
  const hasMonthSelection = Number.isInteger(parsedAy) && parsedAy >= 1 && parsedAy <= 12
  const comparisonGranularity = hasMonthSelection ? "AY" : "YIL"
  const selectedYil = await getSelectedYil({ yil: searchParams.get("yil") || undefined })
  const selectedAy = await getSelectedAy({
    ay: searchParams.get("ay") || undefined,
    yil: searchParams.get("yil") || undefined,
  })
  const selectedKategori = await getSelectedKategori({ kategori: searchParams.get("kategori") || undefined })
  
  const [sirketFilter, baseAracFilter] = await Promise.all([
    getSirketFilter(selectedSirketId),
    getAracUsageFilter(selectedSirketId),
  ])
  
  const rawAracFilter = (baseAracFilter as Record<string, unknown>) || {};
  const initialAracFilterArgs = Object.keys(rawAracFilter).length > 0 ? [rawAracFilter] : [];
  const finalAracFilterArgs = selectedKategori 
    ? [...initialAracFilterArgs, { kategori: selectedKategori }]
    : initialAracFilterArgs;
    
  const aracFilter = finalAracFilterArgs.length > 1 
    ? { AND: finalAracFilterArgs } 
    : finalAracFilterArgs.length === 1 ? finalAracFilterArgs[0] : null;

  const data = await getDashboardData(
    sirketFilter || null,
    aracFilter,
    selectedYil,
    selectedAy ?? new Date().getMonth() + 1,
    comparisonGranularity
  )
  return NextResponse.json(data)
}
