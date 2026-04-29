import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth-utils";
import { applyExcelWorksheetFormats } from "@/lib/excel-worksheet-format";
import * as XLSX from "xlsx";
import { 
    exportEntity, 
    importEntity, 
    MAX_IMPORT_FILE_BYTES,
    ensureBakimColumns,
    ensureCezaFineTrackingColumns
} from "@/lib/excel-service";
import { EXCEL_ENTITY_CONFIG, ExcelEntityKey } from "@/lib/excel-entities";

// Import hiyerarşisi: İlişkilerin bozulmaması için bu sıra ile import edilmeli.
const BULK_IMPORT_ORDER: ExcelEntityKey[] = [
    "sirket",
    "disFirma",
    "taseronFirma",
    "kiralikFirma",
    "personel",
    "arac",
    "zimmet",
    "yakit",
    "bakim",
    "muayene",
    "kasko",
    "trafikSigortasi",
    "ariza",
    "masraf",
    "ceza",
    "dokuman",
    "stokKalem",
];

// Export edilecek tüm entity'ler (tekrarlı dış kapsam entity'leri dahil edilmez)
const ALL_ENTITIES: ExcelEntityKey[] = [
    "sirket",
    "personel",
    "arac",
    "taseronFirma",
    "kiralikFirma",
    "zimmet",
    "yakit",
    "bakim",
    "muayene",
    "kasko",
    "trafikSigortasi",
    "ariza",
    "masraf",
    "ceza",
    "dokuman",
    "stokKalem",
];

export async function GET() {
    try {
        const role = await getCurrentUserRole();
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Bu işlem için sadece admin yetkisi gerekir." }, { status: 403 });
        }

        const workbook = XLSX.utils.book_new();

        for (const entityKey of ALL_ENTITIES) {
            try {
                const { data, sheetName, headers } = await exportEntity(entityKey);
                // Sheet'i her durumda ekle (boş olsa bile headers ile kalsın)
                const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
                applyExcelWorksheetFormats(worksheet, { entityKey, headers });
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            } catch (err) {
                console.error(`!!!! [BULK EXPORT ERROR] Entity: ${entityKey} !!!!`, err);
                // Hata olsa bile boş bir sheet ekleyerek workbook yapısını korumaya çalışabiliriz
                // Ama şimdilik sadece loglayalım ve devam edelim.
            }
        }

        const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const fileName = `filo-yonetimi-full-backup-${stamp}.xlsx`;

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Bulk export hatasi:", error);
        return NextResponse.json({ error: "Toplu veri yedekleme islemi basarisiz oldu." }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const role = await getCurrentUserRole();
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Bu işlem için sadece admin yetkisi gerekir." }, { status: 403 });
        }

        const formData = await req.formData();
        const fileEntry = formData.get("file");
        if (!(fileEntry instanceof File)) {
            return NextResponse.json({ error: "Excel dosyasi bulunamadi." }, { status: 400 });
        }
        if (fileEntry.size > MAX_IMPORT_FILE_BYTES * 5) { // Bulk için 50MB limit
            return NextResponse.json({ error: "Excel dosyasi cok buyuk. Maksimum dosya boyutu 50MB." }, { status: 413 });
        }

        const buffer = Buffer.from(await fileEntry.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
        
        // Şema uyumluluğunu en başta kontrol et (Eski versiyonlarda eksik kolonlar olabilir)
        await ensureBakimColumns();
        await ensureCezaFineTrackingColumns();

        const results: Record<string, any> = {};

        // Transaction içinde tüm import'ları yapıyoruz.
        await prisma.$transaction(async (tx) => {
            for (const entityKey of BULK_IMPORT_ORDER) {
                const config = EXCEL_ENTITY_CONFIG[entityKey];
                const sheetName = config.sheetName;
                const sheet = workbook.Sheets[sheetName];
                
                if (!sheet) {
                    console.log(`Sheet "${sheetName}" bulunamadi, ${entityKey} importu atlaniyor.`);
                    continue;
                }

                const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
                    defval: null,
                    raw: true,
                });

                if (records.length > 0) {
                    results[entityKey] = await importEntity(entityKey, records, tx);
                }
            }
        }, {
            maxWait: 30000,
            timeout: 300000 // Toplu işlem dosyalarında relation çözümü ve upsertler uzun sürebilir.
        });

        return NextResponse.json({
            success: true,
            results
        });
    } catch (error) {
        console.error("Bulk import hatasi:", error);
        return NextResponse.json(
            { error: (error as Error)?.message || "Toplu veri geri yukleme islemi basarisiz oldu." },
            { status: 500 }
        );
    }
}
