import { NextResponse } from "next/server";
import { getAvailableYears } from "@/lib/scope-years";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const selectedSirketId = searchParams.get("sirket");
    const years = await getAvailableYears(selectedSirketId);

    return NextResponse.json({ years });
}
