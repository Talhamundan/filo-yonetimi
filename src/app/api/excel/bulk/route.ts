import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserRole } from "@/lib/auth-utils";
import { applyExcelWorksheetFormats } from "@/lib/excel-worksheet-format";
import { Prisma } from "@prisma/client";
import * as XLSX from "xlsx";
import {
    exportEntity,
    importEntity,
    MAX_IMPORT_FILE_BYTES,
    ensureBakimColumns,
    ensureCezaFineTrackingColumns
} from "@/lib/excel-service";
import { EXCEL_ENTITY_CONFIG, ExcelEntityKey } from "@/lib/excel-entities";

const YAKIT_TANK_HAS_SIRKET_FIELD = Boolean(
    (prisma as any)?._runtimeDataModel?.models?.YakitTank?.fields?.some((field: any) => field?.name === "sirketId") ||
    Prisma.dmmf.datamodel.models
        .find((model) => model.name === "YakitTank")
        ?.fields.some((field) => field.name === "sirketId")
);

// Import hiyerarşisi: İlişkilerin bozulmaması için bu sıra ile import edilmeli.
const BULK_IMPORT_ORDER: ExcelEntityKey[] = [
    "sirket",
    "disFirma",
    "taseronFirma",
    "kiralikFirma",
    "personel",
    "taseronPersonel",
    "kiralikPersonel",
    "arac",
    "taseronArac",
    "kiralikArac",
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

// Export edilecek tüm entity'ler. Normal / taşeron / kiralık sheetleri filtreli ve birbirini tekrar etmeyecek şekilde yazılır.
const ALL_ENTITIES: ExcelEntityKey[] = [
    "sirket",
    "disFirma",
    "taseronFirma",
    "kiralikFirma",
    "personel",
    "taseronPersonel",
    "kiralikPersonel",
    "arac",
    "taseronArac",
    "kiralikArac",
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

const CUSTOM_SHEETS = {
    hesap: "GirisYetkileri",
    yakitTank: "YakitTank",
    yakitTankHareket: "YakitTankHareket",
    hgsYukleme: "HgsYukleme",
    activityLog: "ActivityLog",
} as const;

const CUSTOM_HEADERS = {
    hesap: [
        "id",
        "personelId",
        "personelTcNo",
        "personelAdSoyad",
        "kullaniciAdi",
        "sifreHash",
        "aktifMi",
        "sonGirisTarihi",
        "olusturmaTarihi",
        "guncellemeTarihi",
    ],
    yakitTank: [
        "id",
        "ad",
        "sirketId",
        "sirketAdi",
        "kapasiteLitre",
        "mevcutLitre",
        "birimMaliyet",
        "aktifMi",
        "olusturmaTarihi",
        "guncellemeTarihi",
    ],
    yakitTankHareket: [
        "id",
        "tip",
        "tarih",
        "litre",
        "birimMaliyet",
        "toplamTutar",
        "tankId",
        "tankAdi",
        "hedefTankId",
        "hedefTankAdi",
        "aracId",
        "aracPlaka",
        "yakitId",
        "istasyon",
        "km",
        "aciklama",
        "olusturmaTarihi",
        "endeks",
        "soforId",
        "soforAdSoyad",
    ],
    hgsYukleme: [
        "id",
        "tarih",
        "etiketNo",
        "tutar",
        "aracId",
        "aracPlaka",
        "sirketId",
        "sirketAdi",
        "km",
        "saseNo",
    ],
    activityLog: [
        "id",
        "actionType",
        "entityType",
        "entityId",
        "summary",
        "metadata",
        "userId",
        "companyId",
        "createdAt",
    ],
} as const;

function getBulkExportWhere(entityKey: ExcelEntityKey) {
    if (entityKey === "arac") return { disFirmaId: null };
    if (entityKey === "personel") return { disFirmaId: null };
    if (entityKey === "taseronArac" || entityKey === "taseronPersonel") {
        return { disFirma: { tur: "TASERON" } };
    }
    if (entityKey === "kiralikArac" || entityKey === "kiralikPersonel") {
        return { disFirma: { tur: "KIRALIK" } };
    }
    if (entityKey === "taseronFirma") return { tur: "TASERON" };
    if (entityKey === "kiralikFirma") return { tur: "KIRALIK" };
    return undefined;
}

function toBool(value: unknown) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    if (typeof value !== "string") return Boolean(value);
    const normalized = value.trim().toLocaleLowerCase("tr-TR");
    return ["true", "1", "evet", "aktif", "yes"].includes(normalized);
}

function toNullableDate(value: unknown) {
    if (!value) return null;
    if (value instanceof Date) return value;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function toOptionalNumber(value: unknown) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(String(value).replace(",", "."));
    return Number.isFinite(number) ? number : null;
}

function normalizeText(value: unknown) {
    return typeof value === "string" ? value.trim() : value === null || value === undefined ? "" : String(value).trim();
}

function splitAdSoyad(value: unknown) {
    const text = normalizeText(value);
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    return {
        ad: parts[0],
        soyad: parts.slice(1).join(" "),
    };
}

async function appendCustomBackupSheets(workbook: XLSX.WorkBook) {
    const [hesaplar, yakitTanklar, tankHareketleri, hgsYuklemeler, activityLogs] = await Promise.all([
        prisma.hesap.findMany({
            orderBy: { olusturmaTarihi: "asc" },
            include: {
                personel: {
                    select: {
                        id: true,
                        ad: true,
                        soyad: true,
                        tcNo: true,
                    },
                },
            },
        }),
        (prisma as any).yakitTank.findMany({
            orderBy: { olusturmaTarihi: "asc" },
            include: {
                sirket: { select: { id: true, ad: true } },
            },
        }),
        (prisma as any).yakitTankHareket.findMany({
            orderBy: { olusturmaTarihi: "asc" },
            include: {
                tank: { select: { id: true, ad: true } },
                hedefTank: { select: { id: true, ad: true } },
                arac: { select: { id: true, plaka: true } },
                sofor: { select: { id: true, ad: true, soyad: true } },
            },
        }),
        prisma.hgsYukleme.findMany({
            orderBy: { tarih: "asc" },
            include: {
                arac: { select: { id: true, plaka: true } },
            },
        }),
        prisma.activityLog.findMany({
            orderBy: { createdAt: "asc" },
        }),
    ]);

    const hesapRows = hesaplar.map((row) => ({
        id: row.id,
        personelId: row.personelId,
        personelTcNo: row.personel?.tcNo || null,
        personelAdSoyad: `${row.personel?.ad || ""} ${row.personel?.soyad || ""}`.trim(),
        kullaniciAdi: row.kullaniciAdi,
        sifreHash: row.sifreHash,
        aktifMi: row.aktifMi,
        sonGirisTarihi: row.sonGirisTarihi,
        olusturmaTarihi: row.olusturmaTarihi,
        guncellemeTarihi: row.guncellemeTarihi,
    }));
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(hesapRows, { header: [...CUSTOM_HEADERS.hesap] }),
        CUSTOM_SHEETS.hesap
    );

    const tankRows = (yakitTanklar as any[]).map((row) => ({
        id: row.id,
        ad: row.ad,
        sirketId: row.sirketId || null,
        sirketAdi: row.sirket?.ad || null,
        kapasiteLitre: row.kapasiteLitre,
        mevcutLitre: row.mevcutLitre,
        birimMaliyet: row.birimMaliyet,
        aktifMi: row.aktifMi,
        olusturmaTarihi: row.olusturmaTarihi,
        guncellemeTarihi: row.guncellemeTarihi,
    }));
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(tankRows, { header: [...CUSTOM_HEADERS.yakitTank] }),
        CUSTOM_SHEETS.yakitTank
    );

    const hareketRows = (tankHareketleri as any[]).map((row) => ({
        id: row.id,
        tip: row.tip,
        tarih: row.tarih,
        litre: row.litre,
        birimMaliyet: row.birimMaliyet,
        toplamTutar: row.toplamTutar,
        tankId: row.tankId,
        tankAdi: row.tank?.ad || null,
        hedefTankId: row.hedefTankId || null,
        hedefTankAdi: row.hedefTank?.ad || null,
        aracId: row.aracId || null,
        aracPlaka: row.arac?.plaka || null,
        yakitId: row.yakitId || null,
        istasyon: row.istasyon || null,
        km: row.km,
        aciklama: row.aciklama || null,
        olusturmaTarihi: row.olusturmaTarihi,
        endeks: row.endeks,
        soforId: row.soforId || null,
        soforAdSoyad: `${row.sofor?.ad || ""} ${row.sofor?.soyad || ""}`.trim() || null,
    }));
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(hareketRows, { header: [...CUSTOM_HEADERS.yakitTankHareket] }),
        CUSTOM_SHEETS.yakitTankHareket
    );

    const hgsRows = hgsYuklemeler.map((row) => ({
        id: row.id,
        tarih: row.tarih,
        etiketNo: row.etiketNo || null,
        tutar: row.tutar,
        aracId: row.aracId,
        aracPlaka: row.arac?.plaka || null,
        sirketId: row.sirketId || null,
        sirketAdi: null,
        km: row.km,
        saseNo: row.saseNo || null,
    }));
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(hgsRows, { header: [...CUSTOM_HEADERS.hgsYukleme] }),
        CUSTOM_SHEETS.hgsYukleme
    );

    const activityRows = activityLogs.map((row) => ({
        id: row.id,
        actionType: row.actionType,
        entityType: row.entityType,
        entityId: row.entityId,
        summary: row.summary,
        metadata: row.metadata ? JSON.stringify(row.metadata) : null,
        userId: row.userId || null,
        companyId: row.companyId || null,
        createdAt: row.createdAt,
    }));
    XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(activityRows, { header: [...CUSTOM_HEADERS.activityLog] }),
        CUSTOM_SHEETS.activityLog
    );
}

