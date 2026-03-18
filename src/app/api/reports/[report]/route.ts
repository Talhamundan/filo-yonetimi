import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUserRole, getModelFilter } from "@/lib/auth-utils";
import { buildSimplePdf, formatCurrency } from "@/lib/simple-pdf";

const REPORT_NAMES = [
    "penalties",
    "maintenance",
    "document-expirations",
    "vehicle-expenses",
    "monthly-cost-summary",
] as const;

type ReportName = (typeof REPORT_NAMES)[number];

type ReportResponse = {
    title: string;
    rows: Record<string, string | number | null>[];
    pdfLines: string[];
};

function isReportName(value: string): value is ReportName {
    return REPORT_NAMES.includes(value as ReportName);
}

function parseDate(value: string | null, fallback: Date) {
    if (!value) return fallback;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date;
}

function parseDateRange(searchParams: URLSearchParams) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const yil = Number(searchParams.get("yil"));
    const year = Number.isInteger(yil) && yil >= 2000 && yil <= 2100 ? yil : currentYear;

    const defaultFrom = new Date(year, 0, 1, 0, 0, 0, 0);
    const defaultTo = new Date(year, 11, 31, 23, 59, 59, 999);

    const from = parseDate(searchParams.get("from"), defaultFrom);
    const to = parseDate(searchParams.get("to"), defaultTo);

    if (from.getTime() > to.getTime()) {
        throw new Error("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    }

    return { from, to };
}

function createExcelBuffer(title: string, rows: Record<string, string | number | null>[], extraInfo: Record<string, string>) {
    const workbook = XLSX.utils.book_new();
    const dataSheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, dataSheet, "Rapor");

    const infoRows = Object.entries(extraInfo).map(([key, value]) => ({ Alan: key, Deger: value }));
    infoRows.unshift({ Alan: "Rapor", Deger: title });
    const infoSheet = XLSX.utils.json_to_sheet(infoRows);
    XLSX.utils.book_append_sheet(workbook, infoSheet, "Bilgi");

    return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

function formatDate(date: Date) {
    return date.toLocaleDateString("tr-TR");
}

function getReportFileName(report: ReportName, format: "xlsx" | "pdf") {
    const date = new Date();
    const stamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return `${report}-${stamp}.${format}`;
}

function getExpirationStatus(daysLeft: number) {
    if (daysLeft < 0) return "GECIKTI";
    if (daysLeft <= 15) return "KRITIK";
    if (daysLeft <= 30) return "YAKLASTI";
    return "GECERLI";
}

async function getPenaltiesReport(params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
    q: string;
}): Promise<ReportResponse> {
    const cezaFilter = await getModelFilter("ceza", params.selectedSirketId);
    const where: Prisma.CezaWhereInput = {
        AND: [
            cezaFilter as Prisma.CezaWhereInput,
            { tarih: { gte: params.from, lte: params.to } },
            params.q
                ? {
                      OR: [
                          { arac: { plaka: { contains: params.q, mode: "insensitive" } } },
                          { cezaMaddesi: { contains: params.q, mode: "insensitive" } },
                      ],
                  }
                : {},
        ],
    };

    const cezalar = await prisma.ceza.findMany({
        where,
        orderBy: { tarih: "desc" },
        select: {
            id: true,
            tarih: true,
            cezaMaddesi: true,
            tutar: true,
            odendiMi: true,
            sonOdemeTarihi: true,
            arac: { select: { plaka: true, sirket: { select: { ad: true } } } },
        },
    });

    const rows = cezalar.map((row) => ({
        Tarih: formatDate(row.tarih),
        Plaka: row.arac?.plaka || "-",
        Sirket: row.arac?.sirket?.ad || "-",
        Madde: row.cezaMaddesi,
        Tutar: Number(row.tutar.toFixed(2)),
        Durum: row.odendiMi ? "ÖDENDİ" : "ÖDENMEDİ",
        SonOdeme: row.sonOdemeTarihi ? formatDate(row.sonOdemeTarihi) : "-",
    }));

    const total = cezalar.reduce((sum, row) => sum + row.tutar, 0);
    return {
        title: "Ceza Raporu",
        rows,
        pdfLines: [
            `Toplam kayıt: ${rows.length}`,
            `Toplam tutar: ${formatCurrency(total)}`,
            ...rows.slice(0, 25).map((row) => `${row.Tarih} | ${row.Plaka} | ${row.Madde} | ${formatCurrency(Number(row.Tutar || 0))}`),
        ],
    };
}

