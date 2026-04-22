import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole, getModelFilter } from "@/lib/auth-utils";
import { ensureSigortaTeklifTable, type SigortaTeklifDurum, type SigortaTeklifTur } from "@/lib/sigorta-teklif-schema-compat";
import { updateSigortaTeklifDurum } from "@/app/dashboard/sigortaci/actions";
import { excelDateToJSDate } from "@/lib/excel-service";

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const EXPORT_HEADERS = [
    "Teklif ID",
    "Plaka",
    "Tür",
    "Acente",
    "Sigorta Şirketi",
    "Poliçe No",
    "Başlangıç Tarihi",
    "Bitiş Tarihi",
    "Teklif Tutarı",
    "Durum",
    "Notlar",
] as const;

type SigortaTeklifRow = {
    id: string;
    aracId: string;
    tur: "KASKO" | "TRAFIK";
    acente: string | null;
    sigortaSirketi: string | null;
    policeNo: string | null;
    baslangicTarihi: Date;
    bitisTarihi: Date;
    teklifTutar: number;
    durum: "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI";
    notlar: string | null;
    updatedAt: Date;
};

function parseSelectedYil(val: string | null | undefined) {
    if (!val) return null;
    const parsed = Number(val);
    return Number.isInteger(parsed) ? parsed : null;
}

function parseSelectedAy(val: string | null | undefined): number | null {
    const normalized = val?.trim().toLowerCase();
    if (!normalized || normalized === "all" || normalized === "__all__") return null;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : null;
}