async function findSirketId(tx: any, id: unknown, ad: unknown) {
    const normalizedId = normalizeText(id);
    if (normalizedId) {
        const found = await tx.sirket.findUnique({ where: { id: normalizedId }, select: { id: true } });
        if (found) return found.id;
    }
    const name = normalizeText(ad);
    if (!name) return null;
    const found = await tx.sirket.findFirst({
        where: { ad: { equals: name, mode: "insensitive" } },
        select: { id: true },
    });
    return found?.id || null;
}

async function findPersonelId(tx: any, row: Record<string, unknown>) {
    const id = normalizeText(row.personelId || row.soforId);
    if (id) {
        const found = await tx.kullanici.findUnique({ where: { id }, select: { id: true } });
        if (found) return found.id;
    }
    const tcNo = normalizeText(row.personelTcNo);
    if (tcNo) {
        const found = await tx.kullanici.findUnique({ where: { tcNo }, select: { id: true } });
        if (found) return found.id;
    }
    const adSoyad = splitAdSoyad(row.personelAdSoyad || row.soforAdSoyad);
    if (!adSoyad) return null;
    const found = await tx.kullanici.findFirst({
        where: {
            ad: { equals: adSoyad.ad, mode: "insensitive" },
            soyad: { equals: adSoyad.soyad, mode: "insensitive" },
            deletedAt: null,
        },
        select: { id: true },
    });
    return found?.id || null;
}

