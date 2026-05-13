import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { basename } from "path";
import { getScopedRecordOrThrow } from "@/lib/action-scope";
import { resolveStoredDocumentPath } from "@/lib/document-storage";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const dokuman = await getScopedRecordOrThrow({
            prismaModel: "dokuman",
            filterModel: "dokuman",
            id,
            select: {
                id: true,
                ad: true,
                originalName: true,
                fileName: true,
                mimeType: true,
                path: true,
                deletedAt: true,
            },
            errorMessage: "Doküman bulunamadı veya yetkiniz yok.",
        }) as {
            ad?: string | null;
            originalName?: string | null;
            fileName?: string | null;
            mimeType?: string | null;
            path?: string | null;
            deletedAt?: Date | null;
        };

        if (dokuman.deletedAt) {
            return NextResponse.json({ error: "Doküman silinmiş." }, { status: 404 });
        }

        const absolutePath = resolveStoredDocumentPath(dokuman.path);
        if (!absolutePath) {
            return NextResponse.json({ error: "Dosya yolu bulunamadı." }, { status: 404 });
        }

        const buffer = await readFile(absolutePath);
        const download = request.nextUrl.searchParams.get("download") === "1";
        const displayName = dokuman.originalName || dokuman.fileName || basename(absolutePath);
        const dispositionType = download ? "attachment" : "inline";

        return new NextResponse(buffer, {
            headers: {
                "Content-Type": dokuman.mimeType || "application/octet-stream",
                "Content-Length": String(buffer.byteLength),
                "Content-Disposition": `${dispositionType}; filename*=UTF-8''${encodeURIComponent(displayName)}`,
                "Cache-Control": "private, max-age=0, must-revalidate",
            },
        });
    } catch (error) {
        console.error("Doküman dosyası okunamadı:", error);
        return NextResponse.json({ error: "Dosya görüntülenemedi." }, { status: 404 });
    }
}