async function getMaintenanceReport(params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
    q: string;
}): Promise<ReportResponse> {
    const bakimFilter = await getModelFilter("bakim", params.selectedSirketId);
    const where: Prisma.BakimWhereInput = {
        AND: [
            bakimFilter as Prisma.BakimWhereInput,
            { bakimTarihi: { gte: params.from, lte: params.to } },
            params.q
                ? {
                      OR: [
                          { arac: { plaka: { contains: params.q, mode: "insensitive" } } },
                          { servisAdi: { contains: params.q, mode: "insensitive" } },
                      ],
                  }
                : {},
        ],
    };

    const bakimlar = await prisma.bakim.findMany({
        where,
        orderBy: { bakimTarihi: "desc" },
        select: {
            id: true,
            bakimTarihi: true,
            kategori: true,
            tur: true,
            servisAdi: true,
            tutar: true,
            yapilanKm: true,
            arac: { select: { plaka: true, sirket: { select: { ad: true } } } },
        },
    });

    const rows = bakimlar.map((row) => ({
        Tarih: formatDate(row.bakimTarihi),
        Plaka: row.arac?.plaka || "-",
        Sirket: row.arac?.sirket?.ad || "-",
        Kategori: row.kategori,
        Tur: row.tur,
        Servis: row.servisAdi || "-",
        Km: row.yapilanKm,
        Tutar: Number(row.tutar.toFixed(2)),
    }));

    const total = bakimlar.reduce((sum, row) => sum + row.tutar, 0);
    return {
        title: "Bakım / Servis Raporu",
        rows,
        pdfLines: [
            `Toplam kayıt: ${rows.length}`,
            `Toplam tutar: ${formatCurrency(total)}`,
            ...rows.slice(0, 25).map((row) => `${row.Tarih} | ${row.Plaka} | ${row.Kategori} | ${formatCurrency(Number(row.Tutar || 0))}`),
        ],
    };
}