async function findTankId(tx: any, id: unknown, ad: unknown) {
    const normalizedId = normalizeText(id);
    if (normalizedId) {
        const found = await (tx as any).yakitTank.findUnique({ where: { id: normalizedId }, select: { id: true } });
        if (found) return found.id;
    }
    const name = normalizeText(ad);
    if (!name) return null;
    const found = await (tx as any).yakitTank.findFirst({
        where: { ad: { equals: name, mode: "insensitive" } },
        select: { id: true },
    });
    return found?.id || null;
}

async function findAracId(tx: any, id: unknown, plaka: unknown) {
    const normalizedId = normalizeText(id);
    if (normalizedId) {
        const found = await tx.arac.findUnique({ where: { id: normalizedId }, select: { id: true } });
        if (found) return found.id;
    }
    const normalizedPlaka = normalizeText(plaka).replace(/[^0-9a-zA-ZğüşiöçıİĞÜŞÖÇ]/g, "").toLocaleUpperCase("tr-TR");
    if (!normalizedPlaka) return null;
    const found = await tx.arac.findFirst({ where: { plaka: normalizedPlaka }, select: { id: true } });
    return found?.id || null;
}

async function importHesapRows(tx: any, records: Array<Record<string, unknown>>) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of records) {
        const personelId = await findPersonelId(tx, row);
        const kullaniciAdi = normalizeText(row.kullaniciAdi).toLocaleLowerCase("tr-TR");
        const sifreHash = normalizeText(row.sifreHash);
        if (!personelId || !kullaniciAdi || !sifreHash) {
            skipped++;
            continue;
        }

        const data = {
            personelId,
            kullaniciAdi,
            sifreHash,
            aktifMi: toBool(row.aktifMi ?? true),
            sonGirisTarihi: toNullableDate(row.sonGirisTarihi),
        };
        const existing = await tx.hesap.findFirst({
            where: { OR: [{ personelId }, { kullaniciAdi }] },
            select: { id: true },
        });
        if (existing) {
            await tx.hesap.update({ where: { id: existing.id }, data });
            updated++;
        } else {
            await tx.hesap.create({ data: { id: normalizeText(row.id) || undefined, ...data } });
            created++;
        }
    }

    return { created, updated, skipped, total: records.length };
}

