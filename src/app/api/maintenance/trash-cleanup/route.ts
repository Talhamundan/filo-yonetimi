import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { purgeExpiredSoftDeletedRecords } from "@/lib/soft-delete";

export async function POST() {
    const session = await auth();
    const user = session?.user;

    if (!user) {
        return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
    }

    if (user.rol !== "ADMIN") {
        return NextResponse.json({ error: "Sadece admin bu işlemi çalıştırabilir." }, { status: 403 });
    }

    const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await purgeExpiredSoftDeletedRecords(cutoffDate);
    return NextResponse.json({ success: true, cutoffDate, ...result });
}