async function getDocumentExpirationReport(params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
    q: string;
    status: string | null;
}): Promise<ReportResponse> {
    const [aracFilter, muayeneFilter, kaskoFilter, trafikFilter] = await Promise.all([
        getModelFilter("arac", params.selectedSirketId),
        getModelFilter("muayene", params.selectedSirketId),
        getModelFilter("kasko", params.selectedSirketId),
        getModelFilter("trafikSigortasi", params.selectedSirketId),
    ]);

    const araclar = await prisma.arac.findMany({
        where: aracFilter as Prisma.AracWhereInput,
        select: { id: true, plaka: true, sirket: { select: { ad: true } } },
    });

    const aracIds = araclar.map((row) => row.id);
    if (!aracIds.length) {
        return { title: "Yaklaşan Evrak Süreleri", rows: [], pdfLines: ["Kayıt bulunamadı."] };
    }

    const [muayeneRows, kaskoRows, trafikRows] = await Promise.all([
        prisma.muayene.findMany({
            where: { ...(muayeneFilter as Prisma.MuayeneWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { gecerlilikTarihi: "desc" }],
            select: { aracId: true, gecerlilikTarihi: true },
        }),
        prisma.kasko.findMany({
            where: { ...(kaskoFilter as Prisma.KaskoWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { bitisTarihi: "desc" }],
            select: { aracId: true, bitisTarihi: true },
        }),
        prisma.trafikSigortasi.findMany({
            where: { ...(trafikFilter as Prisma.TrafikSigortasiWhereInput), aracId: { in: aracIds } },
            orderBy: [{ aracId: "asc" }, { aktifMi: "desc" }, { bitisTarihi: "desc" }],
            select: { aracId: true, bitisTarihi: true },
        }),
    ]);

    const latestMap = new Map<string, Array<{ tur: string; tarih: Date }>>();
    for (const row of muayeneRows) {
        if (!row.gecerlilikTarihi) continue;
        if (!latestMap.has(row.aracId)) latestMap.set(row.aracId, []);
        if (latestMap.get(row.aracId)?.some((item) => item.tur === "Muayene")) continue;
        latestMap.get(row.aracId)?.push({ tur: "Muayene", tarih: row.gecerlilikTarihi });
    }
    for (const row of kaskoRows) {
        if (!row.bitisTarihi) continue;
        if (!latestMap.has(row.aracId)) latestMap.set(row.aracId, []);
        if (latestMap.get(row.aracId)?.some((item) => item.tur === "Kasko")) continue;
        latestMap.get(row.aracId)?.push({ tur: "Kasko", tarih: row.bitisTarihi });
    }
    for (const row of trafikRows) {
        if (!row.bitisTarihi) continue;
        if (!latestMap.has(row.aracId)) latestMap.set(row.aracId, []);
        if (latestMap.get(row.aracId)?.some((item) => item.tur === "Trafik Sigortası")) continue;
        latestMap.get(row.aracId)?.push({ tur: "Trafik Sigortası", tarih: row.bitisTarihi });
    }

    const today = new Date();
    const rows = araclar
        .flatMap((arac) => {
            const items = latestMap.get(arac.id) || [];
            return items.map((item) => {
                const daysLeft = Math.ceil((item.tarih.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                return {
                    Plaka: arac.plaka,
                    Sirket: arac.sirket?.ad || "-",
                    Tur: item.tur,
                    SonTarih: formatDate(item.tarih),
                    KalanGun: daysLeft,
                    Durum: getExpirationStatus(daysLeft),
                    _rawDate: item.tarih,
                };
            });
        })
        .filter((row) => row._rawDate.getTime() >= params.from.getTime() && row._rawDate.getTime() <= params.to.getTime())
        .filter((row) => (params.status ? row.Durum === params.status : true))
        .filter((row) =>
            params.q
                ? row.Plaka.toLocaleLowerCase("tr-TR").includes(params.q) ||
                  row.Tur.toLocaleLowerCase("tr-TR").includes(params.q)
                : true
        )
        .sort((a, b) => a.KalanGun - b.KalanGun)
        .map(({ _rawDate, ...rest }) => rest);

    return {
        title: "Yaklaşan Evrak Süreleri",
        rows,
        pdfLines: [
            `Toplam kayıt: ${rows.length}`,
            ...rows.slice(0, 30).map((row) => `${row.Plaka} | ${row.Tur} | ${row.SonTarih} | ${row.Durum}`),
        ],
    };
}

async function getVehicleExpenseReport(params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
    q: string;
}): Promise<ReportResponse> {
    const [aracFilter, yakitFilter, bakimFilter, masrafFilter, cezaFilter] = await Promise.all([
        getModelFilter("arac", params.selectedSirketId),
        getModelFilter("yakit", params.selectedSirketId),
        getModelFilter("bakim", params.selectedSirketId),
        getModelFilter("masraf", params.selectedSirketId),
        getModelFilter("ceza", params.selectedSirketId),
    ]);

    const araclar = await prisma.arac.findMany({
        where: {
            ...(aracFilter as Prisma.AracWhereInput),
            ...(params.q ? { plaka: { contains: params.q, mode: "insensitive" } } : {}),
        },
        select: { id: true, plaka: true, sirket: { select: { ad: true } } },
    });

    const aracIds = araclar.map((row) => row.id);
    if (!aracIds.length) return { title: "Araç Gider Raporu", rows: [], pdfLines: ["Kayıt bulunamadı."] };

    const [yakitRows, bakimRows, masrafRows, cezaRows] = await Promise.all([
        prisma.yakit.groupBy({
            by: ["aracId"],
            where: {
                ...(yakitFilter as Prisma.YakitWhereInput),
                aracId: { in: aracIds },
                tarih: { gte: params.from, lte: params.to },
            },
            _sum: { tutar: true },
        }),
        prisma.bakim.groupBy({
            by: ["aracId"],
            where: {
                ...(bakimFilter as Prisma.BakimWhereInput),
                aracId: { in: aracIds },
                bakimTarihi: { gte: params.from, lte: params.to },
            },
            _sum: { tutar: true },
        }),
        prisma.masraf.groupBy({
            by: ["aracId"],
            where: {
                ...(masrafFilter as Prisma.MasrafWhereInput),
                aracId: { in: aracIds },
                tarih: { gte: params.from, lte: params.to },
            },
            _sum: { tutar: true },
        }),
        prisma.ceza.groupBy({
            by: ["aracId"],
            where: {
                ...(cezaFilter as Prisma.CezaWhereInput),
                aracId: { in: aracIds },
                tarih: { gte: params.from, lte: params.to },
            },
            _sum: { tutar: true },
        }),
    ]);

    const toMap = (rows: Array<{ aracId: string; _sum: { tutar: number | null } }>) =>
        new Map(rows.map((row) => [row.aracId, row._sum.tutar || 0]));

    const yakitMap = toMap(yakitRows);
    const bakimMap = toMap(bakimRows);
    const masrafMap = toMap(masrafRows);
    const cezaMap = toMap(cezaRows);

    const rows = araclar
        .map((arac) => {
            const yakit = yakitMap.get(arac.id) || 0;
            const bakim = bakimMap.get(arac.id) || 0;
            const masraf = masrafMap.get(arac.id) || 0;
            const ceza = cezaMap.get(arac.id) || 0;
            const toplam = yakit + bakim + masraf + ceza;
            return {
                Plaka: arac.plaka,
                Sirket: arac.sirket?.ad || "-",
                Yakit: Number(yakit.toFixed(2)),
                Bakim: Number(bakim.toFixed(2)),
                Masraf: Number(masraf.toFixed(2)),
                Ceza: Number(ceza.toFixed(2)),
                Toplam: Number(toplam.toFixed(2)),
            };
        })
        .filter((row) => row.Toplam > 0)
        .sort((a, b) => b.Toplam - a.Toplam);

    return {
        title: "Araç Gider Raporu",
        rows,
        pdfLines: [
            `Toplam araç: ${rows.length}`,
            ...rows.slice(0, 25).map((row) => `${row.Plaka} | Toplam: ${formatCurrency(row.Toplam)}`),
        ],
    };
}

async function getMonthlyCostSummaryReport(params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
}): Promise<ReportResponse> {
    const [yakitFilter, bakimFilter, masrafFilter, cezaFilter] = await Promise.all([
        getModelFilter("yakit", params.selectedSirketId),
        getModelFilter("bakim", params.selectedSirketId),
        getModelFilter("masraf", params.selectedSirketId),
        getModelFilter("ceza", params.selectedSirketId),
    ]);

    const labels: string[] = [];
    const cursor = new Date(params.from.getFullYear(), params.from.getMonth(), 1);
    const endMonth = new Date(params.to.getFullYear(), params.to.getMonth(), 1);
    while (cursor.getTime() <= endMonth.getTime() && labels.length < 24) {
        labels.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const [yakitRows, bakimRows, masrafRows, cezaRows] = await Promise.all([
        prisma.yakit.findMany({
            where: { ...(yakitFilter as Prisma.YakitWhereInput), tarih: { gte: params.from, lte: params.to } },
            select: { tarih: true, tutar: true },
        }),
        prisma.bakim.findMany({
            where: { ...(bakimFilter as Prisma.BakimWhereInput), bakimTarihi: { gte: params.from, lte: params.to } },
            select: { bakimTarihi: true, tutar: true },
        }),
        prisma.masraf.findMany({
            where: { ...(masrafFilter as Prisma.MasrafWhereInput), tarih: { gte: params.from, lte: params.to } },
            select: { tarih: true, tutar: true },
        }),
        prisma.ceza.findMany({
            where: { ...(cezaFilter as Prisma.CezaWhereInput), tarih: { gte: params.from, lte: params.to } },
            select: { tarih: true, tutar: true },
        }),
    ]);

    const sumByMonth = new Map<string, { yakit: number; bakim: number; masraf: number; ceza: number }>();
    for (const label of labels) {
        sumByMonth.set(label, { yakit: 0, bakim: 0, masraf: 0, ceza: 0 });
    }

    const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    for (const row of yakitRows) {
        const key = monthKey(row.tarih);
        const bucket = sumByMonth.get(key);
        if (bucket) bucket.yakit += row.tutar;
    }
    for (const row of bakimRows) {
        const key = monthKey(row.bakimTarihi);
        const bucket = sumByMonth.get(key);
        if (bucket) bucket.bakim += row.tutar;
    }
    for (const row of masrafRows) {
        const key = monthKey(row.tarih);
        const bucket = sumByMonth.get(key);
        if (bucket) bucket.masraf += row.tutar;
    }
    for (const row of cezaRows) {
        const key = monthKey(row.tarih);
        const bucket = sumByMonth.get(key);
        if (bucket) bucket.ceza += row.tutar;
    }

    const rows = labels.map((label) => {
        const bucket = sumByMonth.get(label) || { yakit: 0, bakim: 0, masraf: 0, ceza: 0 };
        const toplam = bucket.yakit + bucket.bakim + bucket.masraf + bucket.ceza;
        return {
            Donem: label,
            Yakit: Number(bucket.yakit.toFixed(2)),
            Bakim: Number(bucket.bakim.toFixed(2)),
            Masraf: Number(bucket.masraf.toFixed(2)),
            Ceza: Number(bucket.ceza.toFixed(2)),
            Toplam: Number(toplam.toFixed(2)),
        };
    });

    return {
        title: "Aylık Maliyet Özeti",
        rows,
        pdfLines: [
            `Dönem sayısı: ${rows.length}`,
            ...rows.map((row) => `${row.Donem} | Toplam: ${formatCurrency(row.Toplam)}`),
        ],
    };
}

async function buildReport(report: ReportName, params: {
    selectedSirketId: string | null;
    from: Date;
    to: Date;
    q: string;
    status: string | null;
}) {
    switch (report) {
        case "penalties":
            return getPenaltiesReport(params);
        case "maintenance":
            return getMaintenanceReport(params);
        case "document-expirations":
            return getDocumentExpirationReport(params);
        case "vehicle-expenses":
            return getVehicleExpenseReport(params);
        case "monthly-cost-summary":
            return getMonthlyCostSummaryReport(params);
    }
}

export async function GET(req: NextRequest, context: { params: Promise<{ report: string }> }) {
    try {
        const role = await getCurrentUserRole();
        if (!role) {
            return NextResponse.json({ error: "Bu işlem için giriş yapmalısınız." }, { status: 401 });
        }
        if (role === "SOFOR") {
            return NextResponse.json({ error: "Rapor export yetkiniz bulunmuyor." }, { status: 403 });
        }

        const { report: rawReport } = await context.params;
        if (!isReportName(rawReport)) {
            return NextResponse.json({ error: "Desteklenmeyen rapor tipi." }, { status: 404 });
        }

        const selectedSirketId = req.nextUrl.searchParams.get("sirket");
        const format = req.nextUrl.searchParams.get("format") === "pdf" ? "pdf" : "xlsx";
        const q = (req.nextUrl.searchParams.get("q") || "").trim().toLocaleLowerCase("tr-TR");
        const status = req.nextUrl.searchParams.get("status");
        const { from, to } = parseDateRange(req.nextUrl.searchParams);

        const report = await buildReport(rawReport, { selectedSirketId, from, to, q, status });
        const dateRangeText = `${formatDate(from)} - ${formatDate(to)}`;

        if (format === "pdf") {
            const pdfBuffer = buildSimplePdf(report.title, [
                `Tarih Aralığı: ${dateRangeText}`,
                `Kayıt Sayısı: ${report.rows.length}`,
                "",
                ...report.pdfLines,
            ]);
            return new NextResponse(new Uint8Array(pdfBuffer), {
                status: 200,
                headers: {
                    "Content-Type": "application/pdf",
                    "Content-Disposition": `attachment; filename=\"${getReportFileName(rawReport, "pdf")}\"`,
                    "Cache-Control": "no-store",
                },
            });
        }

        const excelBuffer = createExcelBuffer(report.title, report.rows, {
            "Tarih Aralığı": dateRangeText,
            "Kayıt Sayısı": String(report.rows.length),
            "Şirket": selectedSirketId || "Tüm Şirketler",
        });

        return new NextResponse(new Uint8Array(excelBuffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename=\"${getReportFileName(rawReport, "xlsx")}\"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (error) {
        console.error("Report export error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Rapor export işlemi başarısız." },
            { status: 500 }
        );
    }
}