async function importYakitTankRows(tx: any, records: Array<Record<string, unknown>>) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of records) {
        const ad = normalizeText(row.ad);
        const kapasiteLitre = toOptionalNumber(row.kapasiteLitre);
        if (!ad || kapasiteLitre === null) {
            skipped++;
            continue;
        }
        const sirketId = YAKIT_TANK_HAS_SIRKET_FIELD ? await findSirketId(tx, row.sirketId, row.sirketAdi) : null;
        const data = {
            ad,
            kapasiteLitre,
            mevcutLitre: toOptionalNumber(row.mevcutLitre) ?? 0,
            birimMaliyet: toOptionalNumber(row.birimMaliyet) ?? 0,
            aktifMi: toBool(row.aktifMi ?? true),
            ...(YAKIT_TANK_HAS_SIRKET_FIELD ? { sirketId } : {}),
        };
        const id = normalizeText(row.id);
        const existing = id
            ? await (tx as any).yakitTank.findUnique({ where: { id }, select: { id: true } })
            : await (tx as any).yakitTank.findFirst({ where: { ad }, select: { id: true } });
        if (existing) {
            await (tx as any).yakitTank.update({ where: { id: existing.id }, data });
            updated++;
        } else {
            await (tx as any).yakitTank.create({ data: { id: id || undefined, ...data } });
            created++;
        }
    }

    return { created, updated, skipped, total: records.length };
}