function normalizeHeaderKey(value: string) {
    return value
        .toLocaleLowerCase("tr-TR")
        .replace(/ı/g, "i")
        .replace(/ş/g, "s")
        .replace(/ğ/g, "g")
        .replace(/ü/g, "u")
        .replace(/ö/g, "o")
        .replace(/ç/g, "c")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

function getRecordValue(record: Record<string, unknown>, aliases: string[]) {
    const normalizedMap = new Map<string, unknown>();
    for (const [key, value] of Object.entries(record)) {
        normalizedMap.set(normalizeHeaderKey(key), value);
    }
    for (const alias of aliases) {
        const value = normalizedMap.get(normalizeHeaderKey(alias));
        if (value !== undefined) return value;
    }
    return null;
}

function cleanText(value: unknown) {
    const text = String(value || "").trim();
    return text || null;
}

function normalizePlate(value: unknown) {
    return String(value || "")
        .toLocaleUpperCase("tr-TR")
        .replace(/[^A-Z0-9]+/g, "");
}

function parseTeklifTur(value: unknown): SigortaTeklifTur | null {
    const normalized = normalizeHeaderKey(String(value || ""));
    if (!normalized) return null;
    if (normalized.includes("trafik")) return "TRAFIK";
    if (normalized.includes("kasko")) return "KASKO";
    return null;
}

function parseTeklifDurum(value: unknown): SigortaTeklifDurum {
    const normalized = normalizeHeaderKey(String(value || ""));
    if (!normalized) return "BEKLIYOR";
    if (normalized.includes("onay")) return "ONAYLANDI";
    if (normalized.includes("redd")) return "REDDEDILDI";
    return "BEKLIYOR";
}

function parseAmount(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    const raw = String(value || "").trim();
    if (!raw) return null;

    let normalized = raw.replace(/\s+/g, "");
    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
        const date = excelDateToJSDate(value);
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const raw = String(value || "").trim();
    if (!raw) return null;

    const trMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ T](\d{1,2}):(\d{2}))?$/);
    if (trMatch) {
        const day = Number(trMatch[1]);
        const month = Number(trMatch[2]) - 1;
        const year = Number(trMatch[3]);
        const hour = Number(trMatch[4] || 0);
        const minute = Number(trMatch[5] || 0);
        const date = new Date(year, month, day, hour, minute, 0, 0);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getNoonDate(base = new Date()) {
    const value = new Date(base);
    value.setHours(12, 0, 0, 0);
    return value;
}

function getDateRangeFromStart(start: Date) {
    const baslangic = new Date(start);
    const bitis = new Date(start);
    bitis.setFullYear(bitis.getFullYear() + 1);
    return { baslangic, bitis };
}

function inYilAyRange(value: Date, yil: number | null, ay: number | null) {
    if (!yil) return true;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    if (date.getFullYear() !== yil) return false;
    if (ay && date.getMonth() + 1 !== ay) return false;
    return true;
}

function formatDurumLabel(value: SigortaTeklifDurum) {
    if (value === "ONAYLANDI") return "Onaylandı";
    if (value === "REDDEDILDI") return "Reddedildi";
    return "Bekliyor";
}

async function resolveScopedVehicleMap(selectedSirketId: string | null) {
    const aracFilter = await getModelFilter("arac", selectedSirketId);
    const aracRows = await (prisma as any).arac.findMany({
        where: aracFilter as any,
        select: { id: true, plaka: true, marka: true, model: true },
        orderBy: { plaka: "asc" },
    });

    const vehicleById = new Map<string, { id: string; plaka: string; marka: string; model: string }>();
    const vehicleIdByPlaka = new Map<string, string>();

    for (const row of aracRows as any[]) {
        const id = String(row.id || "");
        if (!id) continue;
        const plaka = String(row.plaka || "").trim();
        const marka = String(row.marka || "").trim();
        const model = String(row.model || "").trim();
        vehicleById.set(id, { id, plaka, marka, model });
        const normalizedPlate = normalizePlate(plaka);
        if (normalizedPlate) {
            vehicleIdByPlaka.set(normalizedPlate, id);
        }
    }

    return { vehicleById, vehicleIdByPlaka };
}

export async function GET(req: NextRequest) {
    try {
        const role = await getCurrentUserRole();
        if (!role) {
            return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
        }
        if (role === "PERSONEL") {
            return NextResponse.json({ error: "Excel dışa aktarma yetkiniz bulunmuyor." }, { status: 403 });
        }

        const selectedSirketId = req.nextUrl.searchParams.get("sirket");
        const selectedYil = parseSelectedYil(req.nextUrl.searchParams.get("yil"));
        const selectedAy = parseSelectedAy(req.nextUrl.searchParams.get("ay"));

        await ensureSigortaTeklifTable();
        const { vehicleById } = await resolveScopedVehicleMap(selectedSirketId);
        const aracIdList = [...vehicleById.keys()];

        const teklifRows: SigortaTeklifRow[] = aracIdList.length
            ? await prisma.$queryRaw<SigortaTeklifRow[]>(
                  Prisma.sql`
                    SELECT
                        "id",
                        "aracId",
                        "tur",
                        "acente",
                        "sigortaSirketi",
                        "policeNo",
                        "baslangicTarihi",
                        "bitisTarihi",
                        "teklifTutar",
                        "durum",
                        "notlar",
                        "updatedAt"
                    FROM "SigortaTeklif"
                    WHERE "aracId" IN (${Prisma.join(aracIdList)})
                    ORDER BY "updatedAt" DESC
                  `
              )
            : [];

        const data = teklifRows
            .filter((row) => inYilAyRange(new Date(row.baslangicTarihi), selectedYil, selectedAy))
            .map((row) => {
                const arac = vehicleById.get(String(row.aracId));
                return {
                    "Teklif ID": row.id,
                    Plaka: arac?.plaka || "",
                    Tür: row.tur === "TRAFIK" ? "Trafik" : "Kasko",
                    Acente: row.acente || "",
                    "Sigorta Şirketi": row.sigortaSirketi || "",
                    "Poliçe No": row.policeNo || "",
                    "Başlangıç Tarihi": new Date(row.baslangicTarihi),
                    "Bitiş Tarihi": new Date(row.bitisTarihi),
                    "Teklif Tutarı": Number(row.teklifTutar || 0),
                    Durum: formatDurumLabel(row.durum),
                    Notlar: row.notlar || "",
                };
            });

        const worksheet = XLSX.utils.json_to_sheet(data, { header: [...EXPORT_HEADERS] });
        worksheet["!cols"] = [
            { wch: 28 },
            { wch: 14 },
            { wch: 10 },
            { wch: 20 },
            { wch: 24 },
            { wch: 18 },
            { wch: 20 },
            { wch: 20 },
            { wch: 14 },
            { wch: 14 },
            { wch: 30 },
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SigortaTeklif");
        const fileBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const fileName = `sigorta-teklifleri-${stamp}.xlsx`;

        return new NextResponse(fileBuffer, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${fileName}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Sigorta teklif excel export hatasi:", error);
        return NextResponse.json({ error: "Excel dışa aktarma işlemi başarısız oldu." }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const role = await getCurrentUserRole();
        if (!role) {
            return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
        }
        if (role === "PERSONEL") {
            return NextResponse.json({ error: "Excel içe aktarma yetkiniz bulunmuyor." }, { status: 403 });
        }

        const formData = await req.formData();
        const fileEntry = formData.get("file");
        if (!(fileEntry instanceof File)) {
            return NextResponse.json({ error: "Excel dosyası bulunamadı." }, { status: 400 });
        }
        if (fileEntry.size > MAX_IMPORT_FILE_BYTES) {
            return NextResponse.json({ error: "Excel dosyası çok büyük. Maksimum 10MB olmalı." }, { status: 413 });
        }

        await ensureSigortaTeklifTable();
        const selectedSirketId = req.nextUrl.searchParams.get("sirket");
        const { vehicleById, vehicleIdByPlaka } = await resolveScopedVehicleMap(selectedSirketId);
        const scopedAracIds = [...vehicleById.keys()];

        if (!scopedAracIds.length) {
            return NextResponse.json({ error: "Bu kapsamda teklif girişi yapılabilecek araç bulunamadı." }, { status: 400 });
        }

        const buffer = Buffer.from(await fileEntry.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
            return NextResponse.json({ error: "Excel dosyasında sheet bulunamadı." }, { status: 400 });
        }

        const sheet = workbook.Sheets[firstSheetName];
        const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });
        if (!records.length) {
            return NextResponse.json({ error: "Excel dosyası boş." }, { status: 400 });
        }

        let created = 0;
        let updated = 0;
        let skipped = 0;
        const errors: string[] = [];

        for (let index = 0; index < records.length; index += 1) {
            const rowNumber = index + 2;
            const record = records[index];

            const teklifIdRaw = cleanText(getRecordValue(record, ["Teklif ID", "TeklifId", "id"]));
            const aracIdRaw = cleanText(getRecordValue(record, ["Araç ID", "Arac ID", "aracId"]));
            const plakaRaw = getRecordValue(record, ["Plaka", "Araç", "Arac"]);
            const turRaw = getRecordValue(record, ["Tür", "Tur", "Teklif Türü", "Sigorta Türü"]);
            const acenteRaw = getRecordValue(record, ["Acente"]);
            const sigortaSirketiRaw = getRecordValue(record, ["Sigorta Şirketi", "Sigorta Sirketi", "Şirket", "Sirket"]);
            const policeNoRaw = getRecordValue(record, ["Poliçe No", "Police No", "Poliçe", "Police"]);
            const baslangicRaw = getRecordValue(record, ["Başlangıç Tarihi", "Baslangic Tarihi", "Başlangıç", "Baslangic"]);
            const bitisRaw = getRecordValue(record, ["Bitiş Tarihi", "Bitis Tarihi", "Bitiş", "Bitis"]);
            const tutarRaw = getRecordValue(record, ["Teklif Tutarı", "Teklif Tutari", "Tutar"]);
            const durumRaw = getRecordValue(record, ["Durum", "Teklif Durumu"]);
            const notlarRaw = getRecordValue(record, ["Notlar", "Not"]);

            const resolvedAracId = (() => {
                if (aracIdRaw && vehicleById.has(aracIdRaw)) return aracIdRaw;
                const normalizedPlate = normalizePlate(plakaRaw);
                return vehicleIdByPlaka.get(normalizedPlate) || null;
            })();

            if (!resolvedAracId) {
                skipped += 1;
                if (errors.length < 20) errors.push(`Satır ${rowNumber}: Araç bulunamadı (plaka/aracId).`);
                continue;
            }

            const tur = parseTeklifTur(turRaw) || "KASKO";
            const parsedStart = parseDateValue(baslangicRaw) || getNoonDate();
            const parsedEnd = parseDateValue(bitisRaw) || getDateRangeFromStart(parsedStart).bitis;
            if (parsedEnd <= parsedStart) {
                skipped += 1;
                if (errors.length < 20) errors.push(`Satır ${rowNumber}: Bitiş tarihi başlangıçtan sonra olmalı.`);
                continue;
            }

            const teklifTutar = parseAmount(tutarRaw);
            if (!teklifTutar || teklifTutar <= 0) {
                skipped += 1;
                if (errors.length < 20) errors.push(`Satır ${rowNumber}: Teklif tutarı 0'dan büyük olmalı.`);
                continue;
            }

            const hedefDurum = parseTeklifDurum(durumRaw);
            const acente = cleanText(acenteRaw);
            const sigortaSirketi = cleanText(sigortaSirketiRaw);
            const policeNo = cleanText(policeNoRaw);
            const notlar = cleanText(notlarRaw);

            try {
                let targetTeklifId = teklifIdRaw || randomUUID();
                if (teklifIdRaw) {
                    const existing = await prisma.$queryRaw<Array<{ id: string }>>(
                        Prisma.sql`
                            SELECT "id"
                            FROM "SigortaTeklif"
                            WHERE "id" = ${teklifIdRaw}
                              AND "aracId" IN (${Prisma.join(scopedAracIds)})
                            LIMIT 1
                        `
                    );

                    if (existing.length > 0) {
                        await prisma.$executeRaw`
                            UPDATE "SigortaTeklif"
                            SET "aracId" = ${resolvedAracId},
                                "tur" = ${tur},
                                "acente" = ${acente},
                                "sigortaSirketi" = ${sigortaSirketi},
                                "policeNo" = ${policeNo},
                                "baslangicTarihi" = ${parsedStart},
                                "bitisTarihi" = ${parsedEnd},
                                "teklifTutar" = ${teklifTutar},
                                "notlar" = ${notlar},
                                "updatedAt" = NOW()
                            WHERE "id" = ${teklifIdRaw}
                        `;
                        updated += 1;
                    } else {
                        await prisma.$executeRaw`
                            INSERT INTO "SigortaTeklif"
                                ("id", "aracId", "tur", "acente", "sigortaSirketi", "policeNo", "baslangicTarihi", "bitisTarihi", "teklifTutar", "durum", "notlar", "createdAt", "updatedAt")
                            VALUES
                                (${targetTeklifId}, ${resolvedAracId}, ${tur}, ${acente}, ${sigortaSirketi}, ${policeNo}, ${parsedStart}, ${parsedEnd}, ${teklifTutar}, ${"BEKLIYOR"}, ${notlar}, NOW(), NOW())
                        `;
                        created += 1;
                    }
                } else {
                    await prisma.$executeRaw`
                        INSERT INTO "SigortaTeklif"
                            ("id", "aracId", "tur", "acente", "sigortaSirketi", "policeNo", "baslangicTarihi", "bitisTarihi", "teklifTutar", "durum", "notlar", "createdAt", "updatedAt")
                        VALUES
                            (${targetTeklifId}, ${resolvedAracId}, ${tur}, ${acente}, ${sigortaSirketi}, ${policeNo}, ${parsedStart}, ${parsedEnd}, ${teklifTutar}, ${"BEKLIYOR"}, ${notlar}, NOW(), NOW())
                    `;
                    created += 1;
                }

                if (hedefDurum !== "BEKLIYOR") {
                    const result = await updateSigortaTeklifDurum(targetTeklifId, hedefDurum);
                    if (!result.success && errors.length < 20) {
                        errors.push(`Satır ${rowNumber}: Durum '${hedefDurum}' uygulanamadı (${result.error || "bilinmeyen hata"}).`);
                    }
                }
            } catch (error) {
                skipped += 1;
                if (errors.length < 20) {
                    const message = (error as { message?: string } | null)?.message || "Beklenmeyen hata";
                    errors.push(`Satır ${rowNumber}: ${message}`);
                }
            }
        }

        return NextResponse.json({
            success: true,
            total: records.length,
            created,
            updated,
            skipped,
            errors,
        });
    } catch (error) {
        console.error("Sigorta teklif excel import hatasi:", error);
        return NextResponse.json(
            { error: (error as { message?: string } | null)?.message || "Excel içe aktarma işlemi başarısız oldu." },
            { status: 500 }
        );
    }
}