async function importYakitTankHareketRows(tx: any, records: Array<Record<string, unknown>>) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of records) {
        const tankId = await findTankId(tx, row.tankId, row.tankAdi);
        const tip = normalizeText(row.tip);
        const litre = toOptionalNumber(row.litre);
        if (!tankId || !tip || litre === null) {
            skipped++;
            continue;
        }
        const hedefTankId = await findTankId(tx, row.hedefTankId, row.hedefTankAdi);
        const aracPlaka = normalizeText(row.aracPlaka);
        const arac = aracPlaka
            ? await tx.arac.findFirst({ where: { plaka: aracPlaka }, select: { id: true } })
            : null;
        const soforId = await findPersonelId(tx, row);
        const data = {
            tip,
            tarih: toNullableDate(row.tarih) || new Date(),
            litre,
            birimMaliyet: toOptionalNumber(row.birimMaliyet) ?? 0,
            toplamTutar: toOptionalNumber(row.toplamTutar) ?? 0,
            tankId,
            hedefTankId,
            aracId: arac?.id || null,
            istasyon: normalizeText(row.istasyon) || null,
            km: toOptionalNumber(row.km),
            aciklama: normalizeText(row.aciklama) || null,
            endeks: toOptionalNumber(row.endeks),
            soforId,
        };
        const id = normalizeText(row.id);
        const existing = id
            ? await (tx as any).yakitTankHareket.findUnique({ where: { id }, select: { id: true } })
            : null;
        if (existing) {
            await (tx as any).yakitTankHareket.update({ where: { id: existing.id }, data });
            updated++;
        } else {
            await (tx as any).yakitTankHareket.create({ data: { id: id || undefined, ...data } });
            created++;
        }
    }

    return { created, updated, skipped, total: records.length };
}

async function importHgsYuklemeRows(tx: any, records: Array<Record<string, unknown>>) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of records) {
        const aracId = await findAracId(tx, row.aracId, row.aracPlaka);
        const tutar = toOptionalNumber(row.tutar);
        if (!aracId || tutar === null) {
            skipped++;
            continue;
        }
        const data = {
            tarih: toNullableDate(row.tarih) || new Date(),
            etiketNo: normalizeText(row.etiketNo) || null,
            tutar,
            aracId,
            sirketId: await findSirketId(tx, row.sirketId, row.sirketAdi),
            km: toOptionalNumber(row.km),
            saseNo: normalizeText(row.saseNo) || null,
        };
        const id = normalizeText(row.id);
        const existing = id
            ? await tx.hgsYukleme.findUnique({ where: { id }, select: { id: true } })
            : null;
        if (existing) {
            await tx.hgsYukleme.update({ where: { id: existing.id }, data });
            updated++;
        } else {
            await tx.hgsYukleme.create({ data: { id: id || undefined, ...data } });
            created++;
        }
    }

    return { created, updated, skipped, total: records.length };
}

async function importActivityLogRows(tx: any, records: Array<Record<string, unknown>>) {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const row of records) {
        const id = normalizeText(row.id);
        const actionType = normalizeText(row.actionType);
        const entityType = normalizeText(row.entityType);
        const entityId = normalizeText(row.entityId);
        const summary = normalizeText(row.summary);
        if (!id || !actionType || !entityType || !entityId || !summary) {
            skipped++;
            continue;
        }
        let metadata: unknown = null;
        const metadataText = normalizeText(row.metadata);
        if (metadataText) {
            try {
                metadata = JSON.parse(metadataText);
            } catch {
                metadata = metadataText;
            }
        }
        const data = {
            actionType,
            entityType,
            entityId,
            summary,
            metadata,
            userId: normalizeText(row.userId) || null,
            companyId: normalizeText(row.companyId) || null,
            createdAt: toNullableDate(row.createdAt) || new Date(),
        };
        const existing = await tx.activityLog.findUnique({ where: { id }, select: { id: true } });
        if (existing) {
            await tx.activityLog.update({ where: { id }, data });
            updated++;
        } else {
            await tx.activityLog.create({ data: { id, ...data } });
            created++;
        }
    }

    return { created, updated, skipped, total: records.length };
}

function readSheet(workbook: XLSX.WorkBook, sheetName: string) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: null,
        raw: true,
    });
}

export async function GET() {
    try {
        const role = await getCurrentUserRole();
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Bu işlem için sadece admin yetkisi gerekir." }, { status: 403 });
        }

        const workbook = XLSX.utils.book_new();

        for (const entityKey of ALL_ENTITIES) {
            try {
                const { data, sheetName, headers } = await exportEntity(entityKey, getBulkExportWhere(entityKey) as any);
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
        await appendCustomBackupSheets(workbook);

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
            const hesapRows = readSheet(workbook, CUSTOM_SHEETS.hesap);
            if (hesapRows.length > 0) {
                results.hesap = await importHesapRows(tx, hesapRows);
            }
            const tankRows = readSheet(workbook, CUSTOM_SHEETS.yakitTank);
            if (tankRows.length > 0) {
                results.yakitTank = await importYakitTankRows(tx, tankRows);
            }
            const tankHareketRows = readSheet(workbook, CUSTOM_SHEETS.yakitTankHareket);
            if (tankHareketRows.length > 0) {
                results.yakitTankHareket = await importYakitTankHareketRows(tx, tankHareketRows);
            }
            const hgsRows = readSheet(workbook, CUSTOM_SHEETS.hgsYukleme);
            if (hgsRows.length > 0) {
                results.hgsYukleme = await importHgsYuklemeRows(tx, hgsRows);
            }
            const activityRows = readSheet(workbook, CUSTOM_SHEETS.activityLog);
            if (activityRows.length > 0) {
                results.activityLog = await importActivityLogRows(tx, activityRows);
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

export async function DELETE(req: NextRequest) {
    try {
        const role = await getCurrentUserRole();
        if (role !== "ADMIN") {
            return NextResponse.json({ error: "Bu işlem için sadece admin yetkisi gerekir." }, { status: 403 });
        }

        const payload = await req.json().catch(() => null);
        if (payload?.confirm !== "TUM_VERILERI_SIL") {
            return NextResponse.json({ error: "Silme onayı geçersiz." }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            const deleted: Record<string, number> = {};
            const run = async (key: string, action: Promise<{ count: number }>) => {
                const response = await action;
                deleted[key] = response.count;
            };

            await run("activityLog", tx.activityLog.deleteMany({}));
            await run("yakitTankHareket", (tx as any).yakitTankHareket.deleteMany({}));
            await run("yakit", tx.yakit.deleteMany({}));
            await run("hgsYukleme", tx.hgsYukleme.deleteMany({}));
            await run("dokuman", tx.dokuman.deleteMany({}));
            await run("kasko", tx.kasko.deleteMany({}));
            await run("trafikSigortasi", tx.trafikSigortasi.deleteMany({}));
            await run("muayene", tx.muayene.deleteMany({}));
            await run("masraf", tx.masraf.deleteMany({}));
            await run("ceza", tx.ceza.deleteMany({}));
            await run("arizaKaydi", tx.arizaKaydi.deleteMany({}));
            await run("bakim", tx.bakim.deleteMany({}));
            await run("kullaniciZimmet", tx.kullaniciZimmet.deleteMany({}));
            await run("arac", tx.arac.deleteMany({}));
            await run("hesap", tx.hesap.deleteMany({}));
            await run("kullanici", tx.kullanici.deleteMany({}));
            await run("stokKalem", tx.stokKalem.deleteMany({}));
            await run("yakitTank", (tx as any).yakitTank.deleteMany({}));
            await run("disFirma", tx.disFirma.deleteMany({}));
            await run("sirket", tx.sirket.deleteMany({}));

            return deleted;
        }, {
            maxWait: 30000,
            timeout: 300000,
        });

        return NextResponse.json({ success: true, deleted: result });
    } catch (error) {
        console.error("Bulk delete all hatasi:", error);
        return NextResponse.json(
            { error: (error as Error)?.message || "Tüm veri silme işlemi başarısız oldu." },
            { status: 500 }
        );
    }
}
